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
- Web support. `react-native-maps` has no built-in web renderer; the web build shows a simple "not available on web" fallback instead of the map.
- Per-match affiliation overrides (affiliation is a global, one-time profile setting).
- Live/animated shifts in density tied to score or match events.
- Any change to the existing match chat, sim harness, or bot-banter features.

## Data model

New files under `server/data/`:

- **`teams.json`** — static list of pickable teams: `{ slug: string, label: string }[]`. Seeded from the teams already used in `matches.json` (england, argentina, real-madrid, inter-milan), extensible later without code changes.
- **`localities.json`** — ~40-60 Indian localities/cities: `{ id: string, name: string, lat: number, lng: number }[]`. Used both for the manual picker and for generating seed fan records.
- **`fans.json`** — one record per real user, upserted by `userId`: `{ userId: string, teamSlug: string, localityId: string, updatedAt: string }[]`. A user has exactly one active team + locality at a time; setting a new one overwrites the old.
- **`fans.seed.json`** — a batch of fake records in the same shape as `fans.json`, with `userId` values like `seed-<n>`, distributed across localities and the teams in `teams.json`. Loaded and merged with `fans.json` at read time (seed records are read-only, never mutated by real writes).

Unlike `matches.ts`'s `loadMatches`, which caches the parsed file forever (safe only because `matches.json` never changes at runtime), `fans.ts` must **read `fans.json` fresh on every request** (no module-level cache) since `POST /fans/profile` mutates it. `teams.json` and `localities.json` are static like `matches.json` and can use the same load-once-and-cache pattern.

The upsert in `POST /fans/profile` reads, modifies, and writes `fans.json` using **synchronous `fs` calls** (`readFileSync`/`writeFileSync`) with no `await` between them, so within Node's single-threaded event loop the read-modify-write cannot be interleaved by a concurrent request. This is sufficient for this feature's scale; a real multi-writer datastore is future work if needed.

**Known limitation:** guest IDs (`src/lib/guest.ts`) regenerate whenever local storage is cleared or the app is reinstalled, and a profile is a permanent one-time setting with no expiry — so `fans.json` will accumulate orphaned records from abandoned guest IDs over time. Acceptable for this slice; not cleaned up.

## API

New module `server/src/fans.ts`, wired into `server/src/index.ts` alongside the existing routes:

- `GET /teams` → `teams.json` contents.
- `GET /localities?q=<text>` → full `{ id, name, lat, lng }` records (not just `id`/`name`) for localities whose `name` matches the query (case-insensitive substring match), capped to a reasonable page size (e.g. 20) for the search picker.
- `GET /fans/profile/:userId` → the user's saved `{ teamSlug, localityId }`, or 404 if none set yet.
- `POST /fans/profile` → body `{ userId, teamSlug, localityId }`. Returns `400` with `{ error: string }` (matching the validation-error convention already used by `/token` and `/bot/banter`) if `userId`/`teamSlug`/`localityId` are missing, or if `teamSlug`/`localityId` don't match a known entry in `teams.json`/`localities.json`. On success, upserts into `fans.json` and returns the saved record.
- `GET /matches/:matchId/fan-map` → 404 if match unknown, or if the match has no `teamA`/`teamB` (some fixtures in `matches.json` omit them) — respond with a clear error rather than an empty map, since the feature has nothing to show. Otherwise reads the match's `teamA`/`teamB` slugs, merges `fans.json` + `fans.seed.json`, filters to records whose `teamSlug` matches either team, joins each remaining record against `localities.json` by `localityId` to get `lat`/`lng` (skipping and logging any record whose `localityId` no longer exists in `localities.json`), groups by locality per team, and returns:
  ```json
  {
    "teamA": [{ "lat": 19.0, "lng": 72.8, "weight": 12 }],
    "teamB": [{ "lat": 12.97, "lng": 77.59, "weight": 7 }]
  }
  ```
  `weight` is the fan count at that locality.

## Client

### Profile setup (one-time)

Resolving "does this user already have a profile" is a single sequential check, to avoid the setup modal flashing for a user who has one server-side but not yet cached locally:

1. On opening the Fan Map tab, check AsyncStorage (`dugout.fanProfile`) first. If present, use it immediately (no network round-trip needed).
2. If absent, call `GET /fans/profile/:userId` and wait for that to resolve (showing a loading state) before deciding whether to show the setup modal. A 404 means truly no profile → show setup. A found profile gets written into AsyncStorage and used directly, with no modal shown.
3. Setup modal (only reached after step 2 confirms no profile exists): fetch `GET /teams`, present as a picker defaulting the visible list to the current match's two teams (with an option to see the full list) — the saved affiliation is global, not tied to this match. Then a locality picker: text input that queries `GET /localities?q=` as the user types, single-select from results.
4. On confirm, `POST /fans/profile` with the guest `userId` (from `src/lib/guest.ts`), then cache `{ teamSlug, localityId }` in AsyncStorage under `dugout.fanProfile`.

### Fan Map screen (`src/app/match/[matchId]/fan-map.tsx`)

- New tab/link alongside the existing match chat screen (`src/app/match/[matchId]/chat.tsx`), added to the match's index/nav — shown only when the match has both `teamA` and `teamB`, since `GET /matches/:matchId/fan-map` 404s otherwise. This is new gating logic, not reused from elsewhere: today `index.tsx`'s "Open chat" link renders unconditionally, and `chat.tsx`'s `hasBotTeams` check only toggles the in-chat banter buttons, not navigation — neither hides a nav link based on team presence, so this is the first instance of that pattern. Matches without both teams (e.g. `arg-esp-2026`, `bra-fra-2026` in current fixtures) simply don't show the Fan Map tab.
- Fetches `GET /matches/:matchId/fan-map` on mount, with loading and error states matching the pattern already established in `chat.tsx` (a retry affordance on failure, distinct from "loaded but empty").
- Renders `react-native-maps`' `MapView` centered/bounded on India, with two `Heatmap` layers, one per team, using distinct color gradients (e.g. red-scale for `teamA`, blue-scale for `teamB`) at moderate opacity so overlapping areas visually blend.
- If the current user's own team isn't one of this match's two teams, they simply don't appear in this map's data — no special-casing needed client-side.
- Standard map interactions (pinch/zoom/pan) come from `MapView` for free; no custom clustering/marker logic needed since density is conveyed by the heatmap layers rather than discrete pins.
- **Known limitation:** if a user's real-world city isn't among the ~40-60 seeded localities, they pick the closest available option — no free-text/custom-coordinate entry in this slice.

## Technical risks / setup requirements

- `react-native-maps`'s `Heatmap` component requires the **Google Maps provider on iOS** (Apple Maps doesn't support heatmaps natively); Android already defaults to Google Maps. This means:
  - A Google Maps API key needs to be added via the `react-native-maps` Expo config plugin in `app.json` (`iosGoogleMapsApiKey` and `androidGoogleMapsApiKey` — confirmed against the versioned SDK 57 docs during implementation planning, superseding the older `ios.config.googleMapsApiKey`/`android.config.googleMaps.apiKey` style this section originally guessed at).
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
- An edit-profile screen/affordance to change team or locality after initial setup. The backend upsert supports overwriting a profile, but this slice ships no client UI to trigger it — a user's only way to change their profile in v1 is clearing local app storage (which also resets their guest identity).
