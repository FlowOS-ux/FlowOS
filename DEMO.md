# FlowOS — Demo Runbook

> Virtual queue platform: customers join queues remotely and track position/ETA live;
> businesses onboard, activate, and operate queues. RN (mobile) + Express/MongoDB (backend).

## Verification snapshot (all green)
| Check | Result |
|---|---|
| `npm run smoke` (full flow) | **20/20** |
| `npm run smoke:socket` (realtime) | **5/5** |
| backend `npm test` (jest) | **19/19** |
| mobile `npm test` (jest) | **13/13** |
| typecheck + lint (both) | **clean** |

## Demo accounts (after `npm run seed`)
| Role | Email | Password |
|---|---|---|
| Business owner | `owner@flowos.test` | `password123` |
| Staff | `staff@flowos.test` | `password123` |
| Customer | `customer@flowos.test` | `password123` |
Seed also creates an **ACTIVE** business with open queues to demo against immediately.

## Demo flow A — Customer journey
1. **Register/Login** (Customer) → **Explore**: see ACTIVE businesses (search works).
2. **Business Details** → tap a queue → **Join**.
3. **Activity**: live **position + ETA**, "Live" badge. When an operator calls you →
   **"It's your turn! 🎉"** + a real-time notification.
4. **Notifications**: the alert appears live (no manual refresh).

## Demo flow B — Business journey
1. **Register/Login** (Business) → **Dashboard**.
2. **＋ Business** → create → appears as **DRAFT** (status chip + "Setup & activate" CTA).
3. **Business Setup**: set 7-day hours, flip **Active** → now discoverable in Explore.
4. **Add queue** → **Queue Manager**: **Call Next → Serve → Complete / No-show**, updates live;
   dashboard metrics update in real time.

## Demo flow C — Account recovery
**Login → Forgot password?** → request code → reset. (Code prints to the backend console until SMTP is configured.)

## Running it live (requires toolchain — see "Prerequisites")
```bash
# 1) MongoDB running locally (or set MONGODB_URI to Atlas)
# 2) Backend
cd backend && npm install && npm run seed && npm run dev      # http://localhost:4000/api/v1
# 3) Mobile (Android emulator running)
cd mobile && npm install && npx react-native run-android       # targets 10.0.2.2:4000
```

### Prerequisites (not yet installed on this machine)
- **JDK 17** (current: 22) · **Android Studio + SDK + an AVD emulator** · **MongoDB** (or Atlas URI).
- Without these, demo the system via the backend suites (`npm run smoke && npm run smoke:socket`),
  which exercise the exact end-to-end flow above.

## Disclose during the demo (pending, by design)
- **FCM push** (background notifications) — wired client-side; needs a Firebase service account to activate.
- **Email delivery** for password reset — uses dev console fallback until SMTP is configured.
- **Device-token registration** — lifecycle is wired (login/logout); registers a real token once FCM is added.
