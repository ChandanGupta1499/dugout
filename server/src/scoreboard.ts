import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMatch, type MatchRecord } from './matches.js';
import {
  getActiveSimMatchMinute,
  isSimMatch,
  loadSimCommentaryEvents,
} from './sim/commentary.js';
import { getSessionStatus } from './sim/scheduler.js';

export type MatchScoreboard = {
  matchId: string;
  teamA: { label: string; score: number };
  teamB: { label: string; score: number };
  /** Display clock, e.g. `55'`, `FT`, or `—` when not live. */
  clockLabel: string;
  matchMinute: number | null;
  state: 'idle' | 'running' | 'paused' | 'finished' | 'static';
};

const GOAL_SCORE_RE = /^Goal!\s+(.+?)\s+(\d+),\s+(.+?)\s+(\d+)\./i;

type StubCommentaryEvent = {
  type?: string;
  team?: string;
  score_after?: string;
  minute?: string;
};

type StubCommentaryFile = Record<
  string,
  {
    commentary_timeline?: StubCommentaryEvent[];
  }
>;

const stubCommentaryPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../data/commentary.json',
);

function emptyScores(match: MatchRecord): {
  teamA: { label: string; score: number };
  teamB: { label: string; score: number };
} {
  return {
    teamA: { label: match.teamA!.label, score: 0 },
    teamB: { label: match.teamB!.label, score: 0 },
  };
}

function applyNamedScoreline(
  text: string,
  teamALabel: string,
  teamBLabel: string,
): { scoreA: number; scoreB: number } | null {
  const match = text.match(GOAL_SCORE_RE);
  if (!match) {
    return null;
  }
  const scores: Record<string, number> = {
    [match[1]]: Number(match[2]),
    [match[3]]: Number(match[4]),
  };
  if (scores[teamALabel] == null || scores[teamBLabel] == null) {
    return null;
  }
  return { scoreA: scores[teamALabel], scoreB: scores[teamBLabel] };
}

function scoreFromSimGoals(
  match: MatchRecord,
  matchMinute: number,
): { scoreA: number; scoreB: number } {
  const teamALabel = match.teamA!.label;
  const teamBLabel = match.teamB!.label;
  let scoreA = 0;
  let scoreB = 0;

  for (const event of loadSimCommentaryEvents(match.id)) {
    if (event.matchMinute > matchMinute) {
      break;
    }
    const next = applyNamedScoreline(event.text, teamALabel, teamBLabel);
    if (next) {
      scoreA = next.scoreA;
      scoreB = next.scoreB;
    }
  }

  return { scoreA, scoreB };
}

function parseScoreAfter(
  scoreAfter: string,
): { home: number; away: number } | null {
  const match = scoreAfter.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!match) {
    return null;
  }
  return { home: Number(match[1]), away: Number(match[2]) };
}

function scoreFromStubCommentary(match: MatchRecord): {
  scoreA: number;
  scoreB: number;
} {
  try {
    const raw = readFileSync(stubCommentaryPath, 'utf8');
    const data = JSON.parse(raw) as StubCommentaryFile;
    const timeline = data[match.id]?.commentary_timeline ?? [];
    let scoreA = 0;
    let scoreB = 0;

    for (const event of timeline) {
      if (event.type !== 'goal' || !event.score_after) {
        continue;
      }
      const parsed = parseScoreAfter(event.score_after);
      if (!parsed) {
        continue;
      }
      // Stub files treat score_after as teamA-teamB for the match's home/away order.
      scoreA = parsed.home;
      scoreB = parsed.away;
    }

    return { scoreA, scoreB };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { scoreA: 0, scoreB: 0 };
    }
    throw error;
  }
}

function formatClock(matchMinute: number, state: MatchScoreboard['state']): string {
  if (state === 'finished') {
    return 'FT';
  }
  return `${Math.floor(matchMinute)}'`;
}

export async function getMatchScoreboard(
  matchId: string,
): Promise<MatchScoreboard | null> {
  const match = await getMatch(matchId);
  if (!match?.teamA || !match?.teamB) {
    return null;
  }

  if (isSimMatch(matchId)) {
    const status = getSessionStatus();
    const activeMinute = getActiveSimMatchMinute(matchId);
    if (activeMinute != null && status.matchId === matchId) {
      const { scoreA, scoreB } = scoreFromSimGoals(match, activeMinute);
      return {
        matchId,
        teamA: { label: match.teamA.label, score: scoreA },
        teamB: { label: match.teamB.label, score: scoreB },
        clockLabel: formatClock(activeMinute, status.state),
        matchMinute: activeMinute,
        state: status.state,
      };
    }

    return {
      matchId,
      ...emptyScores(match),
      clockLabel: '—',
      matchMinute: null,
      state: 'idle',
    };
  }

  const { scoreA, scoreB } = scoreFromStubCommentary(match);
  return {
    matchId,
    teamA: { label: match.teamA.label, score: scoreA },
    teamB: { label: match.teamB.label, score: scoreB },
    clockLabel: '—',
    matchMinute: null,
    state: 'static',
  };
}
