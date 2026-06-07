# FlowOS — Project Status (Single Source of Truth)

> **Last updated:** 2026-06-07 · **Status:** Active development (Phase 2A in progress)
> This document is the canonical reference for anyone joining FlowOS. It describes what the
> product is, how it's built, exactly what's implemented today, and what remains.

---

## 1. Project Overview

### Problem statement
Customers waste significant time standing in physical queues at hospitals, banks, restaurants,
salons, and government offices. Traditional queues lack transparency, real-time position
visibility, and efficient flow management — causing long waits, overcrowding, frustration, and
operational inefficiency.

### Vision
Let people **join queues remotely and track their position in real time** instead of physically
waiting — and give businesses the tools to manage flow efficiently.

### Objectives
- Remote queue join + live position/ETA tracking.
- Instant "it's your turn" notifications.
- Self-service business onboarding and queue operations from a mobile app.
- Real-time synchronization between customers and operators.
- A foundation that can later add appointments, reviews, AI guidance, and analytics.

### Target users
- **Customers** — join/track queues, book appointments, save places, review businesses.
- **Business Owners** — register a business, configure queues, manage staff, view analytics.
- **Staff** — operate the live queue (call/serve/complete).
- **Platform Admins** — oversight, support, moderation.

### Customer flow
```
Register → Login → Explore businesses → Open business → Join queue →
Live tracking (position + ETA, real-time) → "It's your turn" → Served
```

### Business flow
```
Register (owner) → Create business → Business Setup + Activate → Create queue →
Queue Manager (Call Next → Serve → Complete / No-show) → Analytics
```
> The self-service onboarding loop (Setup + Activation) is now implemented — see §8.

---

## 2. Tech Stack

### Mobile (React Native CLI — bare, no Expo)
- **react-native 0.85**, TypeScript (strict)
- **@react-navigation** (native + native-stack + bottom-tabs), react-native-screens, react-native-safe-area-context, react-native-gesture-handler
- **react-native-paper** (Material 3, branded theme) + react-native-vector-icons
- **react-native-keychain** (secure token storage)
- **axios** (API client w/ refresh interceptor)
- **socket.io-client** (real-time)

### Backend (Node.js + Express)
- **express 5**, TypeScript (strict, NodeNext)
- **mongoose 8** (MongoDB ODM)
- **jsonwebtoken** (JWT access + refresh), **bcryptjs**
- **zod 4** (validation/DTOs)
- **socket.io** (real-time)
- **firebase-admin** (FCM — coded, not yet activated)
- **nodemailer** (email — dev console fallback)
- **groq-sdk** (AI assistant)
- **pino** + **pino-http** (structured logging), **helmet**, **cors**, **express-rate-limit**, **multer**, **dotenv**
- **Dev/test:** tsx, eslint, prettier, mongodb-memory-server, supertest, socket.io-client

### Data & infra
- **MongoDB** (local `mongod` or Atlas via `MONGODB_URI`)
- **JWT** auth, **Socket.IO** real-time, **FCM** (planned activation)

---

## 3. High-Level Architecture

### Mobile app architecture
- **Providers (root):** `GestureHandlerRootView → SafeAreaProvider → PaperProvider(theme) → AuthProvider → RootNavigator`.
- **Role-based navigation:** `RootNavigator` gates by auth + role → Auth stack / Customer stack+tabs / Business stack+tabs.
- **State:** `AuthContext` (session, token lifecycle, socket connect/disconnect); screen-local state + refetch on focus (no global store needed yet).
- **Networking:** `src/api/client.ts` (axios + bearer interceptor + single-flight refresh-on-401) and typed `src/api/endpoints.ts`.
- **Realtime:** `src/realtime/socket.ts` (singleton manager) + `useQueueEvents` hook.
- **Secure storage:** refresh+access tokens persisted in Keychain; access token also held in memory.

