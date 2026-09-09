# Dugout match sim UI

Local admin for shared tester feeds and the fake match replay harness.

- **Match list** from `GET /matches` (Supabase)
- **Inject chat** → Stream (visible to all Expo clients in that channel)
- **Inject commentary** → Supabase `match_commentary` (shared banter/scoreboard context)
- **YouTube replay** — starts/stops the server-side clock that posts normalized chat into Stream

Team bot banter stays in the Expo app (`POST /bot/banter`).

## Run

```bash
# terminal 1 — API (from repo root)
npm run server

# terminal 2 — this UI
npm run sim-ui
```

Open the Vite URL (usually `http://localhost:5173`).

- API base: `VITE_API_URL` (default `http://localhost:3001`). For shared testing, point at the Render URL.
- Paste the same `ADMIN_API_KEY` as the server into the Admin API key field (stored in `localStorage`).

Apply the `match_commentary` migration on the shared Supabase project before injecting commentary.

## Notes

- Replay fixture match id: `eng-arg-semi-2026`
- Set **kickoff offset (ms)** to the YouTube `videoOffsetTimeMsec` where match minute `0'` begins
- Speed: `1x` / `2x` / `3x` / `5x` / `10x`
- Replay data lives in `server/data/sim/`; regenerate with `npm --prefix server run normalize-sim`
- Progress persists in Supabase `sim_sessions`. After a backend restart the sim restores as **paused** at the last cursor/elapsed time — hit **Resume**. **Stop** clears the row.
- Chat inject requires the match to have a Stream `channelId`. Goals for scoreboard: type `goal` + `score_after` like `1-0` (team A – team B).
