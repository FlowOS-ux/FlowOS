# FlowOS — AI Assistant (Service Recommender)

**Date:** 2026-06-10
**Goal:** A lightweight AI-powered assistant that helps customers discover the best available service in natural language ("a bank nearby", "shortest salon queue", "what can I join right now?"), ranks results intelligently by rating / reviews / live queue wait / availability, explains *why*, and lets users navigate to or join a queue directly.

---

## 1. Summary & approach

FlowOS already had an `ai` module (generic Groq chat) and `aiAssistant: true` in system config, but nothing business-aware. This feature **adds a recommendation capability** to that module without disturbing the existing chat.

**Key design decision — DB-driven ranking, LLM-optional prose.** The ranking and the structured recommendation cards are computed **deterministically from the database** (ratings, review counts, live queue waits, open/closed). The LLM (Groq, if `GROQ_API_KEY` is set) is used **only to phrase the natural-language reply**, grounded in the ranked list. If Groq isn't configured (as in local/demo), a high-quality deterministic reply is produced. This means:
- The actionable cards can **never** show hallucinated businesses, ratings, or wait times.
- The feature works fully **without any API key or cost** — the LLM is pure polish.

---

## 2. Database changes required

**None.** No migrations, no new collections, no new fields. The recommender reads existing, already-indexed data:

| Need | Existing source |
|---|---|
| Rating + review count | `Business.ratingAvg`, `Business.ratingCount` (denormalized, maintained by reviews service) |
| Category | `Business.category` (indexed) |
| Address / location | `Business.address`, `Business.location` (2dsphere indexed → enables "nearby") |
| Open/closed + ETA basis | `Queue.status` (`OPEN`), `Queue.avgServiceSec` |
| Live queue size | `count(QueueEntry where status='WAITING')` — uses existing `{queueId, status, joinedAt}` index |
| Only live businesses | `Business.status = 'APPROVED'` (indexed) |

Estimated wait = `peopleWaiting × avgServiceSec`, per the shortest joinable (OPEN) queue.

---

## 3. API design

### `POST /api/v1/ai/recommend` (authenticated)

**Request**
```json
{ "message": "Find a salon with the shortest queue", "lat": 17.44, "lng": 78.39, "limit": 4 }
```
`lat`/`lng`/`limit` optional. `message` 1–500 chars.

**Response**
```json
{
  "reply": "For the shortest wait, head to Luxe Beauty & Wellness — ~90 min with 12 waiting. …",
  "query": { "category": "SALON", "intent": "shortest_wait" },
  "recommendations": [
    {
      "businessId": "…", "name": "Luxe Beauty & Wellness", "category": "SALON",
      "address": "…", "logoUrl": null,
      "ratingAvg": 4.7, "ratingCount": 25,
      "queueSize": 12, "estimatedWaitSec": 5400, "estimatedWaitText": "~90 min",
      "isOpen": true, "score": 0.438,
      "reasons": ["Highly rated (4.7★)", "Trusted by 25 reviews", "Open now (~90 min)"],
      "topQueueId": "…"
    }
  ]
}
```

Every recommendation returns all spec-required fields: **name, category, average rating, number of reviews, current queue size, estimated wait time, address, reason** — plus `businessId` (for "Go to Service") and `topQueueId` (for direct "Join queue").

The existing `POST /ai/chat`, `GET /ai/conversations`, `GET /ai/conversations/:id` are unchanged.

---

## 4. Recommendation scoring system

Implemented in [backend/src/services/ai/recommendation.ts](backend/src/services/ai/recommendation.ts) — a **pure, DB-free, unit-tested** module (reusable service layer).

Each component is normalised to `[0,1]`:

| Component | Formula | Notes |
|---|---|---|
| Rating | `ratingAvg / 5` | `0` when there are no ratings (neutral, not negative) |
| Reviews | `min(ratingCount / 50, 1)` | "fully trusted" review volume at 50 |
| Wait | `1 − min(estimatedWaitSec / 3600, 1)` | shorter = higher; `0` if closed |
| Availability | `isOpen ? 1 : 0` | open = has ≥1 OPEN queue |

**Base weights (per spec): Rating 40% · Reviews 20% · Wait 25% · Availability 15%.**

`score = 0.40·rating + 0.20·reviews + 0.25·wait + 0.15·availability`

**Intent-adaptive weights** — the parsed intent shifts the weights so ranking matches what was asked:

| Intent | rating | reviews | wait | avail | Trigger keywords |
|---|---|---|---|---|---|
| `general` | .40 | .20 | .25 | .15 | (default) |
| `best_rated` | .55 | .25 | .10 | .10 | best, top, highest, good reviews/ratings, well-rated |
| `shortest_wait` | .20 | .10 | .50 | .20 | shortest, quick, fastest, least wait, no wait |
| `available_now` | .30 | .15 | .25 | .30 | right now, available now, join now, open now |
| `nearby` | .40 | .20 | .25 | .15 | near, nearby, close, around me (proximity via geo query) |

Intent-aware **tiebreakers** (shortest_wait → lowest ETA first; best_rated → highest rating/most reviews). `available_now` prefers open businesses but falls back to all if none are open.

**Reasons** are generated from the dominant signals (e.g. `Highly rated (4.8★)`, `Trusted by 28 reviews`, `No wait — walk right in`, `Currently closed`, `New — no ratings yet`).

---

## 5. Backend implementation

```
backend/src/
├── services/ai/
│   ├── recommendation.ts        ★ NEW — pure scoring/intent/reason logic (reusable)
│   ├── heuristic.recommender.ts    (existing; superseded by the above for this feature)
│   └── groq.assistant.ts           (existing; reused to phrase the reply)
└── modules/ai/
    ├── recommend.service.ts     ★ NEW — DB orchestration + NL reply generation
    ├── ai.controller.ts            EDIT — + `recommend` handler
    ├── ai.routes.ts                EDIT — + POST /recommend
    ├── ai.schema.ts                EDIT — + recommendSchema/RecommendDto
    └── ai.service.ts               (existing chat — untouched)
backend/tests/unit/
└── recommendation.test.ts       ★ NEW — 12 tests for scoring/intent/ranking/edges
```

**Orchestration** ([recommend.service.ts](backend/src/modules/ai/recommend.service.ts)):
1. `parseQuery(message)` → `{ category, intent }`.
2. Query APPROVED businesses (filtered by category, optionally `$near` for nearby) via the existing `businessesRepository.search`.
3. For each business, enrich with **live** queue stats: OPEN queues, `countWaiting` per queue, total `queueSize`, shortest-ETA queue → `estimatedWaitSec` + `topQueueId`, `isOpen`.
4. `rankRecommendations(candidates, intent, limit)`.
5. `buildReply(...)` — Groq when configured (grounded prompt), deterministic otherwise.

No new repository methods were needed — it reuses `businessesRepository.search`, `queuesRepository.listByBusiness`, and `entriesRepository.countWaiting`.

---

## 6. Frontend implementation

```
mobile/src/
├── screens/customer/
│   └── AIAssistantScreen.tsx    ★ NEW — chat UI + recommendation cards + actions
├── api/
│   ├── endpoints.ts                EDIT — + aiApi.recommend()
│   └── types.ts                    EDIT — + Recommendation / RecommendResponse / RecIntent
└── navigation/
    └── RootNavigator.tsx           EDIT — + "Assistant" tab in the customer dashboard
```