### Backend architecture
Clean, layered, modular:
```
route → validate(zod) → authenticate → authorize → controller → service → repository → Mongoose
```
- **controllers** — HTTP only.
- **services** — business logic; orchestrate repositories + cross-cutting services.
- **repositories** — the only layer touching Mongoose.
- **cross-cutting services (interface-driven, wired in `container.ts`):** notification (in-app + FCM), realtime (Socket.IO), email (SMTP), storage (local disk), ai (Groq). All swappable; degrade gracefully when unconfigured.
- **API versioning:** everything under `/api/v1`.

```
backend/src/
├── server.ts            boot: env → DB → services → HTTP + Socket.IO
├── app.ts               express app + middleware + error handling
├── container.ts         composition root (swap implementations here)
├── socket.ts            Socket.IO auth + room subscriptions
├── config/              env (zod), db (mongoose)
├── api/v1/index.ts      mounts all module routers
├── middleware/          authenticate, authorize, validate, error
├── lib/                 jwt, password, errors, logger, businessAccess
├── models/              16 Mongoose models
├── modules/<name>/      routes · controller · service · repository · schema
└── services/            notification · realtime · email · storage · ai
```

### Database architecture
MongoDB document store via Mongoose. References by `ObjectId` + `ref` (+ `populate`); rating
aggregates denormalized onto Business; an append-only `analyticsEvents` log powers analytics and
future AI. See §6.

### Authentication architecture
- **JWT access + refresh with rotation + reuse detection.** Access (~15m) in memory; refresh
  (~30d) hashed + stored in `refreshTokens` (TTL-indexed) and persisted client-side in Keychain.
- **RBAC:** global roles (`CUSTOMER`, `STAFF`, `BUSINESS_OWNER`, `PLATFORM_ADMIN`) + business-scoped
  roles via `staffMembers` (`OWNER` > `MANAGER` > `STAFF`), enforced by `assertBusinessRole`.
- **Password reset:** token logic complete; email delivery is a dev console stub.

### Real-time architecture
- Socket.IO attached to the same HTTP server; JWT handshake auth.
- Rooms: `user:<id>` (auto), `queue:<id>`, `business:<id>`.
- **"Signal → fetch":** server emits small change-signals; clients refetch authoritative state.

---

## 4. Current Backend Status (~85%)

### Implemented modules (14)
`auth · users · businesses · queues · entries · notifications · appointments · reviews ·
memberships(staff) · favorites · analytics · ai · support · system`
**Stub (placeholder only):** `media` (uploads), `devices` (folded into notifications).
**Model-only, no endpoints:** `kycRequests`.

### Available APIs (`/api/v1`)
- **System:** `GET /system/health`, `GET /system/config`
- **Auth:** `POST /auth/register|login|refresh|logout|forgot-password|reset-password`, `GET /auth/me`
- **Users:** `GET/PATCH /users/me`, `GET/PATCH /users/me/settings`, `POST /users/me/onboarding-complete`
- **Businesses:** `GET /businesses` (search/geo), `GET /businesses/:id`, `GET /businesses/mine`, `POST /businesses`, `PATCH /businesses/:id`
- **Queues:** `GET /businesses/:id/queues`, `POST /businesses/:id/queues`, `GET /queues/:id`, `PATCH /queues/:id`
- **Entries (engine):** `POST /queues/:id/join`, `GET /entries/me`, `DELETE /entries/:id`, `GET /queues/:id/entries`, `POST /queues/:id/call-next`, `POST /entries/:id/serve|complete|no-show`
- **Notifications:** `GET /notifications`, `POST /notifications/read-all`, `PATCH /notifications/:id/read`, `POST/DELETE /notifications/devices[/:token]`
- **Appointments:** `POST /appointments`, `GET /appointments/me`, `PATCH/DELETE /appointments/:id`, `GET /businesses/:id/appointments`
- **Reviews:** `GET/POST /businesses/:id/reviews`, `PATCH/DELETE /reviews/:id`
- **Staff:** `GET/POST /businesses/:id/staff`, `PATCH/DELETE /memberships/:id`
- **Favorites:** `GET /favorites/me`, `POST /favorites`, `DELETE /favorites/:businessId`
- **Analytics:** `GET /businesses/:id/analytics/summary`, `GET /businesses/:id/analytics`
- **AI Assistant:** `POST /ai/chat`, `GET /ai/conversations[/:id]`
- **Support:** `GET /support/articles`, `POST /support/tickets`, `GET /support/tickets/me[/:id]`

