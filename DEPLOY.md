# FlowOS — Deploy the backend to the cloud (works on ANY mobile network)

Your JioFiber network blocks Cloudflare tunnels, so the "any network" demo needs the
backend on a real host with a permanent HTTPS URL. This takes ~15 minutes and is free.
Recommended: **MongoDB Atlas** (database) + **Render** (server). Steps below.

When you finish, send me the Render URL and I'll bake it into the APK + rebuild.

---

## 1. Database — MongoDB Atlas (free)
1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a **free M0 cluster** (any provider/region).
3. **Database Access** → Add a database user (username + password). Save them.
4. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`).
5. **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Insert the DB name `flowos` before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/flowos?retryWrites=true&w=majority
   ```
   This is your **`MONGODB_URI`**.

## 2. Get the code on GitHub
The code is committed locally but not pushed (the repo doesn't exist yet on GitHub).
1. Create a new repo on GitHub (e.g. `FlowOS`), empty, under your account.
2. Tell me the repo name and I'll push all commits for you (or run:
   `git push -u origin HEAD` once the repo exists).

## 3. Deploy on Render (free)
1. Sign up at <https://render.com> and connect your GitHub.
2. **New ▸ Blueprint** → pick the `FlowOS` repo. Render reads `render.yaml` and
   sets up `flowos-backend` automatically (build `npm install`, start `npx tsx src/server.ts`).
3. When prompted, paste **`MONGODB_URI`** (from step 1). `JWT_SECRET` /
   `JWT_REFRESH_SECRET` are generated automatically.
4. **Apply / Deploy**. First deploy takes ~3–5 min. When it's live you'll get a URL like:
   ```
   https://flowos-backend-xxxx.onrender.com
   ```
   Check it works: open `https://flowos-backend-xxxx.onrender.com/api/v1/system/health`
   → should show `{"status":"ok","db":"connected",...}`.

   > Render's free tier sleeps after ~15 min idle; the first request then takes
   > ~30–60 s to wake. Fine for demos. Upgrade or use Railway/Fly to avoid sleeping.

## 4. Seed the cloud database (the 8 Hyderabad demo businesses + admin)
From your laptop (general internet works; only Cloudflare tunnels are blocked):
```bash
cd backend
# PowerShell:
$env:MONGODB_URI="<your atlas URI from step 1>"; npm run seed:demo
# git-bash:
MONGODB_URI="<your atlas URI from step 1>" npm run seed:demo
```
This loads the 8 APPROVED businesses, queues, reviews, analytics, and the admin
account `sreelekhaac2427@gmail.com / 12345678ct` into the cloud DB.

## 5. Send me the URL
Give me the Render URL (`https://flowos-backend-xxxx.onrender.com`). I'll:
- set it as `PUBLIC_BASE_URL` in `mobile/src/config.ts`,
- rebuild the release APK,
- copy it to your Desktop.

The new APK then works on **any phone on any network** — no laptop, no tunnel.

---

### Alternatives (no GitHub needed)
- **Railway** (<https://railway.app>): `npm i -g @railway/cli` → `railway login` →
  from `backend/`: `railway init` → `railway up` → `railway domain`. Has a built-in
  MongoDB plugin (skip Atlas). Tell me and I can drive most of this once you've logged in.
- **Fly.io**: `flyctl launch` + `flyctl deploy --remote-only` (uses the included `Dockerfile`).

A `Dockerfile` is included in `backend/` so any container host works too.
