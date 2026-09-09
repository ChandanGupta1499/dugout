# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Learned User Preferences

- Prefer planning and clarifying questions before implementation; text plans are enough (no visual mockups unless asked).
- Ship interactive human match chat first; fuller bot-brain (buffers, triggers, persona tuning) can wait; match-replay sim harness is local-only under `server/src/sim` + `sim-ui`.
- Use guest identity for now, but keep the Stream token API shaped so real auth can replace it later.
- Prefer stock `stream-chat-expo` Channel UI (`MessageList` / `MessageInput`) over custom bubbles for v1.
- Prefer Express service/context-provider architecture for bot context (recent chat now, commentary later) over introducing MCP in the first slice.
- Want team-fan bot banter (including bot-vs-bot / A-then-B reply chain) in the match channel; use manual per-team buttons in chat for prompt testing now, move interval scheduling to the backend later.
- Target navigation: main dashboard → league filter → match list → live match chat; chat rooms are expected to already exist (admin-created), not ad-hoc per client.

## Learned Workspace Facts

- Dugout is an Expo SDK 57 app using `stream-chat-expo` for live match chat.
- Express API lives in `server/` with `GET /matches`, `POST /token`, `POST /channels/match`, `POST /bot/banter`, `GET /health`, and sim routes under `/sim/*` (typically port 3001).
- Match list and optional Stream `channelId` live in Supabase `matches` (service role on the server); clients load via `GET /matches`. Matches with null `channelId` still appear in the UI; chat/bot/channel routes return 400 until set.
- Server requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; SQL migrations under `server/supabase/migrations/`.
- Fake match replay is isolated: `server/src/sim/`, `server/data/sim/`, and Vite admin `sim-ui/` (`npm run sim-ui`); bot banter stays on Expo chat UI.
- Sim progress persists in Supabase `sim_sessions` (in-memory clock + throttled write-through); backend restart restores as paused (Resume to continue); Stop clears the row.
- Match `eng-arg-semi-2026` is the sim fixture (England vs Argentina); normalized chat/commentary in `server/data/sim/`.
- Deploy to Render via `server/render.yaml` (Blueprint path `server/render.yaml`); see `server/README.md` for onboarding.
- Match chat is one Stream messaging channel per match when `channelId` is set; clients connect as guests via server-minted tokens.
- App routes use `/match/[matchId]` and `/match/[matchId]/chat`; starter Home/Explore tab UI was removed.
- Match chat screen includes manual per-team bot-banter buttons that call `POST /bot/banter`.
- Bot banter uses Gemini on the server with a team identity (`bot-{team}`), recent Stream chat, and commentary (stub `data/commentary.json`, or time-filtered `data/sim/commentary.json` when a sim is active).
- Chat history is stored in Stream (not a local DB); older messages are retrieved via Stream APIs/SDK.
- Client API base is `EXPO_PUBLIC_API_URL` (default `http://localhost:3001`); Android emulator must use `10.0.2.2` instead of `localhost`; shared builds point at the hosted Render URL.
