# Fan Map (India, team-heatmap) — Design

## Problem

Users want to see, on a map, where fans of each team in a match are concentrated — e.g. for England vs Argentina, where England fans vs Argentina fans are clustered geographically. Scoped to India for v1, since that's the app's primary user base.

## Goals

- A "Fan Map" screen reachable from within a match, showing an India-centered map.
- Two team-colored heatmap layers (not discrete pins) showing fan density by locality.
- Users can set their own team affiliation + home locality once; it's reused across every match involving that team.
- The map is never empty during early testing — seeded fake fan records blend with real submissions.

## Non-goals (this slice)

- Real device GPS location (locality is manually picked from a list).
- Regions outside India.
- Per-match affiliation overrides (affiliation is a global, one-time profile setting).
- Live/animated shifts in density tied to score or match events.
- Any change to the existing match chat, sim harness, or bot-banter features.

## Data model

New files under `server/data/`:

- **`teams.json`** — static list of pickable teams: `{ slug: string, label: string }[]`. Seeded from the teams already used in `matches.json` (england, argentina, real-madrid, inter-milan), extensible later without code changes.
- **`localities.json`** — ~40-60 Indian localities/cities: `{ id: string, name: string, lat: number, lng: number }[]`. Used both for the manual picker and for generating seed fan records.
- **`fans.json`** — one record per real user, upserted by `userId`: `{ userId: string, teamSlug: string, localityId: string, updatedAt: string }[]`. A user has exactly one active team + locality at a time; setting a new one overwrites the old.
- **`fans.seed.json`** — a batch of fake records in the same shape as `fans.json`, with `userId` values like `seed-<n>`, distributed across localities and the teams in `teams.json`. Loaded and merged with `fans.json` at read time (seed records are read-only, never mutated by real writes).

## API

New module `server/src/fans.ts`, wired into `server/src/index.ts` alongside the existing routes:

- `GET /teams` → `teams.json` contents.
- `GET /localities?q=<text>` → localities whose `name` matches the query (case-insensitive substring match), capped to a reasonable page size (e.g. 20) for the search picker.
- `GET /fans/profile/:userId` → the user's saved `{ teamSlug, localityId }`, or 404 if none set yet.
- `POST /fans/profile` → body `{ userId, teamSlug, localityId }`; validates both slug and locality id exist, upserts into `fans.json`, returns the saved record.
- `GET /matches/:matchId/fan-map` → 404 if match unknown. Otherwise reads the match's `teamA`/`teamB` slugs, merges `fans.json` + `fans.seed.json`, filters to records whose `teamSlug` matches either team, groups by `localityId` per team, and returns:
  ```json
  {
    "teamA": [{ "lat": 19.0, "lng": 72.8, "weight": 12 }],
    "teamB": [{ "lat": 12.97, "lng": 77.59, "weight": 7 }]
  }
  ```
  `weight` is the fan count at that locality. If a match has no `teamA`/`teamB` (some fixtures in `matches.json` omit them), respond `404` with a clear error rather than an empty map, since the feature has nothing to show.

## Client

### Profile setup (one-time)

Triggered the first time a user opens any match's Fan Map tab and has no cached profile:

1. Fetch `GET /teams`; present as a picker, defaulting the visible list to the current match's two teams (with an option to see the full list) — but the saved affiliation is global, not tied to this match.
2. Locality picker: text input that queries `GET /localities?q=` as the user types, single-select from results.
3. On confirm, `POST /fans/profile` with the guest `userId` (from `src/lib/guest.ts`), then cache `{ teamSlug, localityId }` in AsyncStorage under a `dugout.fanProfile` key so the prompt doesn't repeat. Also refresh from `GET /fans/profile/:userId` on app start in case the cache is stale/cleared.

### Fan Map screen (`src/app/match/[matchId]/fan-map.tsx`)

- New tab/link alongside the existing match chat screen (`src/app/match/[matchId]/chat.tsx`), added to the match's index/nav.
- Fetches `GET /matches/:matchId/fan-map` on mount.
- Renders `react-native-maps`' `MapView` centered/bounded on India, with two `Heatmap` layers, one per team, using distinct color gradients (e.g. red-scale for `teamA`, blue-scale for `teamB`) at moderate opacity so overlapping areas visually blend.
- If the current user's own team isn't one of this match's two teams, they simply don't appear in this map's data — no special-casing needed client-side.
- Standard map interactions (pinch/zoom/pan) come from `MapView` for free; no custom clustering/marker logic needed since density is conveyed by the heatmap layers rather than discrete pins.

## Technical risks / setup requirements

- `react-native-maps`'s `Heatmap` component requires the **Google Maps provider on iOS** (Apple Maps doesn't support heatmaps natively); Android already defaults to Google Maps. This means:
  - A Google Maps API key needs to be added to `app.json` (both `ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey`).
  - Because this pulls in a native module, it requires a **dev-client rebuild** (`expo prebuild` / new dev client build), not just a JS reload — consistent with this project already using `expo-dev-client` rather than Expo Go.
- Exact API shape and config keys must be checked against the versioned Expo SDK 57 docs (per `AGENTS.md`) before implementation, since `react-native-maps` config-plugin behavior has changed across Expo SDK versions.

## Testing / verification plan

- Server: unit-level checks (or manual `curl`) for `GET /teams`, `GET /localities`, `POST /fans/profile` upsert behavior, and `GET /matches/:matchId/fan-map` aggregation correctness against known seed data.
- Client: manually run the app via dev client, complete the one-time profile setup, open a match's Fan Map tab, and visually confirm two distinct heatmap colors render over the correct Indian regions, with the seeded data visible before any real submission.
- Confirm the app still builds/runs on both iOS and Android dev clients after the native module + config plugin changes (this is the highest-risk part of the slice).

## Future work

- Real GPS-based locality auto-detect (`expo-location`), as an alternative/supplement to manual picking.
- Regions beyond India.
- Live shifts in fan density tied to match score/events (reusing the existing sim harness timing model).
- Per-match affiliation override for neutral/glory-hunting fans.
