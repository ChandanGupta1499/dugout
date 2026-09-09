# dugout server

Express API that mints Stream Chat tokens, serves match metadata from Supabase, ensures one messaging channel per match (when a Stream channel id is set), posts Gemini team-fan bot banter, and persists the match sim session in Supabase.

## Local setup

1. Copy `.env.example` to `.env` and fill in Stream, Gemini, and Supabase credentials:

```bash
cp .env.example .env
```

Required env:

- `STREAM_API_KEY` / `STREAM_API_SECRET` — Stream Chat dashboard
- `GEMINI_API_KEY` — Google AI Studio / Gemini API key
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase project (service role; server only)
- `PORT` — optional locally (defaults to `3001`); Render sets this automatically

2. Apply the SQL migration in [`supabase/migrations/`](supabase/migrations/) once per project (Supabase SQL editor or CLI). That creates `matches` + `sim_sessions` and seeds the known fixtures.

3. Install and run:

```bash
npm install
npm run dev
```

Server defaults to `http://localhost:3001`.

Match rows live in Supabase `matches` (`channel_id` nullable). Edit in the dashboard — no redeploy required. Historical seed snapshot: [`data/matches.json`](data/matches.json) (not read at runtime).

Mock live commentary for bot banter (non-sim) lives in [`data/commentary.json`](data/commentary.json), keyed by match `id`. Sim commentary stays in [`data/sim/`](data/sim/).

Sim progress persists in Supabase `sim_sessions`. After a backend restart the sim restores as **paused** — hit Resume in sim-ui. **Stop** clears the row.

## Deploy on Render (onboarding)

Repo includes [`render.yaml`](render.yaml) in this folder so you can deploy with a Blueprint.

### Option A — Blueprint (recommended)

1. Push this repo to GitHub/GitLab (if it isn’t already).
2. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the dugout repo and set the Blueprint path to `server/render.yaml`.
4. When prompted, set these **secret** env vars (do not commit them):
   - `STREAM_API_KEY`
   - `STREAM_API_SECRET`
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy. Render will:
   - use this `server/` directory as the service root
   - run `npm install`
   - start with `npm start`
   - health-check `GET /health`
6. Copy the service URL, e.g. `https://dugout-server.onrender.com`.
7. Smoke-test:

```bash
curl https://YOUR-SERVICE.onrender.com/health
curl https://YOUR-SERVICE.onrender.com/matches
```

8. Point the Expo app at that URL (rebuild the native client if the URL changed):

```bash
# in the app root .env
EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com
EXPO_PUBLIC_STREAM_API_KEY=your_stream_api_key
```

### Option B — Manual Web Service

1. **New** → **Web Service** → connect this repo.
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. Env vars: same secrets as above (`NODE_VERSION=20` optional but recommended).
4. Deploy, then follow steps 6–8 from Option A.

### Notes

- Free instances **sleep** when idle; the first request after sleep can take ~30–60s. Sim state survives sleep/redeploy via Supabase (restores paused).
- `PORT` is injected by Render — do not hardcode it.
- CORS is already enabled for the Expo client.
- After deploy, share the Android build with `EXPO_PUBLIC_API_URL` baked to the Render URL so testers hit the hosted API.

## Endpoints

- `GET /health` → `{ ok: true }`
- `GET /matches` → match list from Supabase (`channelId` may be `null`)
- `GET /matches/:matchId` → single match (404 if unknown)
- `POST /token` body `{ userId, name }` → `{ apiKey, token, user }`
- `POST /channels/match` body `{ matchId, userId }` → `{ channelType, channelId }` (400 if match has no channel id)
- `POST /bot/banter` body `{ matchId, team }` → `{ text, botUserId, messageId, channelId }`

### Bot banter

```bash
curl -X POST http://localhost:3001/bot/banter \
  -H 'Content-Type: application/json' \
  -d '{"matchId":"rma-inter-ucl-2026","team":"real-madrid"}'
```

The server loads recent chat + commentary context, asks Gemini for one short banter line, and posts it as `bot-{team}` in the match channel. Call again with the other team for bot-vs-bot.
