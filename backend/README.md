# FlowOS Backend

AI-powered virtual queue management platform — REST API + real-time (Socket.IO).

- **Runtime:** Node.js + Express 5 + TypeScript
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (access + refresh with rotation), bcrypt
- **Real-time:** Socket.IO
- **Push:** Firebase Cloud Messaging (optional)
- **AI:** Groq (OpenAI-compatible) assistant
- **Email:** SMTP / Nodemailer (dev console fallback)

---

## Quick start

```bash
cd backend
npm install
cp .env.example .env          # then edit values
# Start MongoDB locally (or point MONGODB_URI at Atlas)
npm run seed                  # optional demo data
npm run dev                   # http://localhost:4000/api/v1
```

**Scripts**

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run seed` | Seed demo data into `MONGODB_URI` |
| `npm run smoke` | End-to-end test on an in-memory MongoDB (no install needed) |

**Seeded accounts** (password `password123`): `admin@`, `owner@`, `staff@`, `customer@flowos.test`.

---

## Architecture

Clean, layered, modular. A request flows:

```
route → validate(zod) → authenticate → authorize → controller → service → repository → Mongoose
```

- **controllers** — HTTP only (read req, call service, send response)
- **services** — business logic; orchestrate repositories + cross-cutting services
- **repositories** — the only layer that touches Mongoose models
- **cross-cutting services** (behind interfaces, wired in `src/container.ts`):
  notification (in-app + FCM), realtime (Socket.IO), email (SMTP), storage (local disk), ai (Groq)

```
src/
├── server.ts            boot: env → DB → services → HTTP + Socket.IO
├── app.ts               express app + middleware + error handling
├── container.ts         composition root (swap implementations here)
├── socket.ts            Socket.IO auth + room subscriptions
├── config/              env (zod-validated), db (mongoose)
├── api/v1/index.ts      mounts every module under /api/v1
├── middleware/          authenticate, authorize, validate, error
├── lib/                 jwt, password, errors, logger, businessAccess
├── models/              16 Mongoose schemas + indexes
├── modules/<name>/      routes · controller · service · repository · schema
└── services/            notification · realtime · email · storage · ai
```

---

## Roles & permissions

Global roles: `CUSTOMER`, `STAFF`, `BUSINESS_OWNER`, `PLATFORM_ADMIN`.
Business-scoped roles (via `staffMembers`): `OWNER` > `MANAGER` > `STAFF`.

Business actions are checked with `assertBusinessRole(userId, businessId, minRole)`
(`PLATFORM_ADMIN` bypasses). Owners are auto-enrolled as an `OWNER` staff member on
business registration.

---

## Queue state machine

```
JOIN → WAITING → CALLED → SERVING → COMPLETED
                   │         
   WAITING → CANCELLED (customer leaves / queue closed)
   CALLED  → CANCELLED | NO_SHOW
```

- **Position** is computed, never stored: `count(WAITING entries with earlier joinedAt) + 1`.
- **ETA** = `peopleAhead × queue.avgServiceSec` (avgServiceSec self-tunes via EMA on completion).
- **Call-next** is an atomic `findOneAndUpdate` (oldest WAITING → CALLED) — race-safe.
- One active entry per user per queue (enforced by a partial unique index).

---

## Real-time (Socket.IO)

Connect with the access token: `io(URL, { auth: { token } })`. Each socket auto-joins
its `user:<id>` room. Subscribe/unsubscribe to live rooms:

```
socket.emit('subscribe:queue', queueId)
socket.emit('subscribe:business', businessId)
```

Server events: `queue:updated`, `entry:updated`, `notification:new`,
`appointment:updated`, `dashboard:updated`.

---

## API reference (`/api/v1`)

🔓 public · 🔑 authenticated · 🛡️ staff/owner of the business

### System
- 🔓 `GET /system/health` · `GET /system/config`

### Auth
- 🔓 `POST /auth/register` `{name,email,password,role?}`
- 🔓 `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`
- 🔓 `POST /auth/forgot-password` · `POST /auth/reset-password`
- 🔑 `GET /auth/me`

### Users
- 🔑 `GET /users/me` · `PATCH /users/me`
- 🔑 `GET /users/me/settings` · `PATCH /users/me/settings`
- 🔑 `POST /users/me/onboarding-complete`

### Businesses
- 🔓 `GET /businesses?search=&category=&lat=&lng=&radiusKm=&page=&limit=`
- 🔓 `GET /businesses/:id`
- 🔑 `GET /businesses/mine`
- 🔑 `POST /businesses` (BUSINESS_OWNER) · 🛡️ `PATCH /businesses/:id`

### Queues
- 🔓 `GET /businesses/:businessId/queues`
- 🛡️ `POST /businesses/:businessId/queues`
- 🔓 `GET /queues/:id` · 🛡️ `PATCH /queues/:id`

### Queue entries (the engine)
- 🔑 `POST /queues/:queueId/join` · `GET /entries/me` · `DELETE /entries/:id`
- 🛡️ `GET /queues/:queueId/entries` · `POST /queues/:queueId/call-next`
- 🛡️ `POST /entries/:id/serve` · `POST /entries/:id/complete` · `POST /entries/:id/no-show`

### Notifications
- 🔑 `GET /notifications?unread=&page=&limit=` · `POST /notifications/read-all` · `PATCH /notifications/:id/read`
- 🔑 `POST /notifications/devices` `{token,platform}` · `DELETE /notifications/devices/:token`

### Appointments
- 🔑 `POST /appointments` · `GET /appointments/me` · `PATCH /appointments/:id` · `DELETE /appointments/:id`
- 🛡️ `GET /businesses/:businessId/appointments`

### Reviews
- 🔓 `GET /businesses/:businessId/reviews` · 🔑 `POST /businesses/:businessId/reviews`
- 🔑 `PATCH /reviews/:id` · `DELETE /reviews/:id`

### Staff management
- 🛡️ `GET /businesses/:businessId/staff` · `POST /businesses/:businessId/staff` `{email,role}`
- 🛡️ `PATCH /memberships/:id` `{role}` · `DELETE /memberships/:id`

### Saved Places (favorites)
- 🔑 `GET /favorites/me` · `POST /favorites` `{businessId}` · `DELETE /favorites/:businessId`

### Analytics
- 🛡️ `GET /businesses/:businessId/analytics/summary`
- 🛡️ `GET /businesses/:businessId/analytics?days=7`

### AI Assistant
- 🔑 `POST /ai/chat` `{message,conversationId?}`
- 🔑 `GET /ai/conversations` · `GET /ai/conversations/:id`

### Support
- 🔓 `GET /support/articles`
- 🔑 `POST /support/tickets` · `GET /support/tickets/me` · `GET /support/tickets/:id`

---

## Error format

All errors return a consistent envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [] } }
```

## Environment

See `.env.example`. Required: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
Optional integrations degrade gracefully when unset: SMTP (logs to console),
`GROQ_API_KEY` (assistant returns a setup hint), `FIREBASE_SERVICE_ACCOUNT_PATH` (push disabled).
