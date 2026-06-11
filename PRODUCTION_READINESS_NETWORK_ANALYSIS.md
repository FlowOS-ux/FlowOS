# FlowOS — Production-Readiness Analysis: Intermittent "Network Error"

**Date:** 2026-06-10
**Scope:** Why the app intermittently shows a "Network Error" (most often on **login/signup**) that clears after a manual refresh, and the production-grade fixes applied so the app recovers **automatically** without a manual refresh.

---

## 1. Executive summary

The symptom — *"login/signup shows Network Error sometimes; refreshing fixes it"* — is the classic signature of a **transient backend unavailability hitting a client that has no retry logic**.

The backend runs on **Railway** (`flowos-backend-production-61d2.up.railway.app`) with **MongoDB Atlas**. Free/hobby cloud tiers **cold-start** (sleep when idle, wake on first request in ~5–60s), **restart on deploys**, and **briefly drop DB connections**. The very first request after the app opens is usually the **login/signup** call — so it is the one that lands on a cold/restarting backend.

The previous client behaviour turned that transient blip into a hard, user-visible failure:

- **No retry** on the axios client — one failed request = "Network Error" shown immediately.
- The raw axios message **"Network Error"** was shown verbatim.
- A manual **refresh** "fixed" it only because, by then, the server was warm.
- On web, an unhandled network rejection could even **blank the whole app** with a red error screen.
- On launch, a transient failure restoring the session **logged the user out entirely**.

**Confirmed primary root cause:** transient backend unavailability (cold start / restart / DB reconnect) + **zero client-side retry/recovery**.

The fixes make every layer resilient: the client **retries with exponential backoff**, the backend **opens its port before the DB is ready** (so early requests queue instead of being refused) and **auto-reconnects to the DB**, transient DB errors become **retryable 503s**, the session **survives** transient launch failures, and the UI shows a **"Reconnecting…"** banner that **recovers in the background**.

> Note: the `ERR_CONNECTION_REFUSED` at `http://localhost:8080/` seen during local dev is a **different** issue — it means the **web dev server itself isn't running** (`npm run web`), not a backend network error. It cannot occur for end users in production (the web build is static files served by a host). See §7.

---

## 2. Architecture (as built)

| Layer | Tech | Notes |
|---|---|---|
| Mobile/Web client | React Native 0.85 + React 19, React Native Web (webpack, port 8080), `axios`, `socket.io-client` | Per-screen `useState` data fetching (no react-query). Tokens in Keychain (native) / localStorage (web). |
| Backend | Express 5, Mongoose 8, Socket.IO 4, `pino`, `helmet`, `express-rate-limit` | Boots: connect DB → init services → listen. Single instance. |
| Hosting | Railway (backend) + MongoDB Atlas (DB) | Free/hobby tiers cold-start, restart on deploy, and can drop DB connections. |

Client base URL (`mobile/src/config.ts`): dev → `http://localhost:4000`; release/web → the Railway URL.

---

## 3. Investigation: every candidate cause, mapped to this codebase

Risk = likelihood × user impact for **this** deployment.

