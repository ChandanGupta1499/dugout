import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionStatus } from './scheduler.js';
import { SIM_MATCH_ID } from './types.js';
const commentaryPath = join(dirname(fileURLToPath(import.meta.url)), '../../data/sim/commentary.json');
let cache = null;
function loadSimCommentaryFile() {
    if (!cache) {
        cache = JSON.parse(readFileSync(commentaryPath, 'utf8'));
    }
    return cache;
}
export function isSimMatch(matchId) {
    return matchId === SIM_MATCH_ID;
}
/** Current simulated match minute if a sim session is active for this match. */
export function getActiveSimMatchMinute(matchId) {
    const status = getSessionStatus();
    if (status.state === 'idle' ||
        status.matchId !== matchId ||
        (status.state !== 'running' &&
            status.state !== 'paused' &&
            status.state !== 'finished')) {
        return null;
    }
    return status.matchMinute;
}
export function getSimCommentaryUpTo(matchId, matchMinute, limit = 12) {
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
export function tryGetSimCommentary(matchId) {
    const minute = getActiveSimMatchMinute(matchId);
    if (minute == null) {
        return null;
    }
    return getSimCommentaryUpTo(matchId, minute);
}
