# FlowOS — Complete Technical Documentation & Handover Report

> **Document type:** Technical reference / project handover
> **Prepared by:** Senior Software Architect (codebase analysis)
> **Date:** 2026-06-07
> **Last updated:** 2026-06-08 — added the **owner image-upload feature** (media module implemented), the `/uploads` cross-origin fix, and the Hyderabad demo dataset. See Phase 2B (§4) and the updated §3, §5, §7, §8, §10.
> **Audience:** Engineers, technical leads, and (Section 15) non-technical stakeholders.

---

## ⚠️ Important accuracy note (read first)

The documentation brief listed example technologies — **Prisma, SQLite/PostgreSQL, Redis, Docker, "web-first app"**. FlowOS does **not** use those. This report documents the **actual** implementation. Key corrections, clearly marked:

| Brief assumed | FlowOS reality |
|---|---|
| Prisma ORM | **Mongoose 8** ODM |
| SQLite / PostgreSQL (SQL) | **MongoDB** (document database) |
| Redis | **Not used** (single-instance Socket.IO; noted as future scaling work) |
| Docker | **Not used** (no containerization yet) |
| Web-first app, mobile later | **React Native (mobile-first) codebase**, which *currently runs in the browser* via **React Native Web**; native Android/iOS are scaffolded but need a local toolchain |

Anything inferred rather than directly verified in code is marked **[Assumption]**.

---

## 1. Project Overview

### Project Name
**FlowOS** — a virtual queue management platform ("skip the line").

### Problem Statement
Customers waste significant time physically waiting in queues at hospitals, banks, restaurants, salons, and government offices. Traditional queues lack transparency, real-time position visibility, and efficient flow management — causing long waits, overcrowding, frustration, and operational inefficiency.

### Business Goals
- Let customers **join queues remotely** and **track position + ETA in real time**.
- Give businesses **self-service onboarding** and **live queue operation** tools.
- Build an extensible foundation for appointments, reviews, analytics, and AI guidance.
- Create an **append-only analytics event log** as the basis for future ML wait-time prediction.

### Target Users
- **Customers** — join/track queues, book appointments, save places, review businesses.
- **Business Owners** — register a business, configure queues, manage staff, view analytics, delete a business.
- **Staff** — operate the live queue (call/serve/complete/no-show).
- **Platform Admins** — oversight, support, moderation (role exists; admin UI is future work).

### Key Features
- Remote queue join with **computed live position** + **self-tuning ETA**.
- **Real-time** updates and "it's your turn" notifications over Socket.IO.
- **Business Setup + Activation** (DRAFT → ACTIVE discoverability gate).
- **Explore** with text search and **"Near me"** geo search.
- **Role-based access control** (global + business-scoped roles).
- **JWT auth** with refresh-token rotation and reuse detection.
- **In-app notifications** (real-time), with FCM push **coded but not activated**.
- **Analytics** dashboards (24h summary + detailed windows).
- **AI assistant** (Groq) behind an interface, with safe fallback.
- **Delete Business** (owner-only, cascading).
- **Owner image uploads** — business thumbnail upload (multer + local-disk storage), served statically and shown across Explore/Details.

### Expected Future Scope
FCM background push activation, real SMTP email, dedicated Analytics/Staff/Appointments/Reviews UIs, AI assistant UI, cloud/object image storage (S3-style), multi-instance scaling (Socket.IO Redis adapter), KYC/verification, payments, multi-location support, native mobile store releases.

---

## 2. Architecture Overview

### 2.1 Overall system architecture
FlowOS is a **client–server** system:

```
┌──────────────────────────┐         HTTPS (REST, /api/v1)        ┌──────────────────────────────┐
│  Client (React Native)   │  ─────────────────────────────────▶ │  Backend (Node.js + Express)  │
│  • Native: Android / iOS │                                       │  layered, modular monolith    │
│  • Web: React Native Web │  ◀───── WebSocket (Socket.IO) ─────▶ │  + Socket.IO on same server   │
└──────────────────────────┘     real-time "signal → fetch"       └───────────────┬──────────────┘
                                                                                   │ Mongoose
                                                                                   ▼
                                                                          ┌──────────────────┐
                                                                          │  MongoDB          │
                                                                          └──────────────────┘
External (optional, interface-driven): FCM (push), SMTP (email), Groq (AI), local disk (storage)
```

- **One client codebase** (React Native) targets native and web.
- **Backend** is a **modular monolith**: clean layering, dependency-injected cross-cutting services, versioned REST API + Socket.IO.
- **Real-time model:** "**signal → fetch**" — the server emits small change-signals; clients refetch authoritative state via REST. This keeps socket payloads tiny and the REST API the single source of truth.

### 2.2 Frontend architecture
- **Provider tree (root):** `GestureHandlerRootView → SafeAreaProvider → PaperProvider(theme) → AuthProvider → RootNavigator`.
- **Role-based navigation:** `RootNavigator` branches on auth + role → Auth stack / Customer stack+tabs / Business stack+tabs.
- **State:** `AuthContext` holds the session + token lifecycle + socket connect/disconnect + device-token registration. Screens use local state with refetch-on-focus; no global store is needed yet.
- **Networking:** `src/api/client.ts` (axios instance with bearer interceptor + single-flight refresh-on-401) and typed `src/api/endpoints.ts`.
- **Realtime:** `src/realtime/socket.ts` (singleton manager: room re-subscribe on reconnect, JWT refresh on reconnect) + hooks `useQueueEvents`, `useNotificationEvents`, `useDashboardEvents`.
- **Secure storage:** Keychain on native; `localStorage` on web (`tokens.web.ts` resolved by `.web.ts` extension).
- **Web target:** webpack + react-native-web alias mounts the same `App` into the DOM.

### 2.3 Backend architecture
Clean, layered, modular monolith. Every request flows:

```
route → validate(zod) → authenticate → authorize → controller → service → repository → Mongoose → MongoDB
```

- **controllers** — HTTP only (parse req, call service, shape response).
- **services** — business logic; orchestrate repositories + cross-cutting services.
- **repositories** — the only layer that touches Mongoose models (one repo per model).
- **cross-cutting services** (interface-driven, wired in `container.ts`): notification (in-app + FCM), realtime (Socket.IO), email (SMTP), storage (local disk), AI (Groq). All swappable; all degrade gracefully when unconfigured.
- **API versioning:** everything under `/api/v1`.