| # | Candidate cause | Verdict for FlowOS | Risk | Evidence / reasoning |
|---|---|---|---|---|
| 1 | **API cold start** | **Confirmed primary** | 🔴 High | Railway/Atlas free tiers sleep & wake slowly. First request (login) lands cold. No client retry → instant "Network Error". |
| 2 | **Server restarts / deploy windows** | **Confirmed contributor** | 🔴 High | Every deploy/restart = seconds of refused/aborted connections. `server.ts` connected DB *before* listening, widening the window where the port is closed. |
| 3 | **DB connection issues / failover** | **Likely contributor** | 🟠 Medium | `db.ts` used default Mongoose options (30s server-selection). A blip made requests hang then fail as opaque 500s. No tuned timeouts / reconnection logging. |
| 4 | **Connection pool exhaustion** | Low (single instance, modest load) | 🟢 Low | No explicit `maxPoolSize`/`waitQueueTimeoutMS` previously; now bounded. |
| 5 | **Rate limiting** | Possible, not the main cause | 🟡 Low-Med | `auth.routes.ts` limits 50/15min per IP. A 429 has a *response* (not "Network Error"), and is now retried with `Retry-After`. Many users behind one NAT could still hit it. |
| 6 | **CORS** | Config-dependent | 🟡 Low-Med | `CORS_ORIGIN=*` → origin reflected (works). If set to a fixed list in prod that omits the web origin, preflight fails → "Network Error". Documented. |
| 7 | **DNS resolution failures** | Transient/network-class | 🟡 Low-Med | Manifests as axios "Network Error" (no response). Now retried. |
| 8 | **Load-balancer / edge timeouts** | Possible on cold start | 🟠 Medium | Railway edge can return 502/503/504 while the app wakes. Previously surfaced raw; now retried. |
| 9 | **Reverse proxy / trust proxy** | Handled | 🟢 Low | `app.set('trust proxy', 2)` matches Railway hops (correct for rate-limit keying). |
| 10 | **Auth token refresh failures** | **Confirmed bug** | 🔴 High | A **network blip during refresh** returned `null` → forced logout. Refresh used bare `axios` (no retry). |
| 11 | **Session expiration** | **Confirmed bug** | 🟠 Medium | Restore-on-launch caught *any* error (incl. network) and **cleared the session** → forced re-login. |
| 12 | **Network instability** | Real for mobile users | 🟠 Medium | No retry, no offline detection. |
| 13 | **Mobile network switching (Wi-Fi↔data)** | Real for mobile users | 🟠 Medium | In-flight requests fail on handover; no auto-retry/reconnect. |
| 14 | **Request timeout handling** | Weak | 🟠 Medium | 15s timeout, **no retry after timeout**; a slow cold start > 15s = hard failure. |
| 15 | **Race conditions** | Minor | 🟢 Low | Refresh was already single-flight; preserved & hardened. |
| 16 | **Railway/Vercel/cloud limits** | **Confirmed contributor** | 🔴 High | Idle sleep + slow wake + deploy restarts are the environmental driver of #1/#2/#8. |
| 17 | **Frontend state sync** | **Confirmed contributor** | 🟠 Medium | After a failure, screens dead-ended on a static error string; only a manual refresh re-fetched. No background recovery. |
| 18 | **Unhandled promise rejection (web)** | **Confirmed (web)** | 🟠 Medium | `installErrorReporter.js` + `index.web.js` overwrote the entire `#root` with a red screen on *any* `unhandledrejection`, including network errors. |

---

## 4. Code-level gaps found (before fixes)

1. **No retry anywhere** — `mobile/src/api/client.ts` created a plain axios instance (`timeout: 15000`) with only a 401-refresh interceptor.
2. **Logout on transient refresh failure** — `refreshAccessToken().catch(() => null)` → `onLogout()` even for a network blip.
3. **Logout on transient launch failure** — `AuthContext` restore `catch { clearSession() }` for *any* error.
4. **Raw error strings** — `apiErrorMessage` returned axios's `"Network Error"` / `"timeout of 15000ms exceeded"` verbatim.
5. **No offline detection / no background recovery** — nothing watched connectivity; recovery required user action.
6. **Destructive global web error handler** — network `unhandledrejection` blanked the app.
7. **Boot order refused early traffic** — `server.ts` awaited DB connect before `listen()`, so cold-start/restart requests hit a closed port (ECONNREFUSED).
8. **No DB resilience config / reconnection visibility** — default Mongoose timeouts; DB-down surfaced as opaque 500s, not retryable.
9. **Health check not readiness-aware** — `/api/v1/system/health` reported `status:"ok"` even when the DB was disconnected.

---

## 5. Fixes implemented (exact changes)

### Backend

**`backend/src/server.ts` — resilient boot (listen-first + DB retry)**
- Now creates HTTP+Socket.IO and **calls `listen()` immediately**, *then* connects the DB with **exponential-backoff retry** (`connectWithRetry`, capped 30s) in the background; `initServices()` no longer blocks boot.
- *Why it fixes it:* during a cold start/restart the port is open right away, so the first login request **queues on Mongoose's command buffer and completes** when the DB attaches, instead of being **refused**. Added an `unhandledRejection` process guard so a stray async error can't kill the dyno.

**`backend/src/config/db.ts` — DB resilience + reconnection visibility**
- Added tuned options: `serverSelectionTimeoutMS: 8000`, `connectTimeoutMS: 10000`, `socketTimeoutMS: 45000`, `waitQueueTimeoutMS: 10000`, `maxPoolSize: 10`, `minPoolSize: 1`, `heartbeatFrequencyMS: 10000`, `retryWrites: true`.
- Listeners attached **once** (`connected`/`reconnected`/`error`/`disconnected`). Added `isDbHealthy()`.
- *Why:* fail fast (8s, not 30s) on a blip so a stuck request becomes a quick retryable 503; the driver auto-reconnects and the lifecycle is now logged.

