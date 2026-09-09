# dugout server

Express API that mints Stream Chat tokens, serves match metadata from local JSON, ensures one messaging channel per match, and posts Gemini team-fan bot banter.

## Local setup

1. Copy `.env.example` to `.env` and fill in Stream + Gemini credentials:

```bash
cp .env.example .env
```

Required env:

- `STREAM_API_KEY` / `STREAM_API_SECRET` — Stream Chat dashboard
- `GEMINI_API_KEY` — Google AI Studio / Gemini API key
- `PORT` — optional locally (defaults to `3001`); Render sets this automatically

2. Install and run:

```bash
npm install
npm run dev
```

Server defaults to `http://localhost:3001`.

Match fixtures live in [`data/matches.json`](data/matches.json) (id, title, Stream `channelId`, optional teams). Edit that file to add or change matches — no app rebuild required once the app loads matches from the API.

Mock live commentary for bot banter lives in [`data/commentary.json`](data/commentary.json), keyed by match `id`. Append timeline rows as the match progresses; the server re-reads the file on each `POST /bot/banter` (no rebuild needed).

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
3. Env vars: same three secrets as above (`NODE_VERSION=20` optional but recommended).
4. Deploy, then follow steps 6–8 from Option A.

### Notes

- Free instances **sleep** when idle; the first request after sleep can take ~30–60s.
- `PORT` is injected by Render — do not hardcode it.
- CORS is already enabled for the Expo client.
- After deploy, share the Android build with `EXPO_PUBLIC_API_URL` baked to the Render URL so testers hit the hosted API.

## Endpoints

- `GET /health` → `{ ok: true }`
- `GET /matches` → match list from `data/matches.json`
- `GET /matches/:matchId` → single match (404 if unknown)
- `POST /token` body `{ userId, name }` → `{ apiKey, token, user }`
- `POST /channels/match` body `{ matchId, userId }` → `{ channelType, channelId }`
- `POST /bot/banter` body `{ matchId, team }` → `{ text, botUserId, messageId, channelId }`

### Bot banter

```bash
curl -X POST http://localhost:3001/bot/banter \
  -H 'Content-Type: application/json' \
  -d '{"matchId":"rma-inter-ucl-2026","team":"real-madrid"}'
```

The server loads recent chat (commentary context is stubbed for later), asks Gemini for one short banter line, and posts it as `bot-{team}` in the match channel from JSON. Call again with the other team for bot-vs-bot.
