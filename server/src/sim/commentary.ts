import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSessionStatus, type PublicSimStatus } from './scheduler.js';
import { SIM_MATCH_ID, type SimCommentaryEvent } from './types.js';

export type SimCommentaryLine = {
  text: string;
  at?: string;
};

const commentaryPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../data/sim/commentary.json',
);

type SimCommentaryFile = {
  matchId: string;
  events: SimCommentaryEvent[];
};

let cache: SimCommentaryFile | null = null;

function loadSimCommentaryFile(): SimCommentaryFile {
  if (!cache) {
    cache = JSON.parse(readFileSync(commentaryPath, 'utf8')) as SimCommentaryFile;
  }
  return cache;
}

export function loadSimCommentaryEvents(matchId: string): SimCommentaryEvent[] {
  if (!isSimMatch(matchId)) {
    return [];
  }
  return loadSimCommentaryFile().events;
}

export function isSimMatch(matchId: string): boolean {
  return matchId === SIM_MATCH_ID;
}

/** Current simulated match minute if a sim session is active for this match. */
export function getActiveSimMatchMinute(matchId: string): number | null {
  const status: PublicSimStatus = getSessionStatus();
  if (
    status.state === 'idle' ||
    status.matchId !== matchId ||
    (status.state !== 'running' &&
      status.state !== 'paused' &&
      status.state !== 'finished')
  ) {
    return null;
  }
  return status.matchMinute;
}

export function getSimCommentaryUpTo(
  matchId: string,
  matchMinute: number,
  limit = 12,
): SimCommentaryLine[] {
  if (!isSimMatch(matchId)) {
    return [];
  }
  const { events } = loadSimCommentaryFile();
  const due = events.filter((event) => event.matchMinute <= matchMinute);
  const slice = due.slice(-limit);
  return slice.map((event) => ({
    text: event.text,
    at: event.label || `${event.matchMinute}'`,
  }));
}

/** Used by context.ts: return time-filtered sim commentary or null to fall back. */
export function tryGetSimCommentary(matchId: string): SimCommentaryLine[] | null {
  const minute = getActiveSimMatchMinute(matchId);
  if (minute == null) {
    return null;
  }
  return getSimCommentaryUpTo(matchId, minute);
}
