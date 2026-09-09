import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tryGetSimCommentary } from './sim/index.js';
import { queryRecentMessages, type ChatMessageLine } from './stream.js';

export type CommentaryLine = {
  text: string;
  at?: string;
};

type CommentaryEvent = {
  minute?: string;
  type?: string;
  text: string;
};

type CommentaryFile = Record<
  string,
  {
    commentary_timeline?: CommentaryEvent[];
  }
>;

const commentaryPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../data/commentary.json',
);

export async function getRecentChat(matchId: string): Promise<ChatMessageLine[]> {
  return queryRecentMessages(matchId, 500);
}

/** Mock live commentary from data/commentary.json (re-read each call so edits apply without rebuild). */
export async function getRecentCommentary(
  matchId: string,
): Promise<CommentaryLine[]> {
  const simLines = tryGetSimCommentary(matchId);
  if (simLines) {
    return simLines;
  }

  try {
    const raw = readFileSync(commentaryPath, 'utf8');
    const data = JSON.parse(raw) as CommentaryFile;
    const timeline = data[matchId]?.commentary_timeline ?? [];
    return timeline
      .filter((event) => typeof event.text === 'string' && event.text.trim())
      .map((event) => ({
        text: event.text.trim(),
        at: event.minute?.trim() || undefined,
      }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
