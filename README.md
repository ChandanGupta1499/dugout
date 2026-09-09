# Dugout

Expo app for live match chat, backed by Stream Chat and a small Express token server.

## Prerequisites

1. A [Stream Chat](https://getstream.io/chat/) app (API key + secret)
2. Node 20+
3. A development build — `stream-chat-expo` does **not** run in Expo Go

## Setup

### 1. Server

```bash
cd server
cp .env.example .env
# set STREAM_API_KEY and STREAM_API_SECRET
npm install
npm run dev
```

Server listens on `http://localhost:3001` by default.

### 2. App

```bash
cp .env.example .env
# set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_STREAM_API_KEY
npm install
```

On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (e.g. `http://192.168.1.10:3001`).

Android emulator: `localhost` in `.env` is fine — the app rewrites it to `10.0.2.2` (host machine). Curl on your Mac still uses `http://localhost:3001`.

### 3. Run

`stream-chat-expo` includes native modules (e.g. `StreamVideoThumbnail`). It **does not work in Expo Go**.

First time (or after adding/changing native deps), build a development client:

```bash
# terminal 1
npm run server

# terminal 2
bun run android
# or: bun run ios
```

That runs `expo run:android` / `expo run:ios`, which generates native projects and installs a binary that includes Stream’s modules.

Later sessions (binary already installed):

```bash
npm run start   # expo start --dev-client
```

Do **not** use plain `expo start` / Expo Go for this app.
## Smoke test

1. Open the app as guest A, pick a match, open chat, send a message.
2. Clear app storage / reinstall (or use a second simulator) as guest B, open the **same** match chat.
3. Confirm both guests see each other's messages in one `match-{matchId}` channel.

## Routes

- `/` — stub match list
- `/match/[matchId]` — match stub + Open chat
- `/match/[matchId]/chat` — Stream Channel UI

## API

See [`server/README.md`](server/README.md) for local setup, endpoints, and **Render onboarding**.

Match list comes from the server (`GET /matches` / `data/matches.json`).

### Host on Render

1. Use the Blueprint at [`server/render.yaml`](server/render.yaml) (Dashboard → **New** → **Blueprint**, path `server/render.yaml`) or create a Web Service with root directory `server`.
2. Set `STREAM_API_KEY`, `STREAM_API_SECRET`, and `GEMINI_API_KEY` in the Render dashboard.
3. After deploy, set the app env and rebuild if needed:

```bash
EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com
```

Full steps: [`server/README.md`](server/README.md#deploy-on-render-onboarding).
