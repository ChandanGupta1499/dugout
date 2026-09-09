import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../data/matches.json');
let cache = null;
function loadMatches() {
    if (!cache) {
        const raw = readFileSync(dataPath, 'utf8');
        cache = JSON.parse(raw);
    }
    return cache;
}
export function listMatches() {
    return loadMatches();
}
export function getMatch(matchId) {
    return loadMatches().find((match) => match.id === matchId);
}
export function requireMatch(matchId) {
    const match = getMatch(matchId);
    if (!match) {
        throw new Error(`Unknown match: ${matchId}`);
    }
    return match;
}
export function assertTeamForMatch(match, teamSlug) {
    const allowed = [match.teamA?.slug, match.teamB?.slug].filter(Boolean);
    if (allowed.length === 0) {
        return;
    }
    if (!allowed.includes(teamSlug)) {
        throw new Error(`Team "${teamSlug}" is not part of match ${match.id}. Expected one of: ${allowed.join(', ')}`);
    }
}
