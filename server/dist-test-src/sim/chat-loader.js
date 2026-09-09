import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const chatPath = join(dirname(fileURLToPath(import.meta.url)), '../../data/sim/chat.json');
let cache = null;
export function loadSimChat() {
    if (!cache) {
        const raw = readFileSync(chatPath, 'utf8');
        cache = JSON.parse(raw);
    }
    return cache;
}
/** First index with offsetMs > threshold (messages still pending after threshold). */
export function findCursorAfter(offsetMs) {
    const messages = loadSimChat();
    let lo = 0;
    let hi = messages.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (messages[mid].offsetMs <= offsetMs) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }
    return lo;
}
export function peekMessages(cursor, limit = 20) {
    const messages = loadSimChat();
    return messages.slice(cursor, cursor + limit);
}
