import { getSupabase } from './supabase.js';

export type MatchCommentaryRow = {
  id: string;
  matchId: string;
  minuteLabel: string | null;
  type: string | null;
  text: string;
  scoreAfter: string | null;
  createdAt: string;
};

type DbRow = {
  id: string;
  match_id: string;
  minute_label: string | null;
  type: string | null;
  text: string;
  score_after: string | null;
  created_at: string;
};

function mapRow(row: DbRow): MatchCommentaryRow {
  return {
    id: row.id,
    matchId: row.match_id,
    minuteLabel: row.minute_label?.trim() || null,
    type: row.type?.trim() || null,
    text: row.text,
    scoreAfter: row.score_after?.trim() || null,
    createdAt: row.created_at,
  };
}

export async function listMatchCommentary(
  matchId: string,
  limit = 50,
): Promise<MatchCommentaryRow[]> {
  const { data, error } = await getSupabase()
    .from('match_commentary')
    .select(
      'id, match_id, minute_label, type, text, score_after, created_at',
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as DbRow[] | null)?.map(mapRow) ?? [];
}

export async function insertMatchCommentary(input: {
  matchId: string;
  text: string;
  minuteLabel?: string | null;
  type?: string | null;
  scoreAfter?: string | null;
}): Promise<MatchCommentaryRow> {
  const { data, error } = await getSupabase()
    .from('match_commentary')
    .insert({
      match_id: input.matchId,
      text: input.text,
      minute_label: input.minuteLabel?.trim() || null,
      type: input.type?.trim() || null,
      score_after: input.scoreAfter?.trim() || null,
    })
    .select(
      'id, match_id, minute_label, type, text, score_after, created_at',
    )
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data as DbRow);
}