### Authentication flow
`register/login → {user, accessToken, refreshToken}` → access attached by interceptor →
on 401, single-flight `POST /auth/refresh` rotates tokens → `logout` revokes the presented refresh
token; `reset-password` revokes all.

### Queue engine
State machine `WAITING → CALLED → SERVING → COMPLETED` (+ `CANCELLED`/`NO_SHOW`).
- **Position computed**, never stored: `count(WAITING with earlier joinedAt) + 1`.
- **ETA** = `peopleAhead × avgServiceSec` (avgServiceSec self-tunes via EMA on completion).
- **Call-next** = atomic `findOneAndUpdate` (race-safe).
- One active entry per user per queue (partial unique index).
- **Join is guarded:** requires an `OPEN` queue **and** an `ACTIVE` business (non-ACTIVE → 400).
- Emits real-time events + notifications + analytics on every transition.

### Notification system
- In-app `Notification` documents (source of truth) + real-time `notification:new` + FCM dispatch
  via `FcmPushService` (**disabled** until a service account is configured).
- Triggers: queue called, "you're next," appointment booked, staff invite, queue closed.

### Analytics
- Append-only `analyticsEvents`; aggregation endpoints: dashboard summary (24h) and detailed
  window (throughput by day, peak hours, no-show rate, avg wait).

### AI Assistant APIs
- Groq-backed chat behind `IAssistant`; persists `aiConversations`. Returns a safe fallback if
  `GROQ_API_KEY` is unset.

### Support APIs
- Static help articles + user support tickets (`OPEN/IN_PROGRESS/RESOLVED`).

### Staff APIs
- Add staff by email (`MANAGER`/`STAFF`), change role, remove; OWNER membership immutable.

---

## 5. Current Frontend Status (~52%)

### Implemented screens (13)
| Area | Screen | Notes |
|---|---|---|
| Auth | **LoginScreen** | wired (+ Forgot-password link) |
| Auth | **RegisterScreen** | role toggle (Customer / Business) |
| Auth | **ForgotPasswordScreen** | request code → reset password (console email until SMTP) |
| Customer | **ExploreScreen** | search + list active businesses |
| Customer | **BusinessDetailsScreen** | business + queues + **Join** |
| Customer | **ActivityScreen** | live tracking (Socket.IO + 20s poll, live badge) |
| Business | **BusinessesScreen** | dashboard + status chips + **Setup/Activate** CTA + real-time (`dashboard:updated`) |
| Business | **CreateBusinessScreen** | create business (DRAFT) |
| Business | **BusinessSetupScreen** | 7-day hours editor + **ACTIVE/DRAFT** toggle + profile edits |
| Business | **QueueFormScreen** | **create + edit** queue (one screen) |
| Business | **QueueManagerScreen** | live operator view (call/serve/complete/no-show, real-time) |
| Shared | **NotificationsScreen** | in-app feed (real-time `notification:new` + slow poll, live badge) |
| Shared | **ProfileScreen** | profile + logout |

### Navigation structure
- **Auth stack:** Login, Register, ForgotPassword.
- **Customer stack:** tabs (Explore, Activity, Notifications, Profile) + `BusinessDetails` (pushed).
- **Business stack:** tabs (Dashboard, Notifications, Profile) + `CreateBusiness`, `BusinessSetup`, `QueueForm`, `QueueManager` (pushed).

### Completed flows (mobile)
- Customer: register → login → explore → join → **real-time live tracking**.
- Business: register → dashboard → **create business** → **setup + activate** → **create/edit/manage
  queues** → operate queue.
- Account: **forgot password → reset** (console email until SMTP).

### Screens still pending
Splash (spinner only), Onboarding, Appointments, Saved Places, AI Assistant, Settings (editable),
Reviews, dedicated Analytics, Staff Management, Help & Support, Connection Error.

---

## 6. Database Design