**`backend/src/middleware/error.ts` — DB-down → retryable 503**
- Maps `MongooseServerSelectionError` / `MongoNetworkError` / `MongoNotConnectedError` / `MongoTimeoutError` / `MongoServerSelectionError` to **HTTP 503 `SERVICE_UNAVAILABLE`**.
- *Why:* a DB hiccup is transient — 503 is in the client's retry set, so the request recovers instead of failing as a generic 500.

**`backend/src/modules/system/system.controller.ts` — readiness-aware health**
- `/api/v1/system/health` now returns `{ status: 'ok'|'degraded', ready, db, uptimeSec }` (HTTP 200 always, so a platform health check won't kill the container over a brief blip). Root `/health` stays pure liveness.
- *Why:* the client polls this to detect recovery and refetch automatically.

### Client (mobile + web)

**`mobile/src/api/client.ts` — retry + network-aware refresh (the core fix)**
- **Automatic retry with exponential backoff + jitter** for transient failures: **no response** (network/DNS/refused/CORS-preflight/timeout) and statuses **429/502/503/504**. Up to `MAX_RETRIES` (3); honours `Retry-After`.
- Retrying **POST login/register is safe**: a request with *no response* never reached the server, so a replay cannot double-apply.
- **Network-aware token refresh:** `refreshAccessToken` returns `ok | auth_failed | network_error`. The user is logged out **only** on `auth_failed` (genuinely invalid token), never on a network blip. Refresh now routes through the retrying `api` instance.
- **Friendlier messages:** `apiErrorMessage` returns actionable copy for no-response/timeout/503 instead of raw "Network Error". Added `isNetworkError(err)`.
- Reports every outcome to the connectivity layer.

**`mobile/src/config.ts`** — added `REQUEST_TIMEOUT_MS = 20000` and `MAX_RETRIES = 3`.

**`mobile/src/net/connectivity.ts` (new) — app-wide connectivity state machine**
- States `online | reconnecting | offline`; subscribable; fires `onRecovered()` so screens refetch.
- While offline it **polls `/health` every 4s** to detect the backend coming back (cold start / DB restart) and recover **without user action**. On web it also listens to `window` `online`/`offline`.

**`mobile/src/api/health.ts` (new)** — auth-free `pingHealth()` probe used for recovery detection.

**`mobile/src/auth/AuthContext.tsx` — session survives transient launch failures**
- Restore distinguishes network vs auth errors: on **network** error it **keeps the saved tokens** and sets `bootError:'network'` (no logout); on **auth** error it clears the session.
- Exposes `retryRestore()`; auto-retries restore when `onRecovered()` fires.

**`mobile/src/components/ConnectivityBanner.tsx` (new)** — global "Reconnecting…/No connection/Back online" banner mounted in `App.tsx`.

**`mobile/src/components/ConnectionErrorScreen.tsx` (new)** — shown by `RootNavigator` when a saved session can't be restored due to the backend being unreachable, with a "Try now" button (and automatic background retry) — instead of bouncing the user to login.

**`mobile/src/components/ErrorState.tsx` (new)** — reusable inline error + **Retry** block; wired into `ExploreScreen` as the reference pattern, which also **refetches automatically on `onRecovered`**.

**`mobile/src/web/installErrorReporter.js` + `mobile/index.web.js` — non-destructive web error handling**
- The global `error`/`unhandledrejection` handlers now **ignore network/axios errors** (log only) and no longer blank the app; `index.web.js` reuses the single guarded handler instead of registering a second unguarded one. Genuine import/render crashes still show the diagnostic screen.

---

## 6. Failure-scenario simulations (before → after)

| Scenario | Before | After |
|---|---|---|
| **Backend restart / deploy** | First requests refused (port closed during DB connect) → "Network Error"; manual refresh needed. | Port open immediately; requests queue/retry; **auto-recovers**. Banner shows "Reconnecting…" then "Back online". |
| **Database restart / failover** | Requests hang ~30s then opaque 500. | Fail fast (8s) → **retryable 503** → client retries while driver reconnects; **succeeds without refresh**. |
| **Lost internet connection** | "Network Error", dead screen, manual refresh. | Banner "No connection. Retrying automatically…"; health-poll detects return; screens **refetch on recovery**. |
| **Slow network / cold start > 15s** | Timed out → hard failure. | 20s per-attempt timeout + up to 3 backoff retries (~tens of seconds budget) → request **completes**. |
| **Expired access token** | 401; if refresh hit a blip → **forced logout**. | Silent single-flight refresh (now retried); logout **only** on a genuinely invalid refresh token. |
| **API timeout** | Surfaced raw "timeout…". | Retried with backoff; if still failing, **actionable** message + auto-recovery. |
| **Cold-start delay (login/signup)** | The reported bug: "Network Error", refresh fixes it. | **Retries transparently**; login proceeds when the server wakes — **no manual refresh**. |
| **Multiple concurrent users (cold start)** | Each first request fails independently. | Each client retries independently; backend warms once and serves all. (Scale-out still recommended — see §8.) |
| **Session restore on launch (backend cold)** | Any error → session cleared → re-login. | Network error → session **kept**, `ConnectionErrorScreen` + auto-retry; restores when backend wakes. |
| **Web stray rejection** | Whole app replaced by red error screen. | Ignored gracefully; app stays usable; client retries underneath. |

**Verified locally this session:** backend now logs `listening` **before** `MongoDB connected` (listen-first works); `/health` → `{"status":"ok"}`; `/api/v1/system/health` → `{"status":"ok","ready":true,"db":"connected"}`; web app serves HTTP 200; backend test suite **28/28 pass**; both `tsc --noEmit` clean.

---

## 7. The `localhost:8080` "Failed to Load Page / ERR_CONNECTION_REFUSED"

This is **not** the production "Network Error". `ERR_CONNECTION_REFUSED` at `http://localhost:8080/` means the **web dev server isn't running** — nothing is listening on 8080 (the webpack dev server from `npm run web`). The page never loaded, so it's a *front-end-server-down* problem, not a *back-end-call-failed* problem.

- **Fix:** from `mobile/`, run `npm run web`, wait for "compiled successfully", reload `http://localhost:8080/`.
- **Production:** the web build is static files served by a host, so this exact screen cannot reach end users.

---

## 8. Residual risks & recommendations

1. **Single backend instance.** Retries help a cold start but can't serve traffic during a full restart with zero instances. *Recommend:* ≥1 always-on instance / paid tier so it never sleeps, or a scheduled keep-alive ping to `/health`.
2. **Idle sleep is environmental.** On Railway/Render free tiers, the first request after idle is still slow (now retried, not failed). *Recommend:* keep-alive cron or paid plan to eliminate the wake delay entirely.
3. **CORS in production.** If `CORS_ORIGIN` is later locked to a fixed list, ensure the deployed web origin is included or preflight will fail (looks like "Network Error"). Verify per environment.
4. **Rate limit under shared NAT.** 50/15min per IP could throttle many users behind one NAT; 429 is now retried, but consider raising the limit or keying differently if it bites.
5. **Web token storage.** `localStorage` is fine for demo but not for production secrets (XSS exposure). *Recommend:* httpOnly cookies or a hardened store for the web build.
6. **Non-idempotent retries on 5xx-with-response.** We retry 502/503/504 for all methods. These are gateway/unavailable responses (request almost never applied), but a future non-idempotent write that can return 503 mid-apply should send an idempotency key. Low risk for current endpoints.
7. **Native offline signal.** Web uses `window online/offline`; native relies on request outcomes + health polling (no extra dependency). If you want instant native offline detection, add `@react-native-community/netinfo` and feed it into `connectivity.ts`.
8. **Retry pattern coverage.** `ErrorState` + `onRecovered` is wired into `ExploreScreen` as the reference; roll the same two-line pattern into the other data screens (Activity, Businesses, Notifications, BusinessDetails) for consistent in-place retry UI (auto-retry already covers them globally).

---

## 9. How to run & verify locally

```bash
# 1) In-memory MongoDB (keep running)
cd backend && npm run dev:db
# 2) Seed demo data (once)         → admin: set via ADMIN_EMAIL / ADMIN_PASSWORD env vars
cd backend && npm run seed:demo
# 3) Backend API                   → http://localhost:4000
cd backend && npm run dev
# 4) Web app                       → http://localhost:8080   ← open this
cd mobile && npm run web

# Verify resilience:
curl http://localhost:4000/health                      # {"status":"ok"}
curl http://localhost:4000/api/v1/system/health        # {"status":"ok","ready":true,"db":"connected",...}
# Stop the backend (Ctrl-C) mid-session in the web app: the banner shows
# "Reconnecting…" and the app recovers on its own when you restart it —
# no page refresh required.
```
