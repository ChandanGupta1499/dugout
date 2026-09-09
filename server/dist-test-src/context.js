import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryGetSimCommentary } from './sim/index.js';
import { queryRecentMessages } from './stream.js';
const commentaryPath = join(dirname(fileURLToPath(import.meta.url)), '../data/commentary.json');
export async function getRecentChat(matchId) {
    return queryRecentMessages(matchId, 20);
}
/** Mock live commentary from data/commentary.json (re-read each call so edits apply without rebuild). */
export async function getRecentCommentary(matchId) {
    const simLines = tryGetSimCommentary(matchId);
    if (simLines) {
        return simLines;
    }
    try {
        const raw = readFileSync(commentaryPath, 'utf8');
        const data = JSON.parse(raw);
        const timeline = data[matchId]?.commentary_timeline ?? [];
        return timeline
            .filter((event) => typeof event.text === 'string' && event.text.trim())
            .map((event) => ({
            text: event.text.trim(),
            at: event.minute?.trim() || undefined,
        }));
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}
