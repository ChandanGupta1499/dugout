-- Dugout: matches + sim_sessions
-- Apply in Supabase SQL editor or via CLI: supabase db push / psql

create table if not exists public.matches (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  channel_type text not null default 'messaging',
  channel_id text,
  team_a_slug text,
  team_a_label text,
  team_b_slug text,
  team_b_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sim_sessions (
  match_id text primary key,
  version integer not null default 1,
  speed double precision not null default 1,
  kickoff_offset_ms bigint not null default 0,
  accumulated_ms bigint not null default 0,
  cursor integer not null default 0,
  sent_count integer not null default 0,
  state text not null check (state in ('paused', 'finished')),
  updated_at timestamptz not null default now()
);

alter table public.matches enable row level security;
alter table public.sim_sessions enable row level security;

-- No anon/authenticated policies: only service role (bypasses RLS) from the Express server.

insert into public.matches (
  id,
  title,
  subtitle,
  channel_type,
  channel_id,
  team_a_slug,
  team_a_label,
  team_b_slug,
  team_b_label,
  sort_order
) values
  (
    'bar-fey-2026',
    'Barcelona vs Feyenoord',
    'Live match chat',
    'messaging',
    'match-bar-fey-2026',
    'barcelona',
    'Barcelona',
    'feyenoord',
    'Feyenoord',
    1
  )
on conflict (id) do nothing;