### 2.4 Database architecture
- **MongoDB** document store via **Mongoose 8** ODM.
- References by `ObjectId` + `ref` (+ `populate` where needed).
- Rating aggregates are **denormalized** onto `Business` (maintained by the reviews service).
- An **append-only `analyticsEvents`** log powers analytics and future AI.
- Indexes are defined per model (geo, text, compound, partial-unique, TTL) — see Section 6.

### 2.5 Communication flow between components
1. **REST (authoritative):** Client → `/api/v1/...` → layered backend → Mongo → JSON envelope back.
2. **Real-time (signals):** On state changes, services emit Socket.IO events to rooms (`user:<id>`, `queue:<id>`, `business:<id>`). Clients receiving a signal **refetch** via REST.
3. **Notifications:** writes a `Notification` document (source of truth) + emits `notification:new` to the user room + dispatches FCM (when configured).

### 2.6 Request–response lifecycle (REST)
1. Client attaches `Authorization: Bearer <accessToken>` (axios request interceptor).
2. `helmet` → `cors` → `express.json` → `pino-http` request logging.
3. Route matched under `/api/v1`; per-route middleware runs: optional rate-limit → `validate(zod)` (body/params/query, with coercion) → `authenticate` (or `optionalAuthenticate`) → `authorize`/business-scoped role check.
4. **controller** calls **service** → **repository** → Mongoose → MongoDB.
5. Side effects: emit realtime signal, persist notification, append analytics event.
6. Response shaped as JSON; errors thrown anywhere bubble to the **central error handler** → consistent envelope `{ error: { code, message, details? } }`.
7. On `401` for a non-auth call, the client runs a **single-flight** `POST /auth/refresh`, retries the original request once, or forces logout.

---

## 3. Tech Stack Documentation

> For each: **why chosen · problem solved · how it works internally · where used**. Items from the brief that are **not** used are marked accordingly.

### Backend

**Node.js (≥20.19 recommended; dev on 20.18)**
- *Why:* single language (TypeScript) across client+server; huge ecosystem; non-blocking I/O suits a real-time, I/O-bound queue app.
- *Solves:* unified stack, fast iteration, native WebSocket support.
- *Internally:* event-loop, libuv async I/O.
- *Where:* the entire backend runtime; `tsx` runs TS directly in dev, `tsc` builds to `dist/`.

**Express 5 (TypeScript, NodeNext)**
- *Why:* minimal, ubiquitous HTTP framework; Express 5 auto-forwards async handler rejections to error middleware.
- *Solves:* routing, middleware composition, request parsing.
- *Internally:* middleware chain; each layer calls `next()`; errors short-circuit to the error handler.
- *Where:* `app.ts` (app factory), `api/v1/index.ts` (router aggregation), every module's `*.routes.ts`.

