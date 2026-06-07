# FlowOS — Implementation Plan (Phase 2A)

> **Created:** 2026-06-07 · **Owner:** systems@novetum.com
> **Source of truth:** [FLOWOS_PROJECT_STATUS.md](FLOWOS_PROJECT_STATUS.md)
> **Scope:** Analysis, dependency check, and execution plan for the self-service MVP (Phase 2A).
> **Status:** Approved; credential-free Phase 2A items implemented and committed (see below).

---

## ✅ Current state (updated 2026-06-07)

Phase 2A's **credential-free items are implemented and committed** to a single monorepo on branch
`main` (initial baseline commit `1cdac9f` + Forgot-Password commit `129c8e5`). All changes are
**typecheck-clean** (`tsc --noEmit` on backend + mobile) and the backend smoke suite passes **20/20**.
Commits are **local only — not yet pushed** to GitHub.

| Item | State | Verified |
|---|---|---|
| Business Setup & Activation (screen + nav + dashboard entry) | **Committed** | mobile `tsc` ✅ |
| Join ACTIVE-business validation (backend guard) | **Committed** | smoke 20/20 ✅ |
| Real-time Notifications screen (`notification:new` + live badge) | **Committed** | mobile `tsc` ✅ |
| Real-time Dashboard updates (`dashboard:updated` + live badge) | **Committed** | mobile `tsc` ✅ |
| Forgot-Password UI (request + reset) | **Committed** | mobile `tsc` ✅ |
| Device-token registration on login | Not started | coupled to FCM client |
| FCM Push | Not started | blocked (creds) |

**Files added/changed (committed):**
- `mobile/src/screens/business/BusinessSetupScreen.tsx` *(new)*
- `mobile/src/screens/auth/ForgotPasswordScreen.tsx` *(new)*
- `mobile/src/realtime/useRealtimeEvents.ts` *(new)*
- `mobile/src/realtime/socket.ts` *(business-room tracking + event-name exports)*
- `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/navigation/types.ts` *(register `BusinessSetup` + `ForgotPassword`)*
- `mobile/src/screens/business/BusinessesScreen.tsx` *(status chip, setup CTA, dashboard sockets)*
- `mobile/src/screens/shared/NotificationsScreen.tsx` *(socket-driven feed)*
- `mobile/src/screens/auth/LoginScreen.tsx` *(Forgot-password link)*
- `mobile/src/api/endpoints.ts` *(`resetPassword` wrapper)*
- `mobile/src/api/types.ts` *(`BusinessHour` + `hours` on `Business`)*
- `backend/src/modules/entries/entries.service.ts` *(join guard)*
- `backend/scripts/smoke.ts` *(guard assertion → 20/20)*

> **Decision made:** kept the changes and committed them as the Phase 2A baseline on `main`.

---

## 1. Current project completion percentage

| Area | Documented (status doc) | Working tree (this session) |
|---|---|---|
| Backend | ~85% | ~86% (join guard added) |
| Frontend | ~45% | ~52% (Setup/Activation + real-time consumption + Forgot-Password) |
| Database | ~95% | ~95% |
| Real-time | backend done, client partial | **client now full** for queues, notifications, dashboard |
| Notifications | ~40% (in-app ✅, push ❌) | ~45% (in-app real-time ✅, push ❌) |
| Testing | ~20% | ~22% (one guard assertion added) |
| **Overall MVP** | **~58%** | **~63%** |

---

## 2. Completed modules

### Backend (14 implemented modules)
`auth · users · businesses · queues · entries · notifications · appointments · reviews ·
memberships(staff) · favorites · analytics · ai · support · system`
- Queue engine: state machine, computed position, EMA ETA, atomic call-next, real-time + analytics.
- Auth: JWT access + rotating refresh (reuse detection), RBAC (global + business-scoped).
- ~55 endpoints under `/api/v1`; cross-cutting services wired via `container.ts`.

### Mobile (12 screens — 11 documented + 1 this session)
Login, Register, Explore, BusinessDetails, Activity, Businesses(Dashboard), CreateBusiness,
QueueForm, QueueManager, Notifications, Profile, **BusinessSetup (new)**.

### Infra/data
16 Mongoose models + indexes; seed script; in-memory test harness; smoke (20/20) + socket-smoke (5/5).

---

## 3. Pending modules

### Backend
- `media` (uploads) — **stub only**; `IStorageService` exists but unwired.
- `devices` — model + repo exist; **token registration not called on login** (see §verified facts).
- `kycRequests` — **model only, no endpoints**.
- `FcmPushService` — **coded but disabled** (no Firebase service account).
- Email delivery — **dev console stub** (no SMTP provider).

### Mobile (≈14 screens still pending)
Forgot Password, Business activation polish, Appointments, Saved Places, Reviews, Settings (editable),
Onboarding/Splash, dedicated Analytics, Staff Management, AI Assistant, Help & Support,
Connection Error, plus device-token registration and env-based API base URL.

---

## 4. Critical blockers

