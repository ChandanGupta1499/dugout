import { listMatchCommentary } from './commentary-store.js';
import { tryGetSimCommentary } from './sim/index.js';
import { queryRecentMessages, type ChatMessageLine } from './stream.js';

export type CommentaryLine = {
  text: string;
  at?: string;
};

export async function getRecentChat(matchId: string): Promise<ChatMessageLine[]> {
  return queryRecentMessages(matchId, 500);
}

/**
 * Commentary for banter: active sim JSON when a sim session is on for this match;
 * otherwise Supabase match_commentary. Empty array if neither has data (no stub file).
 */
export async function getRecentCommentary(
  matchId: string,
): Promise<CommentaryLine[]> {
  const simLines = tryGetSimCommentary(matchId);
  if (simLines) {
    return simLines;
  }

  const rows = await listMatchCommentary(matchId);
  return rows
    .filter((row) => row.text.trim())
    .map((row) => ({
      text: row.text.trim(),
      at: row.minuteLabel ?? undefined,
    }));
}