**[AIAssistantScreen.tsx](mobile/src/screens/customer/AIAssistantScreen.tsx)** — a chat interface:
- Quick-suggestion chips (the five spec examples) when empty.
- User/assistant message bubbles; the assistant reply is followed by **recommendation cards**.
- Each card shows name, category, `★ rating (count)` (or "No ratings yet"), `N waiting`, wait label, address, an Open/Closed badge, and **reason chips**.
- **Smart navigation:** **"Go to service"** → `navigation.navigate('BusinessDetails', { businessId })`; **"Join queue"** → `queueApi.join(topQueueId)` directly from the card (disabled when closed), with a confirming snackbar.
- "Finding the best options…" thinking indicator; best-effort geolocation for "nearby".

**Accessible from the customer dashboard** as a dedicated **"Assistant"** tab (robot icon) alongside Explore / My Queues / Notifications / Profile.

---

## 7. Edge-case handling

| Edge case | Behaviour |
|---|---|
| **No businesses available** | Empty `recommendations`; reply: "There aren't any approved services on FlowOS yet." |
| **Category requested, none found** | Broadens to all approved and explains: "I couldn't find any banks, but here are other great options." |
| **No ratings** | Rating signal treated as neutral (not negative); card shows "No ratings yet"; reason "New — no ratings yet". |
| **Closed businesses** (no OPEN queue) | `isOpen:false`, availability+wait score 0, ranked lower; "Join queue" disabled; reason "Currently closed". For `available_now`, open ones are preferred (fallback to all if none open). |
| **Empty queue** | `queueSize:0`, ETA 0 → top wait score; reason "No wait — walk right in". |
| **Network failures** | Backend errors flow through the resilient axios client (auto-retry/backoff from the earlier reliability work); the screen shows a friendly error bubble and the input stays usable. DB-down returns a retryable 503. |
| **Unknown request** ("a library") | Category null → general ranking across all approved businesses (never errors). |
| **Unauthenticated** | `401` (route requires auth). |

---

## 8. Verification (this session)

- **Backend** `tsc --noEmit`: clean. **Mobile** `tsc --noEmit`: clean.
- **Lint**: backend clean; mobile only the pre-existing `Card.Title right={…}` / inline-chip-color style warnings (consistent with `BusinessDetailsScreen`).
- **Tests**: full suite **28/28** + new **recommendation.test.ts 12/12** pass.
- **Live endpoint** (against the running local stack) verified for all five spec examples:
  - "bank nearby" → `nearby`/`BANK` → Prestige Financial Center
  - "best ratings restaurant" → `best_rated`/`RESTAURANT` → The Grand Table (4.8★, 28)
  - "salon shortest queue" → `shortest_wait`/`SALON` → Luxe Beauty (~90 min) ranked before Elite Spa (~150 min)
  - "hospital good reviews" → `best_rated`/`HOSPITAL`
  - "what can I join right now?" → `available_now` → open businesses ranked by score
- **Web** bundle recompiled successfully; the **Assistant** tab is live at `http://localhost:8080/`.

---

## 9. How to try it

1. Ensure the local stack is running (in-memory Mongo → seed → backend → web — see `PRODUCTION_READINESS_NETWORK_ANALYSIS.md §9`).
2. Open `http://localhost:8080/`, sign up / log in as a **customer**.
3. Open the **Assistant** tab and tap a suggestion or type a request.
4. Tap **Go to service** to open a business, or **Join queue** to join its shortest open queue directly.

> Optional: set `GROQ_API_KEY` (+ `GROQ_MODEL`) in `backend/.env` to have replies phrased by the LLM. Without it, the deterministic replies (shown above) are used — ranking and cards are identical either way.

---

## 10. Future enhancements (not in this basic version)

- Replace the N+1 per-queue waiting counts with a single aggregation pipeline (fine at demo scale; matters at thousands of queues).
- Personalize ranking from the user's history/favorites.
- Persist recommendation turns into the existing `aiConversations` for follow-up context ("the second one").
- Use business hours (`Business.hours`) in addition to queue status for a richer "open now".
- Add a native NetInfo-backed offline cue on the assistant screen (web already covered by the global connectivity banner).