### Collections (16)
`users · businesses · staffMembers · queues · queueEntries · appointments · savedBusinesses ·
reviews · notifications · deviceTokens · analyticsEvents · supportTickets · aiConversations ·
categories · refreshTokens · kycRequests`

### Relationships
- `User 1—N Business` (owner) and `User M—N Business` via `staffMembers` (role-scoped).
- `Business 1—N Queues 1—N QueueEntries`.
- `Business 1—N Appointments / Reviews / analyticsEvents`.
- `User 1—N` entries / appointments / favorites / reviews / notifications / deviceTokens / tickets / aiConversations.
- `Favorite` & `Review` are unique per `(user, business)`; reviews drive `business.ratingAvg/ratingCount`.

### Important indexes
- `users.email` unique.
- `businesses`: `2dsphere(location)` + text(name, description); `status`, `category`, `name`.
- `queueEntries`: `{queueId,status,joinedAt}`, `{userId,status}`, **partial-unique** `{queueId,userId}` over active statuses.
- `staffMembers`/`savedBusinesses`/`reviews`: unique compound pairs.
- `notifications`: `{userId,read,createdAt}`.
- `analyticsEvents`: `{businessId,type,createdAt}`.
- `deviceTokens.token` unique; `refreshTokens.expiresAt` TTL.

---

## 7. Real-Time System

### Socket rooms
- `user:<id>` — auto-joined on connect (personal events, e.g. "it's your turn").
- `queue:<id>` — customers + operators of that queue (`subscribe:queue`).
- `business:<id>` — dashboards (`subscribe:business`).

### Events (server → client)
- `queue_joined`, `queue_updated`, `queue_next` (room + called user), `queue_paused`,
  `queue_resumed`, `queue_completed`.
- `notification:new` (user room), `dashboard:updated` (business room).

### Reconnection strategy
- Auto-reconnect with backoff; **re-subscribe to all tracked rooms on (re)connect**; refresh JWT
  before each reconnect attempt; refetch state on connect; live/reconnecting UI badge.

### Verified
- `npm run smoke:socket` → **5/5** (handshake auth, `queue_joined`, `queue_next` to the right user,
  `queue_paused`, unauthenticated rejection).

### Current limitations
- **Single-instance only** (no Socket.IO Redis adapter → not horizontally scalable yet).
- **Frontend consumption is now full for the live surfaces:** Activity, Queue Manager,
  **Notifications feed (`notification:new`)**, and **business Dashboard (`dashboard:updated`)** are all
  socket-driven with a slow poll as a safety net. (Remaining screens have no live data to consume.)

---

## 8. Completed Work Log

- **Authentication** — Register/login/refresh(rotation+reuse-detection)/logout, bcrypt, JWT
  access+refresh, RBAC (global + business-scoped), password-reset token logic, `GET /me`.
  Mobile: Login/Register screens, Keychain storage, role-based routing, silent refresh.
- **Business Dashboard** — `BusinessesScreen` lists owned businesses with a 24h analytics summary,
  per-business queues, "Manage" → Queue Manager, refetch on focus.
- **Business Creation** — `POST /businesses` (auto-creates OWNER membership; DRAFT status).
  Mobile: `CreateBusinessScreen` (name, category chips, description, address, phone, optional
  lat/lng) with validation/loading/error/success; reached via dashboard FAB.
- **Queue Creation** — `POST /businesses/:id/queues`. Mobile: `QueueFormScreen` (create mode).
- **Queue Editing** — `PATCH /queues/:id`. Mobile: same `QueueFormScreen` (edit mode, prefilled);
  status handled via create→patch when non-OPEN at creation.
- **Queue Manager** — `GET /queues/:id/entries` + `call-next/serve/complete/no-show`, atomic
  call-next, live operator list. Mobile: `QueueManagerScreen` (real-time + slow poll fallback).
- **Real-time queue updates** — Socket.IO rooms + the six `queue_*` events; client `socket.ts`
  manager + `useQueueEvents`; Activity + Queue Manager update instantly; reconnect-safe.
