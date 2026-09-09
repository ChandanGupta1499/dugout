# Supabase: sim session + matches — Design

## Problem

Render (and any ephemeral host) loses on-disk `session.json` across redeploy/sleep. Match fixtures in `matches.json` also cannot be edited without a redeploy. We need durable server-side storage for the active sim clock and the match catalogue, including matches that do not yet have a Stream channel.

## Goals

- Persist the one active sim session in Supabase so elapsed time / cursor survive process restarts.
- On boot, restore that session as **paused** (never auto-run).
- Serve the match list from Supabase; each match may have a nullable Stream channel id (`channel_id`).
- Expo always lists matches; chat is only enabled when `channelId` is present.
- Supabase is **required** (no local JSON fallback for matches or sim session).

## Non-goals

- Admin CRUD HTTP API for matches (edit via Supabase dashboard / SQL).
- Migrating commentary, fans, or other JSON fixtures.
- Expo (or sim-ui) talking to Supabase directly — only the Express server uses the service role.
- Auto-creating Stream channels when `channel_id` is null.

## Data model

### `matches`

| Column | Notes |
|--------|--------|
| `id` | text PK |
| `title`, `subtitle` | text |
| `channel_type` | default `messaging` |
| `channel_id` | text **nullable** (Stream channel id) |
| `team_a_slug`, `team_a_label`, `team_b_slug`, `team_b_label` | nullable |
| `sort_order` | int |
| `created_at`, `updated_at` | timestamptz |

API shape keeps `channelId: string | null` (camelCase). Seed from the former `server/data/matches.json` rows.

### `sim_sessions`

Same fields as the former `PersistedSimSession`: `match_id` PK, `version`, `speed`, `kickoff_offset_ms`, `accumulated_ms`, `cursor`, `sent_count`, `state` (`paused` \| `finished`), `updated_at`.

Running sessions are snapshotted as `paused` on disk (same as before).

RLS: deny anon; server uses **service role** only.

## Runtime behavior

### Sim

- In-memory scheduler remains source of truth while the process is up.
- Force-persist on start / pause / resume / stop / finish / speed change.
- Throttle tick persists (~5s).
- Stop deletes the row.
- Boot: load row → restore paused/finished in memory.

### Matches + Stream

- `GET /matches` and `GET /matches/:id` read from Supabase (all rows, including null `channel_id`).
- `POST /channels/match`, bot banter, sim crowd send, and message queries require a non-null `channel_id` or return **400**.

### App

- Match list always shows every match; optional “Chat coming soon” when no channel.
- Match detail hides/disables “Open chat” when `channelId` is null.
- Chat screen fails closed if opened without a channel.

## Env

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Both required for the server to run match/sim persistence paths. Also set on Render.

## Migration

SQL under `server/supabase/migrations/` creates tables, enables RLS without anon policies, and seeds the four known matches.
