import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type MatchTeam = {
  slug: string;
  label: string;
};

export type MatchRecord = {
  id: string;
  title: string;
  subtitle: string;
  channelType: 'messaging';
  channelId: string;
  teamA?: MatchTeam;
  teamB?: MatchTeam;
};

const dataPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../data/matches.json',
);

let cache: MatchRecord[] | null = null;

function loadMatches(): MatchRecord[] {
  if (!cache) {
    const raw = readFileSync(dataPath, 'utf8');
    cache = JSON.parse(raw) as MatchRecord[];
  }
  return cache;
}

export function listMatches(): MatchRecord[] {
  return loadMatches();
}

export function getMatch(matchId: string): MatchRecord | undefined {
  return loadMatches().find((match) => match.id === matchId);
}

export function requireMatch(matchId: string): MatchRecord {
  const match = getMatch(matchId);
  if (!match) {
    throw new Error(`Unknown match: ${matchId}`);
  }
  return match;
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