- **Notifications** — in-app `Notification` documents + feed API + `notification:new` emit + FCM
  dispatch service (coded). Mobile: `NotificationsScreen` (**real-time + slow poll, live badge**).
- **Business Setup + Activation** *(Phase 2A)* — Mobile `BusinessSetupScreen` (7-day hours editor +
  ACTIVE/DRAFT toggle + profile edits) wired to the existing `PATCH /businesses/:id`; dashboard status
  chips + Setup/Activate CTA. Closes the self-service onboarding loop (DRAFT → ACTIVE → discoverable).
- **Join ACTIVE guard** *(Phase 2A)* — `entriesService.join` blocks joining a queue whose business is
  not `ACTIVE`.
- **Real-time client consumption** *(Phase 2A)* — `useNotificationEvents` + `useDashboardEvents` hooks;
  `socket.ts` now tracks business rooms + re-subscribes on reconnect; Notifications feed and Dashboard
  refetch on event with a live/reconnecting badge.
- **Forgot-Password** *(Phase 2A)* — Mobile `ForgotPasswordScreen` (request code → reset) + `resetPassword`
  API wrapper, wired to existing `/auth/forgot-password` + `/auth/reset-password` (console email until SMTP).
- **MongoDB integration** — 16 Mongoose models + indexes; connection helper; seed script;
  in-memory test harness.
- **API integrations** — typed `endpoints.ts` covering auth, businesses, queues, entries,
  notifications; axios interceptors; consistent error envelope surfaced via `apiErrorMessage`.
- **Version control** — repo initialized as a single monorepo (backend + mobile); baseline commit on
  branch `main`.

### Verification artifacts
- `npm run smoke` → **20/20** (auth → business → activate → queue → join → position/ETA →
  call→serve→complete → notification persisted → RBAC → **join blocked when business not ACTIVE**).
- `npm run smoke:socket` → **5/5**.
- `tsc --noEmit` clean (backend + mobile); Metro bundle succeeds.

---

## 9. Pending Work

### Critical (blocks a usable two-sided MVP)
- ~~**Business Setup + Activation UI**~~ — ✅ **done** (Phase 2A; see §8).
- **FCM background push** — notifications only arrive while the app is open. *(Blocked: needs a Firebase
  service account + `google-services.json`; mobile has no `@react-native-firebase` yet.)*

### High priority
- ~~**Forgot-Password screen**~~ — ✅ screen **done**; still needs a **real SMTP provider** for delivery.
- ~~**Notifications real-time consumption** + dashboard real-time~~ — ✅ **done** (Phase 2A).
- ~~**Block joining non-ACTIVE businesses**~~ — ✅ **done** (Phase 2A; smoke-covered).
- **Device-token registration on login** (`POST /notifications/devices`) — coupled to FCM client.
- **Automated test suite + CI**.

### Medium priority
- Appointments UI, Reviews UI, Saved Places UI, Settings (editable), Onboarding/Splash, dedicated
  Analytics screen, Staff Management UI.

### Low priority
- AI Assistant UI, Help & Support UI, Connection Error screen, image uploads (`media`), KYC flow,
  category validation against the categories collection, env-based mobile API base URL.

---

## 10. MVP Completion Status (approximate)

| Area | % | Notes |
|---|---|---|
| Backend | **~86%** | 14 modules + ~55 endpoints; join-ACTIVE guard added; FCM/email stubbed |
| Frontend | **~52%** | 13 of ~27 screens; onboarding loop + Forgot-Password done |
| Database | **~95%** | all collections + indexes |
| Real-time | **~95%** | backend done; client consumption now full on all live surfaces |
| Notifications | **~50%** | in-app real-time ✅, push ❌ |
| Testing | **~22%** | smoke (20/20) + socket-smoke (5/5); no unit/CI |
| **Overall** | **~63%** | strong backend, frontend catching up |

---

## 11. Development Roadmap

### Phase 2A — Self-service MVP (current)
- ✅ Business Setup + Activation.
- ✅ Forgot-Password screen (email provider/SMTP still pending).
- ✅ Cheap correctness wins: join-ACTIVE guard; Notifications/dashboard socket consumption.
- ⬜ FCM push + device-token registration on login *(blocked on Firebase credentials + native install)*.

