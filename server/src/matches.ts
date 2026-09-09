import { getSupabase } from './supabase.js';

export type MatchTeam = {
  slug: string;
  label: string;
};

export type MatchRecord = {
  id: string;
  title: string;
  subtitle: string;
  channelType: 'messaging';
  channelId: string | null;
  teamA?: MatchTeam;
  teamB?: MatchTeam;
};

type MatchRow = {
  id: string;
  title: string;
  subtitle: string;
  channel_type: string;
  channel_id: string | null;
  team_a_slug: string | null;
  team_a_label: string | null;
  team_b_slug: string | null;
  team_b_label: string | null;
};

function mapRow(row: MatchRow): MatchRecord {
  const teamA =
    row.team_a_slug && row.team_a_label
      ? { slug: row.team_a_slug, label: row.team_a_label }
      : undefined;
  const teamB =
    row.team_b_slug && row.team_b_label
      ? { slug: row.team_b_slug, label: row.team_b_label }
      : undefined;

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    channelType: 'messaging',
    channelId: row.channel_id?.trim() || null,
    ...(teamA ? { teamA } : {}),
    ...(teamB ? { teamB } : {}),
  };
}

export async function listMatches(): Promise<MatchRecord[]> {
  const { data, error } = await getSupabase()
    .from('matches')
    .select(
      'id, title, subtitle, channel_type, channel_id, team_a_slug, team_a_label, team_b_slug, team_b_label',
    )
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  return (data as MatchRow[] | null)?.map(mapRow) ?? [];
}

export async function getMatch(
  matchId: string,
): Promise<MatchRecord | undefined> {
  const { data, error } = await getSupabase()
    .from('matches')
    .select(
      'id, title, subtitle, channel_type, channel_id, team_a_slug, team_a_label, team_b_slug, team_b_label',
    )
    .eq('id', matchId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load match: ${error.message}`);
  }
  if (!data) {
    return undefined;
  }
  return mapRow(data as MatchRow);
}

export async function requireMatch(matchId: string): Promise<MatchRecord> {
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error(`Unknown match: ${matchId}`);
  }
  return match;
}

/** Throws if the match has no Stream channel id. */
export async function requireMatchWithChannel(
  matchId: string,
): Promise<MatchRecord & { channelId: string }> {
  const match = await requireMatch(matchId);
  if (!match.channelId) {
    throw new Error(
      `Match "${matchId}" has no Stream channel id; chat is not available yet`,
    );
  }
  return match as MatchRecord & { channelId: string };
}

export function assertTeamForMatch(match: MatchRecord, teamSlug: string): void {
  const allowed = [match.teamA?.slug, match.teamB?.slug].filter(Boolean);
  if (allowed.length === 0) {
    return;
  }
  if (!allowed.includes(teamSlug)) {
    throw new Error(
      `Team "${teamSlug}" is not part of match ${match.id}. Expected one of: ${allowed.join(', ')}`,
    );
  }
}