**Mongoose 8 + MongoDB** *(replaces the brief's Prisma + SQL)*
- *Why:* flexible document model fits evolving, nested domain data (hours, settings, GeoJSON); first-class geo + TTL + partial indexes; rapid schema iteration.
- *Solves:* schema modeling, validation, indexing, population, and the geo/2dsphere "near me" queries.
- *Internally:* schemas compile to models; queries build BSON sent to MongoDB; indexes enforced server-side (unique, partial-unique, TTL, 2dsphere, text).
- *Where:* `models/*.model.ts` (16 models), accessed only via `modules/*/*.repository.ts`; connection in `config/db.ts`.

**TypeScript (strict)**
- *Why:* type-safety across a large surface; shared domain enums; refactor confidence.
- *Solves:* runtime-class bugs caught at compile time; self-documenting contracts.
- *Internally:* structural typing, compiled by `tsc`/transpiled by `tsx`/`ts-jest`.
- *Where:* all backend + mobile source; shared enums in `backend/src/types/index.ts`.

**jsonwebtoken (JWT)**
- *Why:* stateless access tokens; standard, well-supported.
- *Solves:* authenticated, tamper-evident sessions without server session storage for access.
- *Internally:* HMAC-signed `{header}.{payload}.{signature}`; verified with the secret.
- *Where:* `lib/jwt.ts` (sign/verify access+refresh), `middleware/authenticate.ts`, socket handshake.

**bcryptjs**
- *Why:* slow, salted password hashing resistant to brute force.
- *Solves:* secure password + refresh-token-at-rest storage.
- *Internally:* salted Blowfish-based KDF, cost factor 10.
- *Where:* `lib/password.ts` (hash/compare password; hash/compare opaque tokens).

**zod 4**
- *Why:* runtime validation + static type inference from one schema.
- *Solves:* input validation, coercion, and typed DTOs; also validates environment config.
- *Internally:* parser combinators; `.parse()` throws `ZodError` on mismatch.
- *Where:* `middleware/validate.ts`, every `*.schema.ts`, `config/env.ts`.

**Socket.IO (server)**
- *Why:* reliable real-time with rooms, auto-reconnect, transport fallback.
- *Solves:* live position/ETA, "it's your turn," dashboard updates.
- *Internally:* WebSocket (with polling fallback) + rooms; JWT verified in a handshake middleware.
- *Where:* `socket.ts` (server + auth + room subscribe handlers), `services/realtime/socket.realtime.ts` (emitter), wired in `container.ts`.

**firebase-admin (FCM)** — *coded, not activated*
- *Why:* background push to devices when the app is closed.
- *Solves:* delivery of "it's your turn" beyond in-app/foreground.
- *Internally:* server SDK sends to FCM device tokens.
- *Where:* `services/notification/fcm.notification.ts`; **disabled** until a service account is configured (`FIREBASE_SERVICE_ACCOUNT_PATH`).

**nodemailer (SMTP)** — *dev console fallback*
- *Why:* transactional email (password reset).
- *Where:* `services/email/smtp.email.ts`; logs to console until SMTP env vars are set.

**groq-sdk (AI)**
- *Why:* fast LLM inference for the assistant.
- *Where:* `services/ai/groq.assistant.ts` behind `IAssistant`; returns a safe fallback if `GROQ_API_KEY` is unset.

**pino + pino-http**
- *Why:* fast structured JSON logging.
- *Where:* `lib/logger.ts`, request logging in `app.ts`.

**helmet, cors, express-rate-limit, multer, dotenv**
- *helmet:* security headers. *cors:* cross-origin control. *express-rate-limit:* brute-force throttling on auth routes. *multer:* multipart image uploads — **implemented** in the media module (`memoryStorage`, 5 MB limit, image MIME filter; field `file`). *dotenv:* env loading (via `import 'dotenv/config'` in `config/env.ts`).

**Redis / Docker** — **Not used.** Single-instance Socket.IO (horizontal scaling via a Redis adapter is future work); no containerization yet.

### Frontend

**React 19 + React Native 0.85 (bare CLI, no Expo)**
- *Why:* one codebase for Android, iOS, and (via RN Web) the browser; native performance.
- *Solves:* cross-platform UI from shared components.
- *Internally:* React reconciler renders to native views (Fabric) on device, and to DOM via react-native-web on web.
- *Where:* `mobile/App.tsx`, `mobile/src/**`.

**react-native-web + webpack** *(added so the app runs in a browser now)*
- *Why:* demo/run the mobile app in a browser without the Android toolchain.
- *Solves:* `react-native` → `react-native-web` aliasing; DOM mount via `react-dom`.
- *Where:* `mobile/webpack.config.js`, `mobile/index.web.js`, `mobile/web/index.html`, web shims in `mobile/src/web/*`, `mobile/src/shims/*`, `mobile/src/storage/tokens.web.ts`.

**@react-navigation (native-stack + bottom-tabs)** — role-based navigation trees.
**react-native-paper (Material 3)** — themed UI components; **react-native-vector-icons** for icons.
**axios** — REST client with interceptors (`src/api/client.ts`).
**socket.io-client** — realtime manager (`src/realtime/socket.ts`).
**react-native-keychain** — secure native token storage (web uses `localStorage`).

### Tooling / Test
- **tsx** (dev runtime), **eslint** (flat config on backend, legacy on mobile), **prettier**.
- **Jest + Supertest** (backend) and **Jest + @react-native/jest-preset** (mobile).
- **mongodb-memory-server** (in-memory MongoDB for tests + the `dev:db` local database).
- **GitHub Actions** CI (`.github/workflows/ci.yml`).

---

## 4. Phase-wise Development Documentation

> Reconstructed from the code, the completed-work log, and this session's commits. Pre-2A history is summarized **[Assumption: exact original sequencing inferred]**; Phase 2A is precise (committed this session).

### Phase 0 — Foundation & Setup
- **Objective:** scaffold a strict-TypeScript, layered backend and a bare RN app.
- **Implemented:** Express app factory (`app.ts`), boot sequence (`server.ts`), zod-validated env (`config/env.ts`), Mongo connection (`config/db.ts`), structured logging (`lib/logger.ts`), typed errors (`lib/errors.ts`) + central error middleware, zod `validate` middleware, **composition root** (`container.ts`), shared types/enums (`types/index.ts`).
- **Config:** `tsconfig.json` (NodeNext, strict), `.eslintrc`/prettier, `.env.example`.
- **Security:** consistent error envelope, helmet/cors, env validation fail-fast.
- **Dependencies:** express, mongoose, zod, pino, helmet, cors, dotenv, tsx, typescript.

### Phase 1 — Authentication & RBAC
- **Objective:** secure, stateless auth with refresh rotation and role-based access.
- **Modules:** `auth`, `users`. **Models:** `users`, `refreshTokens`.
- **APIs:** `POST /auth/register|login|refresh|logout|forgot-password|reset-password`, `GET /auth/me`; `GET/PATCH /users/me`, `GET/PATCH /users/me/settings`, `POST /users/me/onboarding-complete`.
- **Security:** bcrypt password hashing; JWT access (~15m) + refresh (~30d, hashed + TTL-indexed) with **rotation + reuse detection**; RBAC (global `authorize` + business-scoped `assertBusinessRole`); password-reset token logic; rate-limited auth routes.
- **Mobile:** Login/Register screens, Keychain storage, role-based routing, silent refresh.

### Phase 2 — MVP Core (two-sided platform)
- **Objective:** the end-to-end queue experience + supporting modules.
- **Modules:** `businesses`, `queues`, `entries` (queue engine), `notifications`, `analytics`, `ai`, `support`, `memberships` (staff), `favorites`, `appointments`, `reviews`, `system`; stubs `media`, `devices` *(at this phase; `media` is implemented in Phase 2B)*.
- **Models:** + `businesses, queues, queueEntries, staffMembers, notifications, deviceTokens, analyticsEvents, appointments, reviews, savedBusinesses, supportTickets, aiConversations, categories, kycRequests` (16 total).
- **Queue engine:** state machine `WAITING→CALLED→SERVING→COMPLETED` (+ `CANCELLED`/`NO_SHOW`); computed position; EMA-tuned ETA; atomic call-next; partial-unique "one active entry per user per queue"; emits realtime + notifications + analytics on every transition.
- **Real-time:** Socket.IO rooms + `queue_*` events; client manager + `useQueueEvents`.
- **Mobile:** Explore, BusinessDetails, Activity (live), Businesses(Dashboard), CreateBusiness, QueueForm, QueueManager, Notifications, Profile.
- **Verification:** smoke + socket-smoke scripts.

### Phase 2A — Self-service MVP completion (this session)
Each item below is committed locally (6 commits on `main`):
- **Business Setup + Activation** — `BusinessSetupScreen` (7-day hours editor + ACTIVE/DRAFT toggle + profile edits) wired to existing `PATCH /businesses/:id`; dashboard status chips + CTA. Closes DRAFT→ACTIVE→discoverable loop.
- **Join-ACTIVE guard** — `entriesService.join` blocks joining a queue whose business isn't ACTIVE (smoke + jest covered).
- **Real-time client consumption** — `useNotificationEvents` + `useDashboardEvents`; `socket.ts` tracks business rooms + re-subscribes; Notifications feed + Dashboard now socket-driven with a live badge.
- **Forgot-Password UI** — two-phase `ForgotPasswordScreen` + `resetPassword` API wrapper.
- **Device-token registration** — `src/push/*` lifecycle wired into `AuthContext` (register on login gated by `pushEnabled`, remove on logout); FCM token source is the only remaining plug-in.
- **Delete Business** — `DELETE /businesses/:id` (owner-only, cascade to queues/entries/staff) + confirm-dialog button in Business Setup.
- **Location search** — Explore "Near me" (geolocation → `lat/lng/radiusKm` → existing geo query).
- **Splash + images** — branded `Splash`, Login hero, business cover images on Explore/Details.
- **React Native Web** — the bare RN app now runs in a browser (webpack + rn-web + web shims).
- **Local dev DB** — `dev:db` runs MongoDB via the `mongodb-memory-server` binary (no install).
- **Testing + CI** — backend Jest/Supertest (21 tests), mobile Jest (13 tests), ESLint 9 flat config, GitHub Actions pipeline.
- **Dependencies installed:** jest, ts-jest, @types/jest (backend); react-native-web, react-dom, webpack, webpack-cli, webpack-dev-server, babel-loader, html-webpack-plugin (mobile).

### Phase 2B — Owner image uploads + demo dataset (this session, 2026-06-08)
- **Media upload endpoint (implemented the stub):** `POST /api/v1/media` — `authenticate` → `multer` (`memoryStorage`, 5 MB limit, image-only MIME filter) → `LocalStorageService.save()` → returns an **absolute** URL `201 {url, key}`. Files: `modules/media/media.routes.ts`, `modules/media/media.controller.ts`, mounted in `api/v1/index.ts`.
- **Business `logoUrl` wiring:** added `logoUrl` (URL) to `createBusinessSchema` and to `businessesService.register` (it already existed on the `Business` model + `PATCH`).
- **Static-uploads cross-origin fix:** Helmet's default `Cross-Origin-Resource-Policy: same-origin` blocked the web app (`:8080`) from rendering images served by the API (`:4000`). `app.ts` now sets `Cross-Origin-Resource-Policy: cross-origin` **for the `/uploads` route only** (API keeps the stricter default). This was the root cause of "uploaded image not displaying."
- **Mobile thumbnail picker:** `components/ThumbnailPicker.web.tsx` (browser file-picker → `FormData` → `mediaApi.upload` → preview) and `components/ThumbnailPicker.tsx` (native URL-paste fallback); `mediaApi.upload(form)` in `api/endpoints.ts`. Wired into `CreateBusinessScreen` and `BusinessSetupScreen` (sends `logoUrl`).
- **Hyderabad demo dataset:** idempotent `scripts/seed-four-businesses.ts` seeds the core demo businesses (restaurant, salon, hospital/clinic, education, banks) — each ACTIVE with category-related services and a real Hyderabad/curated image (skips-if-name-exists; ensures the `owner@flowos.test` account).
- **Verification:** backend + mobile `tsc` clean; `/media` returns `201`/`401`; uploads response confirmed to carry `Cross-Origin-Resource-Policy: cross-origin`; demo businesses verified live via the Explore API.

---

## 5. Module Documentation

> Each module follows `routes → controller → service → repository (→ Mongoose)`. Cross-cutting services are consumed via interfaces from `container.ts`.

### Authentication (`modules/auth`)
- **Purpose:** registration, login, token rotation, logout, password reset, current user.
- **Internal working:** `login/register` → bcrypt verify/hash → issue access+refresh; refresh tokens are **hashed** and stored. `refresh` validates the presented token against active hashes, **revokes it**, and issues a new pair (rotation); a presented-but-revoked token signals **reuse** → rejected. `reset-password` revokes all tokens.
- **Data flow:** `auth.service` ↔ `auth.repository` (refreshTokens) + `users.repository`.
- **APIs:** see Section 7. **DB:** `users`, `refreshTokens`.

### User (`modules/users`)
- **Purpose:** profile + settings + onboarding flag.
- **Responsibilities:** read/update own profile and notification settings.
- **DB:** `users`.

### Business (`modules/businesses`)
- **Purpose:** registration, setup/activation, ownership, Explore (search + geo), **delete (cascade)**.
- **Internal working:** `register` creates a DRAFT business + an OWNER `staffMember`. `update` requires MANAGER+ (`assertBusinessRole`), supports `status` and `hours`. `explore` filters `status:'ACTIVE'` with optional text + `$near` geo. `remove` (OWNER) cascades to queues → entries → memberships → business.
- **Connected:** queues, entries, memberships, analytics, reviews. **DB:** `businesses` (+ cascade collections).

### Queue Management (`modules/queues` + `modules/entries`)
- **Purpose:** queue definitions + the live **queue engine**.
- **Responsibilities:** create/edit queues (operator); join/leave (customer); call-next/serve/complete/no-show (operator).
- **Internal working (engine):** position = `count(WAITING earlier) + 1` (never stored); ETA = `peopleAhead × avgServiceSec`; `avgServiceSec` self-tunes via **EMA** (`0.7·old + 0.3·observed`) on completion; **call-next** is an atomic `findOneAndUpdate`; join is guarded (queue OPEN **and** business ACTIVE; partial-unique index prevents double-join). Every transition emits realtime + notifications + analytics.
- **DB:** `queues`, `queueEntries`.

### Notification (`modules/notifications` + `services/notification`)
- **Purpose:** in-app feed + device-token registration + dispatch.
- **Internal working:** `InAppNotificationService` writes a `Notification` document (source of truth), emits `notification:new` to the user room, and calls `FcmPushService` (no-op until configured).
- **DB:** `notifications`, `deviceTokens`.

### Analytics (`modules/analytics`)
- **Purpose:** dashboards from the append-only event log.
- **Internal working:** aggregates `analyticsEvents` into a 24h summary (waiting/completed/no-shows/avg wait/no-show rate) and a detailed window (throughput by day, peak hours).
- **DB:** `analyticsEvents` (read), `queueEntries` (current state).

### AI Assistant (`modules/ai` + `services/ai`)
- **Purpose:** Groq-backed chat, persisted conversations, safe fallback.
- **DB:** `aiConversations`.

### Staff / Memberships (`modules/memberships`)
- **Purpose:** add staff by email (MANAGER/STAFF), change role, remove; OWNER membership is immutable.
- **DB:** `staffMembers`.

### Media (`modules/media` + `services/storage`)
- **Purpose:** authenticated image upload for business thumbnails (owner-set `logoUrl`).
- **Internal working:** `POST /media` → `multer` parses one `file` (memory buffer, ≤5 MB, image MIME only) → `storage.save({buffer,originalName,mimeType})` (the DI'd `IStorageService`; `LocalStorageService` writes under `UPLOAD_DIR` and returns `{key, url:/uploads/<key>}`) → controller returns an **absolute** URL. Served back via `app.use('/uploads', …)` static with a `cross-origin` resource policy.
- **DB:** none (filesystem via `IStorageService`). Swappable for S3-style storage by changing the `container.ts` binding.

### Supporting modules
- **Favorites** (`savedBusinesses`), **Appointments** (`appointments`), **Reviews** (`reviews`, maintains denormalized rating on `Business`), **Support** (`supportTickets` + static articles), **System** (`/health`, `/config`). **Devices** is a partial (`devices` model exists; registration wired client-side, FCM token pending).

### Admin Module
- **[Assumption]** No dedicated admin module/UI yet; the `PLATFORM_ADMIN` role exists and **bypasses business-scoped checks** (`assertBusinessRole`). Admin tooling is future scope.

---

## 6. Database Documentation

> **Engine:** MongoDB. **ODM:** Mongoose. **No Prisma / no SQL** — there is **no `schema.prisma`**; schemas are defined in `backend/src/models/*.model.ts`. "Tables" = collections; "rows" = documents; "primary key" = `_id` (ObjectId); "foreign key" = `ObjectId` ref.

### 6.1 Collections (16)
`users · businesses · staffMembers · queues · queueEntries · appointments · savedBusinesses · reviews · notifications · deviceTokens · analyticsEvents · supportTickets · aiConversations · categories · refreshTokens · kycRequests`

### 6.2 Core entities & key fields
- **users:** `name, email(unique,lowercase), passwordHash(select:false), phone, avatarUrl, role(enum), onboardingComplete, settings{language,notificationsEnabled,pushEnabled,emailEnabled}, resetTokenHash/Expires(select:false)`, timestamps.
- **businesses:** `name, category, description, ownerId→User, address, location(GeoJSON Point [lng,lat]), phone, logoUrl, hours[{dayOfWeek,openTime,closeTime,isClosed}], status(DRAFT|ACTIVE|SUSPENDED), ratingAvg, ratingCount`, timestamps.
- **queues:** `businessId→Business, name, description, status(OPEN|PAUSED|CLOSED), avgServiceSec(default 300), maxCapacity?, ticketCounter`, timestamps.
- **queueEntries:** `queueId→Queue, businessId→Business, userId→User, ticketNumber, status(enum), joinedAt, calledAt?, servingAt?, completedAt?, servedByStaffId?→User, estimatedWaitSec?, nearNotified`, timestamps.
- **staffMembers:** `userId→User, businessId→Business, role(OWNER|MANAGER|STAFF), status(INVITED|ACTIVE), invitedEmail?`.
- **refreshTokens:** `userId→User, tokenHash(bcrypt), expiresAt(TTL), revoked, userAgent`.
- **analyticsEvents:** `type(enum), businessId?, queueId?, userId?, durationSec?, payload(Mixed), createdAt` (no updatedAt; append-only).
- *(notifications, appointments, reviews, savedBusinesses, deviceTokens, supportTickets, aiConversations, categories, kycRequests follow the same `ObjectId`-ref pattern.)*

### 6.3 Relationships (ER explanation)
- `User 1—N Business` (as owner) and `User M—N Business` via `staffMembers` (role-scoped).
- `Business 1—N Queues 1—N QueueEntries`.
- `Business 1—N Appointments / Reviews / analyticsEvents`.
- `User 1—N` entries / appointments / favorites / reviews / notifications / deviceTokens / tickets / aiConversations.
- `Favorite` and `Review` are **unique per `(user, business)`**; reviews drive `business.ratingAvg/ratingCount` (denormalized).

```
User ──< StaffMember >── Business ──< Queue ──< QueueEntry >── User
 │                          │  │  └──< analyticsEvents
 │                          │  ├──< Review >── User   (unique user+business)
 │                          │  └──< SavedBusiness >── User (unique user+business)
 └──< RefreshToken / Notification / DeviceToken / Appointment / SupportTicket / aiConversation
```

### 6.4 Important indexes
- `users.email` **unique**.
- `businesses`: **2dsphere(location)**, **text(name, description)**, plus `status`, `category`, `name`.
- `queueEntries`: `{queueId,status,joinedAt}`, `{userId,status}`, and **partial-unique** `{queueId,userId}` over active statuses (`WAITING/CALLED/SERVING`).
- `staffMembers`: unique `{userId,businessId}`. `savedBusinesses`/`reviews`: unique compound pairs **[Assumption from status doc]**.
- `notifications`: `{userId,read,createdAt}` **[Assumption]**.
- `analyticsEvents`: `{businessId,type,createdAt}`.
- `deviceTokens.token` unique **[Assumption]**; `refreshTokens.expiresAt` **TTL** (`expireAfterSeconds:0`).

### 6.5 Prisma schema
**Not applicable** — FlowOS uses Mongoose, not Prisma. The equivalent "schema" is the set of `*.model.ts` files described above.

---

## 7. API Documentation (OpenAPI-style)

- **Base URL:** `http://<host>:4000/api/v1`
- **Auth:** `Authorization: Bearer <accessToken>` unless noted. Most module routers apply `authenticate` globally **[Assumption for modules whose router-level guard wasn't individually re-verified]**; explicitly public: `GET /system/*`, `GET /businesses` (optional auth), `GET /businesses/:id`, `GET /support/articles`, and the auth endpoints.
- **Error envelope (all errors):** `{ "error": { "code", "message", "details?" } }` with codes `BAD_REQUEST(400) · UNAUTHORIZED(401) · FORBIDDEN(403) · NOT_FOUND(404) · CONFLICT(409) · VALIDATION_ERROR(422) · RATE_LIMITED(429) · INTERNAL_SERVER_ERROR(500)`.

### System
| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/system/health` | No | `{ status, db, uptimeSec }` |
| GET | `/system/config` | No | public client config |

### Auth (register/login/forgot/reset rate-limited: 20 / 15 min)
| Method | Endpoint | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/register` | No | `{name(2-80), email, password(8-128), phone?, role?(CUSTOMER\|BUSINESS_OWNER)}` | `201 {user, accessToken, refreshToken}` |
| POST | `/auth/login` | No | `{email, password}` | `200 {user, accessToken, refreshToken}` |
| POST | `/auth/refresh` | No | `{refreshToken}` | `200 {user, accessToken, refreshToken}` (rotated) |
| POST | `/auth/logout` | No | `{refreshToken}` | `200 {success}` |
| POST | `/auth/forgot-password` | No | `{email}` | `200 {success, message}` (always) |
| POST | `/auth/reset-password` | No | `{token("<userId>.<raw>"), password(8-128)}` | `200 {success, message}` |
| GET | `/auth/me` | Yes | — | `200 {user}` |

**Error examples:** bad login → `401`; duplicate email → `409`; short password → `422`; throttled → `429`.

### Users
| Method | Endpoint | Body |
|---|---|---|
| GET | `/users/me` | — |
| PATCH | `/users/me` | `{name?, phone?}` |
| GET | `/users/me/settings` | — |
| PATCH | `/users/me/settings` | `{language?, notificationsEnabled?, pushEnabled?, emailEnabled?}` |
| POST | `/users/me/onboarding-complete` | — |

### Businesses
| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/businesses` | Optional | query: `search?, category?, lat?, lng?, radiusKm?(≤100,def 10), page?, limit?(≤50)` → `{items,total,page,limit}` (ACTIVE only) |
| GET | `/businesses/mine` | Yes | owner's businesses |
| GET | `/businesses/:id` | No | `{business}` |
| POST | `/businesses` | Yes (BUSINESS_OWNER/ADMIN) | `{name(2-120), category(2-40), description?, address?, phone?, logoUrl?(url), location?{lat,lng}}` → `201` DRAFT |
| PATCH | `/businesses/:id` | Yes (MANAGER+) | `{name?, category?, description?, address?, phone?, logoUrl?, location?, hours?[≤7], status?}` |
| DELETE | `/businesses/:id` | Yes (OWNER) | cascade delete → `200 {success}` |

### Queues
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/businesses/:businessId/queues` | list |
| POST | `/businesses/:businessId/queues` | `{name, description?, avgServiceSec?, maxCapacity?}` (MANAGER+) |
| GET | `/queues/:id` | one |
| PATCH | `/queues/:id` | `{name?, description?, status?, avgServiceSec?, maxCapacity?}` |

### Entries (queue engine)
| Method | Endpoint | Role | Notes |
|---|---|---|---|
| POST | `/queues/:queueId/join` | Customer | `201 {entry}` (guards: OPEN + ACTIVE + no active dup→409) |
| GET | `/queues/:queueId/entries` | Operator (STAFF+) | live list |
| POST | `/queues/:queueId/call-next` | Operator | atomic call-next |
| GET | `/entries/me` | Customer | active entries + position/ETA |
| DELETE | `/entries/:id` | Customer (own) | leave (WAITING/CALLED) |
| POST | `/entries/:id/serve` | Operator | CALLED→SERVING |
| POST | `/entries/:id/complete` | Operator | →COMPLETED (tunes ETA) |
| POST | `/entries/:id/no-show` | Operator | CALLED→NO_SHOW |

### Notifications
`GET /notifications` · `POST /notifications/read-all` · `PATCH /notifications/:id/read` · `POST /notifications/devices {token,platform(IOS\|ANDROID\|WEB)}` · `DELETE /notifications/devices/:token`.

### Appointments
`POST /appointments` · `GET /appointments/me` · `PATCH /appointments/:id` · `DELETE /appointments/:id` · `GET /businesses/:businessId/appointments` (operator).

### Reviews
`GET /businesses/:businessId/reviews` · `POST /businesses/:businessId/reviews` · `PATCH /reviews/:id` · `DELETE /reviews/:id` (own).

### Staff / Memberships
`GET /businesses/:businessId/staff` · `POST /businesses/:businessId/staff` · `PATCH /memberships/:id` · `DELETE /memberships/:id`.

### Favorites
`GET /favorites/me` · `POST /favorites {businessId}` · `DELETE /favorites/:businessId`.

### Analytics
`GET /businesses/:businessId/analytics/summary` (24h) · `GET /businesses/:businessId/analytics` (detailed window).

### AI
`POST /ai/chat {message}` · `GET /ai/conversations` · `GET /ai/conversations/:id`.

### Support
`GET /support/articles` (public) · `POST /support/tickets` · `GET /support/tickets/me` · `GET /support/tickets/:id`.

### Media
| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/media` | Yes | `multipart/form-data` with field **`file`** (image, ≤5 MB; png/jpeg/webp/gif). → `201 {url, key}` (absolute URL). Non-image / no file → `400`; missing token → `401`. |

> Uploaded files are served statically at `GET /uploads/<key>` (sent with `Cross-Origin-Resource-Policy: cross-origin` so the web app on another origin can render them).

> **Validation rules** are defined in each `*.schema.ts` (zod) and enforced by `validate()` → `422 VALIDATION_ERROR` with `details` = the zod issues array.

---

## 8. Security Documentation

- **JWT authentication:** access token (~15m, in memory on client) + refresh token (~30d). Verified in `middleware/authenticate.ts` and in the Socket.IO handshake. `optionalAuthenticate` enriches public routes without rejecting.
- **Refresh rotation + reuse detection:** refresh tokens are **bcrypt-hashed** and stored in `refreshTokens` (TTL-indexed). `refresh` revokes the presented token and issues a new pair; a revoked-but-presented token = reuse → rejected. Logout revokes the presented token; reset revokes all.
- **Password hashing:** bcryptjs, cost 10 (`lib/password.ts`); `passwordHash` is `select:false` so it never leaves the DB layer by default.
- **Input validation:** zod schemas on body/params/query via `validate()`; coercion + typed DTOs; failures → `422`.
- **Authorization:** global RBAC via `authorize(...roles)`; **business-scoped** RBAC via `assertBusinessRole(userId, businessId, minRole)` with rank `OWNER>MANAGER>STAFF`; `PLATFORM_ADMIN` bypasses scoping.
- **Rate limiting:** `express-rate-limit` on sensitive auth routes (register/login/forgot/reset): 20 requests / 15 min → `429 RATE_LIMITED`.
- **Secure env:** `config/env.ts` validates all env with zod and **fails fast** at boot; secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, SMTP/Groq/Firebase) live in `.env` (gitignored; `.env.example` is the template).
- **API protection / hardening:** `helmet` security headers, `cors` (configurable origins), JSON body limit (1mb), centralized error handler that hides internals in production, Mongo duplicate-key → `409`.
- **Upload handling:** `multer` `memoryStorage` with a **5 MB** size limit and an **image-only MIME filter** (`png/jpeg/webp/gif`); the upload route requires `authenticate`. Static `/uploads` responses deliberately relax **only** `Cross-Origin-Resource-Policy` to `cross-origin` (so the web client on a different origin can embed images); all other Helmet defaults still apply, and the relaxation is scoped to that route, not the API.
- **Known gaps:** no CSRF (token-based auth, not cookies, so low risk); web token storage uses `localStorage` (acceptable for dev/demo, not for production secrets); no multi-document transaction around business+membership creation (standalone Mongo).

---

## 9. Frontend Documentation

### 9.1 Folder structure (`mobile/src`)
```
api/          client.ts (axios+interceptors), endpoints.ts (typed wrappers, incl. mediaApi.upload), types.ts (DTOs)
auth/         AuthContext.tsx (session, tokens, socket, device-token)
components/    Screen.tsx (layout), Splash.tsx (branded splash), ThumbnailPicker(.web).tsx (image upload / URL fallback)
navigation/    RootNavigator.tsx (role-based), types.ts (param lists)
realtime/      socket.ts (singleton manager), useQueueEvents.ts, useRealtimeEvents.ts
screens/       auth/ · customer/ · business/ · shared/
storage/       tokens.ts (Keychain) + tokens.web.ts (localStorage)
push/          pushProvider.ts (FCM hook) + deviceToken.ts (register/unregister)
lib/           images.ts (business image helper)
shims/ web/    keychain.web.js shim; web entry helpers (ErrorBoundary, Probe, installErrorReporter)
config.ts      API_BASE_URL / SOCKET_URL (per platform)
theme/         index.ts (Material 3 theme + spacing + status colors)
```

### 9.2 Components & screens
- **Shared:** `Screen` (themed scroll/padding container), `Splash`.
- **Auth:** Login (hero), Register (role toggle), ForgotPassword (request→reset).
- **Customer:** Explore (search + Near-me + image cards), BusinessDetails (cover image + join), Activity (live position/ETA + live badge).
- **Business:** Businesses/Dashboard (status chips, setup CTA, live), CreateBusiness (+ thumbnail upload), BusinessSetup (hours + activate + delete + thumbnail), QueueForm, QueueManager (operate, live).
- **Shared tabs:** Notifications (real-time feed), Profile.

### 9.3 Hooks
- `useQueueEvents(queueIds, onChange)` — refetch on queue events / reconnect.
- `useNotificationEvents(onChange)` — refetch on `notification:new`.
- `useDashboardEvents(businessIds, onChange)` — subscribe business rooms + refetch on `dashboard:updated`.
- React Navigation hooks (`useNavigation`, `useFocusEffect`).

### 9.4 Context providers
- `AuthProvider` (`useAuth`) — `user, initializing, login, register, logout`; persists tokens (Keychain/localStorage), connects/disconnects the socket, registers/unregisters the device push token, wires axios refresh/logout callbacks.

### 9.5 State management
Local component state + **refetch-on-focus** + the "signal→fetch" realtime pattern; the only global state is `AuthContext`. No Redux/MobX (intentional — not needed yet).

### 9.6 Routing
Role-gated stacks: Auth (Login/Register/ForgotPassword) · Customer (tabs Explore/Activity/Notifications/Profile + BusinessDetails) · Business (tabs Dashboard/Notifications/Profile + CreateBusiness/BusinessSetup/QueueForm/QueueManager).

### 9.7 UI flow
Customer: register → explore (search/near-me) → business details → join → live tracking → served.
Business: register → dashboard → create business → setup + activate → create/manage queues → operate.

---

## 10. Current Project Status

### Completed
Auth (+rotation/reuse), users, businesses (incl. setup/activation/**delete**), queues, **queue engine**, notifications (in-app real-time), analytics APIs, AI APIs, support, staff, favorites, appointments, reviews (backend); 16 models + indexes; mobile core + business flows + Forgot-Password; **real-time client consumption**; **RN Web** browser target; **Near-me** search; **splash + images**; **owner image uploads** (`/media` + local storage + thumbnail picker); **test suite + CI**; local dev DB.

### Partially completed
- **Notifications:** in-app real-time ✅; **FCM push ❌** (coded, needs Firebase service account).
- **Device-token registration:** lifecycle wired ✅; real token pending FCM client.
- **Password reset:** screen + logic ✅; **email delivery** is a console stub (needs SMTP).
- **Media/uploads:** ✅ wired end-to-end (`POST /media` + `LocalStorageService` + web/native thumbnail picker). Storage is **local-disk only** for now — swap the `container.ts` binding for cloud/object storage (S3-style) before production.

### Pending
Dedicated Analytics/Staff/Appointments/Reviews/AI UIs, Onboarding screen, admin tooling, KYC, payments, native store builds.

### Technical debt
- No multi-document transaction around business+membership creation.
- Business `category` is free-text (not validated against `categories`).
- Mobile API base URL hardcoded per platform (no env config yet).
- Single-instance Socket.IO (no Redis adapter).
- Web token storage in `localStorage`.
- Some web dev-scaffolding (`Probe.tsx`, error reporter) remains in the tree.

### Known limitations
- Real **native** run needs the Android/iOS toolchain (not installed in the current env); the browser (RN Web) build is the live demo path.
- "Near me" depends on businesses having coordinates near the user (the base `seed` business is in Bangalore; the `seed-four-businesses` demo dataset is in **Hyderabad**).
- Push/email/AI are inert until their credentials are configured (by design).

---

## 11. Future Roadmap

> **Clarification of the brief's framing:** FlowOS is **one React Native codebase**. It **currently runs as a web app** (via React Native Web) for demos, and the **native mobile apps (Android/iOS) are already scaffolded** in `mobile/android` and `mobile/ios` — they need only a local build toolchain (JDK 17 + Android SDK / Xcode). So "mobile" is not a rewrite; it is the same code on a different target.

### How the current architecture supports mobile
- **Single codebase, multiple targets:** the same components render to native views (device) and DOM (web) — no parallel implementation.
- **100% API reuse:** native and web both call the same `/api/v1` REST + Socket.IO; only the base URL differs (`src/config.ts`).
- **Shared business logic:** auth, realtime manager, hooks, API client, and screens are platform-agnostic; platform specifics are isolated behind `.web.ts` files and shims (e.g., token storage).

### React Native (native) implementation plan
1. Install JDK 17 + Android Studio/SDK (and Xcode for iOS).
2. `cd mobile && npm install && npx react-native run-android` (or `run-ios`).
3. Point `src/config.ts` at the reachable API (env-based base URL — see tech debt).
4. Add **FCM** (`@react-native-firebase/messaging`) → fills `pushProvider.getPushToken()`; the device-token registration lifecycle already exists.

### Push notification strategy
In-app + real-time exist today. Native push = activate `FcmPushService` (service account) + the firebase messaging client; web push (optional) via the Web Push API later.

### Offline support strategy *(future)*
Cache last-known queue state + queue offline actions; reconcile via the existing refetch-on-reconnect path. The "signal→fetch" model already tolerates reconnects.

### Deployment strategy
- **Web:** `npm run web:build` → static bundle to a CDN/static host.
- **Native:** Android App Bundle / iOS archive → Play Store / App Store.
- **Backend:** containerize (future) + managed MongoDB (Atlas) + a process manager / PaaS.

---

## 12. Deployment Documentation

> **[Assumption]** No deployment/CI-CD infra beyond a test pipeline exists yet; the following is the recommended/intended setup with what's present today.

- **Development:** backend `npm run dev` (tsx watch) on :4000; MongoDB via `npm run dev:db` (in-memory binary) or a local/Atlas `MONGODB_URI`; web `npm run web` (webpack dev server :8080); seed with `npm run seed`.
- **Staging/Production:** **[Assumption — not yet built]** build backend (`npm run build` → `dist/`, `npm start`), point `MONGODB_URI` at Atlas, set all secrets; serve the web bundle from static hosting; native via store pipelines.
- **CI/CD:** `.github/workflows/ci.yml` runs on push/PR to `main` — two jobs (backend, mobile), each: `npm ci → lint → typecheck → test` on Node 22. No CD yet.
- **Build process:** backend `tsc -p tsconfig.json`; web `webpack --config webpack.config.js`; native via Gradle/Xcode.
- **Containerization:** **Docker not used** (recommended future addition).

---

## 13. Folder Structure Documentation

```
FlowOS/
├── .github/workflows/ci.yml      # CI: lint + typecheck + test (backend & mobile)
├── FLOWOS_PROJECT_STATUS.md      # living status (source of truth)
├── IMPLEMENTATION_PLAN.md        # Phase 2A plan + checklist
├── DEMO.md                       # demo runbook
├── TECHNICAL_DOCUMENTATION.md    # this document
├── backend/
│   ├── .env.example              # env template
│   ├── eslint.config.js          # ESLint 9 flat config
│   ├── jest.config.cjs           # Jest (ts-jest, isolatedModules)
│   ├── tsconfig.json / .test.json
│   ├── package.json              # scripts: dev, build, start, dev:db, seed, smoke, smoke:socket, test, typecheck, lint
│   ├── scripts/                  # seed.ts, seed-four-businesses.ts (Hyderabad demo), smoke.ts, socket-smoke.ts, dev-db.ts, delete-business.ts
│   ├── src/
│   │   ├── server.ts             # boot: env → DB → services → HTTP + Socket.IO
│   │   ├── app.ts                # express factory (helmet/cors/json/log/static /uploads + CORP/api/errors)
│   │   ├── container.ts          # composition root (swap implementations here)
│   │   ├── socket.ts             # Socket.IO auth + room subscriptions
│   │   ├── config/               # env.ts (zod), db.ts (mongoose)
│   │   ├── api/v1/index.ts       # mounts all module routers
│   │   ├── middleware/           # authenticate, authorize, validate, error
│   │   ├── lib/                  # jwt, password, errors, logger, businessAccess
│   │   ├── models/               # 16 Mongoose models + index.ts
│   │   ├── modules/<name>/       # routes · controller · service · repository · schema
│   │   └── services/             # notification · realtime · email · storage · ai (interface + impls)
│   └── tests/                    # unit/ (password,jwt) + integration/ (auth,queueGuard,businesses) + helpers
├── mobile/
│   ├── App.tsx, index.js         # native entry
│   ├── index.web.js, webpack.config.js, web/index.html   # web entry/build
│   ├── babel.config.js, jest.config.js, tsconfig.json
│   ├── android/ , ios/           # native projects (scaffolded)
│   ├── __tests__/                # apiErrorMessage, socket, render, deviceToken
│   └── src/                      # (see §9.1)
└── (mobile/dist-web is gitignored — generated web build)
```

---

## 14. Developer Onboarding Guide

**Prerequisites:** Node ≥20.19 (22 recommended), npm. For native: JDK 17 + Android Studio/SDK (and Xcode for iOS). MongoDB optional (the dev:db script provides one).

**Backend**
```bash
cd backend
npm install
cp .env.example .env          # set JWT_SECRET, JWT_REFRESH_SECRET, MONGODB_URI (defaults to 127.0.0.1:27017/flowos)
npm run dev:db                # (terminal A) local MongoDB via mongodb-memory-server binary — no install
npm run seed                  # demo data: owner@/staff@/customer@/admin@flowos.test : password123
npx tsx scripts/seed-four-businesses.ts   # (optional) Hyderabad demo businesses w/ images + services (idempotent)
npm run dev                   # (terminal B) API at http://localhost:4000/api/v1
npm run smoke && npm run smoke:socket   # verify core + realtime
npm test                      # Jest + Supertest (in-memory DB)
```

**Frontend — web (runs now, no mobile toolchain)**
```bash
cd mobile
npm install
npm run web                   # http://localhost:8080 (targets localhost:4000)
```

**Frontend — native (needs toolchain)**
```bash
cd mobile
npx react-native run-android  # Android emulator/device (JDK 17); app targets 10.0.2.2:4000
```

**Environment variables (backend `.env`):** `NODE_ENV, PORT(4000), API_PREFIX(/api/v1), CORS_ORIGIN(*), MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN(15m), JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN(30d), SMTP_*, GROQ_API_KEY/GROQ_MODEL, FIREBASE_SERVICE_ACCOUNT_PATH, UPLOAD_DIR`. App fails fast if required ones are missing/invalid.

**Testing:** backend `npm test` (21 tests), mobile `npm test` (13 tests), plus `npm run smoke` (20 checks) and `npm run smoke:socket` (5 checks). CI runs lint + typecheck + test on every push/PR to `main`.

---

## 15. Executive Summary (non-technical)

**FlowOS is a "skip the line" platform.** Instead of standing in a physical queue at a clinic, bank, salon, or government office, customers join from their phone and watch their position and estimated wait update **live**, getting a notification the moment it's their turn. Businesses get a self-service app to publish their venue, run their queues in real time, and see analytics.

**Where the project stands:** the product works **end to end today**. A business can register, set its hours, **activate** to become discoverable, create queues, and serve customers; a customer can find a business, join a queue, and track it live. The system is running and demonstrable **in a web browser right now**, talking to a real backend and database. The same code also powers native iPhone/Android apps, which are set up and ready to build.

**Engineering quality:** the codebase is cleanly architected and **well-tested** (an automated test suite plus continuous integration that checks every change), with secure login, role-based permissions, and real-time updates built in.

**What remains for launch:** mainly external service hookups — turning on **mobile push notifications** (needs a Google Firebase account) and **password-reset emails** (needs an email provider) — plus polishing a few secondary screens and preparing app-store/cloud deployment. None of these are architectural risks; they are configuration and finishing work.

**Bottom line for stakeholders:** the hard parts (the real-time queue engine, the two-sided flow, security, and a cross-platform foundation) are **built and verified**. The path to a public launch is short and well-understood.

---

### Appendix — Assumptions & deviations from the brief
- **Prisma/SQLite/PostgreSQL/Redis/Docker** are **not** in the project; documented the actual Mongoose/MongoDB stack and noted the absences.
- The brief framed FlowOS as web-first with mobile later; it is actually a **React Native (mobile-first) codebase currently running on web** via React Native Web — documented accordingly.
- Router-level auth guards for a few modules and a couple of secondary indexes are inferred from consistent patterns and the status doc; marked **[Assumption]**.
- Pre–Phase-2A sequencing is reconstructed from the work log; Phase 2A is exact (committed this session).
