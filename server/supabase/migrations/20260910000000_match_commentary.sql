-- Dugout: shared match commentary (admin inject / banter context)
-- Apply in Supabase SQL editor or via CLI after 20260909100000_matches_and_sim_sessions.sql

create table if not exists public.match_commentary (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches (id) on delete cascade,
  minute_label text,
  type text,
  text text not null,
  score_after text,
  created_at timestamptz not null default now()
);

create index if not exists match_commentary_match_created_idx
  on public.match_commentary (match_id, created_at);

alter table public.match_commentary enable row level security;

-- No anon/authenticated policies: only service role (bypasses RLS) from the Express server.