| Blocker | Impact | Owner / dependency | Status |
|---|---|---|---|
| **Business activation gap** | Self-created businesses never reach Explore | — | **Resolved this session** (pending review) |
| **FCM service account** | No background push; "it's your turn" only while app open | Needs Firebase project + `serviceAccount.json` + `google-services.json` | **Blocked — external** |
| **No `@react-native-firebase` in mobile** | FCM client cannot be built | Needs native package install + Android build config (JDK 17) | **Blocked — setup** |
| **SMTP provider** | Password-reset email not delivered (console only) | Needs SMTP host/credentials | **Blocked — external** |
| **No automated test suite / CI** | Regressions can ship undetected | — | Open (quality track) |
| **Uncommitted repo** | No version-control safety net | — | Recommend initial commit |

---

## 5. Recommended implementation order (Phase 2A)

1. **Business Setup & Activation** — ✅ done (review + commit)
2. **Join ACTIVE-business validation** — ✅ done (review + commit)
3. **Real-time Notifications screen** — ✅ done (review + commit)
4. **Real-time Dashboard updates** — ✅ done (review + commit)
5. **Forgot-Password UI** — ✅ done + committed (SMTP delivery still pending)
6. **Device-token registration on login** — unblocked REST-wise but only useful with the FCM client; do alongside FCM
7. **FCM Push** — blocked on credentials; scaffold native + service wiring, finish on a real device once creds land
8. **Email provider (SMTP)** — blocked on credentials; config-only once provided
9. **Testing & Verification (unit + CI)** — parallel track, start anytime

Rationale: finish everything that needs **no external credentials** first (5, 6), so the only
remaining gaps are the two genuinely external dependencies (FCM creds, SMTP creds).

---

## 6. Estimated effort (1 developer)

| Feature | Est. | Notes |
|---|---|---|
| Business Setup & Activation | ~1.0 d | **DONE** |
| Join ACTIVE validation | ~0.25 d | **DONE** |
| Real-time Notifications screen | ~0.5 d | **DONE** |
| Real-time Dashboard updates | ~0.5 d | **DONE** |
| Forgot-Password UI | ~0.75 d | **DONE**; +0.5 d SMTP config still pending |
| Device-token registration | ~0.5 d | wire `registerDevice` on login + settings respect |
| FCM Push (client + activate) | ~2–3 d | native install, build config, on-device test |
| Email provider config | ~0.25 d | once SMTP creds exist |
| Test suite + CI (separate track) | ~3–4 d | Jest/Supertest + RN component + GH Actions |

**Phase 2A remaining (excludes test/CI track):** ~4–6 developer-days, of which ~2–3 are FCM and
gated on credentials.

---

## 7. Risks and dependencies

- **External credentials (highest risk to timeline):** FCM service account + `google-services.json`,
  and an SMTP provider. Without these, FCM and reset-email cannot be *completed or verified*.
- **Native build (FCM):** RN 0.85 + `@react-native-firebase` requires a clean Android build
  (JDK 17; current dev Node 20.18 warns — RN prefers ≥20.19).
- **No CI/tests:** every change is verified only by manual smoke; risk grows as surface grows.
- **Single-instance Socket.IO:** no Redis adapter → not horizontally scalable (deferred, Phase 3).
- **Uncommitted working tree:** all session work is unsaved to git — commit a baseline before more work.
- **Hardcoded mobile API base URL** (`10.0.2.2`): real-device/prod testing needs env config.
- **No multi-document transaction** around business+membership creation (standalone Mongo).

---

## 8. What should be completed in the next 5 days

| Day | Goal | Depends on |
|---|---|---|
| **1** | Review + **commit** the working-tree Phase 2A changes (items 1–4). Manual on-emulator verification: create business → activate → appears in Explore → join blocked while DRAFT; live notifications + dashboard. | Approval of this plan |
| **2** | **Device-token registration**: call `registerDevice` after login/restore, respect `settings.pushEnabled`; add `removeDevice` on logout. | — |
| **3–4** | **FCM Push** if credentials are available: install `@react-native-firebase/app`+`/messaging`, Android config, activate `FcmPushService` with service account, test on device. **Else** start **Forgot-Password UI**. | Firebase creds |
| **5** | **Forgot-Password UI** (screen + `resetPassword` wrapper) and SMTP provider config; full verification pass (smoke 20/20, socket 5/5, manual). | SMTP creds for email |

> If FCM/SMTP credentials are **not** provided by Day 3, the 5-day outcome is: items 1–4 committed,
> device-token registration done, Forgot-Password UI done (against console-fallback email), and FCM
> left scaffolded-but-inactive with a documented "activate when creds arrive" step.

---

## 9. Detailed Phase 2A execution plan

### 9.1 Business Setup & Activation — ✅ DONE (pending review)
- **API (verified, no new backend):** `PATCH /businesses/:id` already accepts `status` and `hours`
  ([businesses.schema.ts](backend/src/modules/businesses/businesses.schema.ts) lines 37–38), requires
  `MANAGER`+. Mobile `businessApi.update(id, body)` already exists.
