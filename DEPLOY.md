# FlowOS — Deploy to Render (free tier)

One Render **Blueprint** deploys both services from `render.yaml`:

- **flowos-backend** — the API + Socket.IO (Node web service, compiled with `tsc`)
- **flowos-web** — the React Native Web client (free static site)

Total time: ~20 minutes. Everything below is free.

---

## 1. Database — MongoDB Atlas (free M0)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a **free M0 cluster** (any provider/region).
3. **Database Access** → add a database user (username + password). Save them.
4. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`).
5. **Connect → Drivers** → copy the connection string and insert the DB name
   `flowos` before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/flowos?retryWrites=true&w=majority
   ```
   This is your **`MONGODB_URI`**.

## 2. Email — Brevo (free, 300 emails/day)

Real verification/reset emails need an HTTP email provider (Render restricts SMTP).

1. Sign up at <https://www.brevo.com> and verify a **sender** (your own email works).
2. **Settings → SMTP & API → API Keys** → create a v3 API key (`xkeysib-...`).
3. You'll paste it as **`BREVO_API_KEY`** in step 4, with **`EMAIL_FROM`** set to the
   verified sender, e.g. `FlowOS <you@example.com>`.

> Skip this step to run in **demo mode**: the verification code is then shown
> in-app instead of emailed — signup still works end to end.

## 3. Push the code to GitHub

Commit and push this repo (Render deploys from GitHub).

## 4. Deploy on Render

1. Sign up at <https://render.com> and connect GitHub.
2. **New ▸ Blueprint** → pick this repo. Render reads `render.yaml` and creates
   `flowos-backend` and `flowos-web`.
3. When prompted, paste:
   - **`MONGODB_URI`** (step 1)
   - **`BREVO_API_KEY`** + **`EMAIL_FROM`** (step 2, or leave blank for demo mode)
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` are generated automatically.
4. **Apply**. First deploy takes ~5 min. Verify:
   ```
   https://flowos-backend.onrender.com/api/v1/system/health
   ```
   → should show `{"status":"ok","db":"connected",...}`.

> If Render gave the backend a different URL (name taken → suffix added), update
> `PUBLIC_BASE_URL` in `mobile/src/config.ts`, push, and let `flowos-web` rebuild.
> Optionally tighten `CORS_ORIGIN` on flowos-backend to the flowos-web URL.

## 5. Seed demo data (optional)

From your laptop, with your own admin credentials (they are **not** stored in the repo):

```powershell
cd backend
$env:MONGODB_URI = "<your atlas URI>"
$env:ADMIN_EMAIL = "<your admin email>"
$env:ADMIN_PASSWORD = "<a strong password>"
npm run seed:demo
```

## 6. Share with friends

- **Web:** send them `https://flowos-web.onrender.com`.
- **Android:** rebuild the release APK (it now points at the Render backend).

> Free-tier note: the backend sleeps after ~15 min idle; the first request takes
> 30–60 s to wake (the app waits it out automatically). A free UptimeRobot monitor
> pinging the health URL every 5 min keeps it warm during demo sessions.
