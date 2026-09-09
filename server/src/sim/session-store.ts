import type { SimState } from './types.js';
import { getSupabase } from '../supabase.js';

export type PersistedSimSession = {
  version: 1;
  matchId: string;
  speed: number;
  kickoffOffsetMs: number;
  accumulatedMs: number;
  cursor: number;
  sentCount: number;
  /** Always paused or finished on disk; running sessions are snapshotted as paused. */
  state: Extract<SimState, 'paused' | 'finished'>;
};

type SimSessionRow = {
  match_id: string;
  version: number;
  speed: number;
  kickoff_offset_ms: number;
  accumulated_ms: number;
  cursor: number;
  sent_count: number;
  state: string;
};

function mapRow(row: SimSessionRow): PersistedSimSession | null {
  if (row.version !== 1 || typeof row.match_id !== 'string') {
    return null;
  }
  if (row.state !== 'paused' && row.state !== 'finished') {
    return null;
  }
  return {
    version: 1,
    matchId: row.match_id,
    speed: Number(row.speed),
    kickoffOffsetMs: Number(row.kickoff_offset_ms),
    accumulatedMs: Number(row.accumulated_ms),
    cursor: Number(row.cursor),
    sentCount: Number(row.sent_count),
    state: row.state,
  };
}

export async function loadPersistedSimSession(): Promise<PersistedSimSession | null> {
  const { data, error } = await getSupabase()
    .from('sim_sessions')
    .select(
      'match_id, version, speed, kickoff_offset_ms, accumulated_ms, cursor, sent_count, state',
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[sim] failed to load sim_sessions', error);
    return null;
  }
  if (!data) {
    return null;
  }
  return mapRow(data as SimSessionRow);
}

export async function savePersistedSimSession(
  data: PersistedSimSession,
): Promise<void> {
  const { error } = await getSupabase().from('sim_sessions').upsert(
    {
      match_id: data.matchId,
      version: data.version,
      speed: data.speed,
      kickoff_offset_ms: data.kickoffOffsetMs,
      accumulated_ms: data.accumulatedMs,
      cursor: data.cursor,
      sent_count: data.sentCount,
      state: data.state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'match_id' },
  );

  if (error) {
    throw new Error(`Failed to save sim session: ${error.message}`);
  }
}

export async function clearPersistedSimSession(): Promise<void> {
  const { error } = await getSupabase()
    .from('sim_sessions')
    .delete()
    .neq('match_id', '');

  if (error) {
    throw new Error(`Failed to clear sim session: ${error.message}`);
  }
}