### Phase 2B — Feature surfacing (backend already done)
- Appointments UI, Reviews UI, Saved Places UI, Settings, Onboarding/Splash.

### Phase 3 — Depth + hardening
- Dedicated Analytics dashboard, Staff Management UI, AI Assistant UI, Help & Support.
- Test suite + CI/CD, Sentry monitoring, **Socket.IO Redis adapter** (multi-instance), image
  uploads, env config, optional Postgres evaluation.

---

## 12. Immediate Next Tasks

> Items 1, 2, 5 below are ✅ done (Phase 2A); item 4's screen is done, SMTP pending. Remaining focus:

1. ✅ ~~Business Setup~~ — 7-day hours editor + edit existing setup (`PATCH /businesses/:id`).
2. ✅ ~~Business Activation~~ — `status: 'ACTIVE'` toggle makes the business discoverable in Explore.
3. **FCM Push Notifications** *(blocked — external)* — install `@react-native-firebase/messaging`,
   register device token on login (`POST /notifications/devices`), activate `FcmPushService` with a
   Firebase service account + `google-services.json`.
4. **SMTP provider** — wire a real email service so Forgot-Password (screen ✅) delivers a code by email
   instead of the dev console.
5. ✅ ~~Notifications real-time consumption~~ — feed + dashboard now consume `notification:new` /
   `dashboard:updated`.

### Next unblocked work (no external credentials needed)
- **Automated test suite + CI** (Jest/Supertest + RN component tests + GitHub Actions).
- **Phase 2B feature surfacing** — Appointments / Reviews / Saved Places / Settings UIs (backend done).

---

## 13. Known Technical Debt
- **Missing automated tests** — only manual smoke scripts; no Jest/Supertest unit/integration suite, no RN component tests.
- **No CI/CD** — no pipeline for lint/typecheck/test/build.
- **No monitoring** — no Sentry/error tracking or metrics.
- **No Socket.IO Redis adapter** — single-instance only; can't scale horizontally.
- **No image uploads** — `media` module and `IStorageService` exist but unwired (avatars/logos).
- **Email/FCM/AI** are stubs/optional until configured (by design, but blocks reset email + push).
- **No multi-document transaction** around business+membership creation (standalone Mongo).
- **Validation gap** — business `category` is free-text (not checked against `categories`). *(Join now
  verifies the business is ACTIVE — fixed in Phase 2A.)*
- **Mobile API base URL hardcoded** (`10.0.2.2`/`localhost`) — needs env config for devices/prod.
- **Node engine warning** — RN 0.85 prefers Node ≥20.19; current dev env is 20.18 (works, warns).
- **Minor duplication** — `idParam`/`businessIdParam` zod schemas repeated per module.

---

## 14. Future Enhancements
- **AI features** — ML-backed wait-time prediction and peak-hour forecasting trained on
  `analyticsEvents`; richer Groq assistant (queue guidance, FAQs) behind the existing interface.
- **Analytics improvements** — charts (throughput, peak hours, no-show), per-staff metrics,
  exportable reports, customer-level insights.
- **Staff management improvements** — invitations to non-existent users (email), shift scheduling,
  granular permissions, audit logs.
- **Multi-location support** — businesses with multiple branches/locations and per-location queues.
- **Enterprise scaling** — Socket.IO Redis adapter, horizontal scaling, rate-limit tuning,
  Postgres option, SSO, white-labeling, KYC/verification, payments for premium tiers.

---

## Appendix — How to run

**Backend**
```bash
cd backend
npm install
cp .env.example .env          # set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm run seed                  # demo accounts (owner@/staff@/customer@flowos.test : password123)
npm run dev                   # http://localhost:4000/api/v1
npm run smoke && npm run smoke:socket   # verify core + real-time
```

**Mobile**
```bash
cd mobile
npm install
# Android emulator running; app targets 10.0.2.2:4000
npx react-native run-android
```
> Recommended: Node ≥20.19, JDK 17 for the Android build.

API reference & deeper backend docs: `backend/README.md`.
