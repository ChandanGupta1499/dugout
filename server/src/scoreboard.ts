import { listMatchCommentary } from './commentary-store.js';
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

async function scoreFromSupabaseCommentary(match: MatchRecord): Promise<{
  scoreA: number;
  scoreB: number;
}> {
  const rows = await listMatchCommentary(match.id);
  let scoreA = 0;
  let scoreB = 0;

  for (const row of rows) {
    if (row.type !== 'goal' || !row.scoreAfter) {
      continue;
    }
    const parsed = parseScoreAfter(row.scoreAfter);
    if (!parsed) {
      continue;
    }
    scoreA = parsed.home;
    scoreB = parsed.away;
  }

  return { scoreA, scoreB };
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
  }

  const { scoreA, scoreB } = await scoreFromSupabaseCommentary(match);
  return {
    matchId,
    teamA: { label: match.teamA.label, score: scoreA },
    teamB: { label: match.teamB.label, score: scoreB },
    clockLabel: '—',
    matchMinute: null,
    state: 'static',
  };
}