- **Done:** `BusinessSetupScreen` (7-day hours editor + ACTIVE/DRAFT toggle + profile basics),
  registered route `BusinessSetup`, dashboard status chip + "Setup & activate" CTA + cog entry,
  `BusinessHour`/`hours` added to mobile `Business` type.
- **Verify:** mobile `tsc` ✅. Manual: draft → activate → visible in Explore.

### 9.2 Join ACTIVE-business validation — ✅ DONE (pending review)
- **Done:** guard in `entriesService.join` rejects join when business `status !== 'ACTIVE'`
  ([entries.service.ts](backend/src/modules/entries/entries.service.ts)).
- **Verify:** smoke assertion `join: blocked when business not ACTIVE (400)` → **20/20** ✅.

### 9.3 Real-time Notifications screen — ✅ DONE (pending review)
- **API (verified):** backend emits `notification:new` to the auto-joined `user:<id>` room
  ([realtime.interface.ts](backend/src/services/realtime/realtime.interface.ts)).
- **Done:** `useNotificationEvents` hook + `NotificationsScreen` refetches on event, live badge,
  poll demoted to 30s safety net.

### 9.4 Real-time Dashboard updates — ✅ DONE (pending review)
- **API (verified):** backend emits `dashboard:updated` to `business:<id>`; `subscribe:business`
  handler exists ([socket.ts](backend/src/socket.ts)).
- **Done:** `socket.ts` now tracks business rooms + re-subscribes on reconnect; `useDashboardEvents`
  hook; `BusinessesScreen` refetches on event + live badge.

### 9.5 Device-token registration — ⬜ TODO (unblocked)
- **API (verified):** `POST /notifications/devices` exists; mobile `notificationApi.registerDevice`
  wrapper exists but is **never called**.
- **Plan:** after successful login/register/session-restore in `AuthContext`, obtain the platform +
  push token and call `registerDevice`; gate on `user.settings.pushEnabled`. On logout, call delete.
- **Note:** the real device *token* comes from FCM, so end-to-end value couples with §9.7. The
  REST wiring + platform string can be done now and verified against the backend.

### 9.6 Forgot-Password UI — ✅ DONE (committed; email needs SMTP)
- **API (verified):** backend `/auth/forgot-password` + `/auth/reset-password` both exist
  ([auth.routes.ts](backend/src/modules/auth/auth.routes.ts)).
- **Done:** added `authApi.resetPassword(token, password)` wrapper; built two-phase
  `ForgotPasswordScreen` (request code → set new password); linked from `LoginScreen`; registered in
  the Auth stack. Token form `"<userId>.<rawToken>"`, 1h expiry.
- **Remaining:** email delivery uses the **dev console fallback** until an SMTP provider is configured
  (config-only, no code change). Verify: mobile `tsc` ✅.

### 9.7 FCM Push — ⬜ TODO (BLOCKED on credentials + native install)
- **State (verified):** backend `firebase-admin` installed + `FcmPushService` coded but disabled;
  **mobile has no `@react-native-firebase` package**.
- **Plan (when creds available):** install `@react-native-firebase/app` + `/messaging`; add
  `google-services.json` (Android); request notification permission; obtain token → feed §9.5;
  activate `FcmPushService` with the service account; handle foreground/background/quit message
  handlers. Verify on a real device/emulator with Google Play services.

### 9.8 Testing & Verification — ⬜ ongoing
- Keep `npm run smoke` (20/20) + `npm run smoke:socket` (5/5) green on every change.
- Stand up Jest + Supertest (services/repos), RN component tests for the new screens, and a GitHub
  Actions pipeline (lint + typecheck + test). Tracked as a parallel hardening effort.

---

## 10. Phase 2A checklist

- [x] **Business Setup & Activation** — *committed (`1cdac9f`)*
- [ ] **FCM Push Notifications** — *blocked: Firebase service account + `google-services.json` + native install*
- [ ] **Device Token Registration** — *wrapper + endpoint exist; not wired to login (couples with FCM)*
- [x] **Forgot Password UI** — *committed (`129c8e5`); SMTP delivery still pending*
- [x] **Real-time Notifications Screen** — *committed (`1cdac9f`)*
- [x] **Real-time Dashboard Updates** — *committed (`1cdac9f`)*
- [x] **Join ACTIVE Business Validation** — *committed (`1cdac9f`); smoke 20/20*
- [~] **Testing & Verification** — *smoke 20/20 + socket 5/5 + tsc clean; unit/CI still pending*

Legend: `[x]` done · `[~]` partial · `[ ]` not started.

---

## 11. Open decisions for approval

1. ✅ **Resolved** — kept the Phase 2A changes and committed them as the baseline (branch `main`, `1cdac9f`).
2. ✅ **Resolved** — initial commit done; Forgot-Password committed on top (`129c8e5`).
3. **Provide Firebase + SMTP credentials?** — unblocks FCM push, device-token registration, and reset email.
4. **Test/CI track** — start in parallel now, or after Phase 2A feature work?
5. **Push to GitHub** (`SreelekhaAC/FlowOS`)? — commits are currently local only.

> Plan and source-of-truth docs refreshed 2026-06-07 to match the committed state.
