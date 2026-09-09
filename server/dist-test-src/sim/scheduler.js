import { findCursorAfter, loadSimChat, peekMessages } from './chat-loader.js';
import { sendCrowdMessage } from './stream-crowd.js';
import { SIM_MATCH_DURATION_MINUTES, SIM_MATCH_ID, } from './types.js';
const TICK_MS = 250;
const MAX_SENDS_PER_TICK = 3;
let session = null;
function emptyStatus() {
    return {
        state: 'idle',
        matchId: null,
        speed: 1,
        kickoffOffsetMs: 0,
        elapsedSimMs: 0,
        matchMinute: 0,
        cursor: 0,
        totalMessages: loadSimChat().length,
        sentCount: 0,
        lastError: null,
        peek: peekMessages(0, 20),
    };
}
function elapsedSimMs(s, now = Date.now()) {
    if (s.state === 'running' && s.startedAt != null) {
        return s.accumulatedMs + (now - s.startedAt) * s.speed;
    }
    return s.accumulatedMs;
}
function matchMinuteFromElapsed(elapsedMs) {
    const minute = elapsedMs / 60000;
    return Math.min(SIM_MATCH_DURATION_MINUTES, Math.max(0, minute));
}
export function getSessionStatus() {
    if (!session) {
        return emptyStatus();
    }
    const elapsed = elapsedSimMs(session);
    const endMs = SIM_MATCH_DURATION_MINUTES * 60000;
    return {
        state: session.state,
        matchId: session.matchId,
        speed: session.speed,
        kickoffOffsetMs: session.kickoffOffsetMs,
        elapsedSimMs: Math.min(elapsed, endMs),
        matchMinute: matchMinuteFromElapsed(elapsed),
        cursor: session.cursor,
        totalMessages: loadSimChat().length,
        sentCount: session.sentCount,
        lastError: session.lastError,
        peek: peekMessages(session.cursor, 20),
    };
}
function clearTimer(s) {
    if (s.timer) {
        clearInterval(s.timer);
        s.timer = null;
    }
}
async function tick() {
    if (!session || session.state !== 'running' || session.sending) {
        return;
    }
    const s = session;
    const elapsed = elapsedSimMs(s);
    const endMs = SIM_MATCH_DURATION_MINUTES * 60000;
    if (elapsed >= endMs) {
        s.accumulatedMs = endMs;
        s.startedAt = null;
        s.state = 'finished';
        clearTimer(s);
        return;
    }
    const threshold = s.kickoffOffsetMs + elapsed;
    const messages = loadSimChat();
    let sentThisTick = 0;
    s.sending = true;
    try {
        while (s.cursor < messages.length &&
            messages[s.cursor].offsetMs <= threshold &&
            sentThisTick < MAX_SENDS_PER_TICK) {
            const msg = messages[s.cursor];
            // Skip messages before kickoff window (pre-match chatter when kickoffOffset > 0)
            if (msg.offsetMs < s.kickoffOffsetMs) {
                s.cursor += 1;
                continue;
            }
            try {
                await sendCrowdMessage(s.matchId, msg.author, msg.text);
                s.sentCount += 1;
                sentThisTick += 1;
            }
            catch (error) {
                s.lastError =
                    error instanceof Error ? error.message : 'Failed to send crowd message';
                console.error('[sim] send failed', error);
                break;
            }
            s.cursor += 1;
        }
        // If cursor is still before kickoff, jump to first due message
        if (s.cursor < messages.length &&
            messages[s.cursor].offsetMs < s.kickoffOffsetMs) {
            s.cursor = findCursorAfter(s.kickoffOffsetMs - 1);
        }
    }
    finally {
        s.sending = false;
    }
}
export function startSim(options) {
    if (session && (session.state === 'running' || session.state === 'paused')) {
        throw new Error('Sim already active; stop it first');
    }
    const matchId = options.matchId?.trim() || SIM_MATCH_ID;
    if (matchId !== SIM_MATCH_ID) {
        throw new Error(`Sim only supports match ${SIM_MATCH_ID}`);
    }
    const speed = Number(options.speed ?? 1);
    if (![1, 5, 10].includes(speed)) {
        throw new Error('speed must be 1, 5, or 10');
    }
    const kickoffOffsetMs = Math.max(0, Number(options.kickoffOffsetMs ?? 0));
    const cursor = findCursorAfter(kickoffOffsetMs - 1);
    session = {
        state: 'running',
        matchId,
        speed,
        kickoffOffsetMs,
        startedAt: Date.now(),
        accumulatedMs: 0,
        cursor,
        sentCount: 0,
        lastError: null,
        timer: null,
        sending: false,
    };
    session.timer = setInterval(() => {
        void tick();
    }, TICK_MS);
    void tick();
    return getSessionStatus();
}
export function pauseSim() {
    if (!session || session.state !== 'running') {
        throw new Error('Sim is not running');
    }
    session.accumulatedMs = elapsedSimMs(session);
    session.startedAt = null;
    session.state = 'paused';
    clearTimer(session);
    return getSessionStatus();
}
export function resumeSim() {
    if (!session || session.state !== 'paused') {
        throw new Error('Sim is not paused');
    }
    session.startedAt = Date.now();
    session.state = 'running';
    session.timer = setInterval(() => {
        void tick();
    }, TICK_MS);
    void tick();
    return getSessionStatus();
}
export function setSimSpeed(speed) {
    if (!session || (session.state !== 'running' && session.state !== 'paused')) {
        throw new Error('Sim is not active');
    }
    if (![1, 5, 10].includes(speed)) {
        throw new Error('speed must be 1, 5, or 10');
    }
    if (session.state === 'running') {
        session.accumulatedMs = elapsedSimMs(session);
        session.startedAt = Date.now();
    }
    session.speed = speed;
    return getSessionStatus();
}
export function stopSim() {
    if (session) {
        clearTimer(session);
    }
    session = null;
    return getSessionStatus();
}
