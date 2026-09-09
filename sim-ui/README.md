# Dugout match sim UI

Local admin for the fake match replay harness. Starts/stops a server-side clock that posts normalized YouTube chat into Stream. Team bot banter stays in the Expo app (`POST /bot/banter`).

## Run

```bash
# terminal 1 — API (from repo root)
npm run server

# terminal 2 — this UI
npm run sim-ui
```

Open the Vite URL (usually `http://localhost:5173`). API base defaults to `http://localhost:3001` (`VITE_API_URL` to override).

## Notes

- Match id: `eng-arg-semi-2026`
- Set **kickoff offset (ms)** to the YouTube `videoOffsetTimeMsec` where match minute `0'` begins
- Speed: `1x` / `2x` / `3x` / `5x` / `10x`
- Data lives in `server/data/sim/`; regenerate with `npm --prefix server run normalize-sim`
- Progress persists in `server/data/sim/session.json`. After a backend restart the sim restores as **paused** at the last cursor/elapsed time — hit **Resume**. **Stop** clears the file.
