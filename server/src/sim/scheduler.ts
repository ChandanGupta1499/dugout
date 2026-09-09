import { findCursorAfter, loadSimChat, peekMessages } from './chat-loader.js';
import {
  clearPersistedSimSession,
  loadPersistedSimSession,
  savePersistedSimSession,
  type PersistedSimSession,
} from './session-store.js';
import { sendCrowdMessage } from './stream-crowd.js';
import {
  SIM_MATCH_DURATION_MINUTES,
  SIM_MATCH_ID,
  type SimState,
} from './types.js';

const TICK_MS = 250;
const MAX_SENDS_PER_TICK = 3;
const PERSIST_EVERY_MS = 5_000;

export type PublicSimStatus = {
  state: SimState;
  matchId: string | null;
  speed: number;
  kickoffOffsetMs: number;
  elapsedSimMs: number;
  matchMinute: number;
  cursor: number;
  totalMessages: number;
  sentCount: number;
  lastError: string | null;
  peek: Array<{ offsetMs: number; author: string; text: string }>;
};

type Session = {
  state: SimState;
  matchId: string;
  speed: number;
  kickoffOffsetMs: number;
  startedAt: number | null;
  accumulatedMs: number;
  cursor: number;
  sentCount: number;
  lastError: string | null;
  timer: ReturnType<typeof setInterval> | null;
  sending: boolean;
  lastPersistedAt: number;
  persisting: boolean;
};

let session: Session | null = null;
let restorePromise: Promise<void> | null = null;

function emptyStatus(): PublicSimStatus {
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

function elapsedSimMs(s: Session, now = Date.now()): number {
  if (s.state === 'running' && s.startedAt != null) {
    return s.accumulatedMs + (now - s.startedAt) * s.speed;
  }
  return s.accumulatedMs;
}

function matchMinuteFromElapsed(elapsedMs: number): number {
  const minute = elapsedMs / 60_000;
  return Math.min(SIM_MATCH_DURATION_MINUTES, Math.max(0, minute));
}

function endMs(): number {
  return SIM_MATCH_DURATION_MINUTES * 60_000;
}

function toPersisted(s: Session): PersistedSimSession {
  const elapsed = Math.min(elapsedSimMs(s), endMs());
  const finished = s.state === 'finished' || elapsed >= endMs();
  return {
    version: 1,
    matchId: s.matchId,
    speed: s.speed,
    kickoffOffsetMs: s.kickoffOffsetMs,
    accumulatedMs: elapsed,
    cursor: s.cursor,
    sentCount: s.sentCount,
    state: finished ? 'finished' : 'paused',
  };
}

function persistSession(s: Session, force = false): void {
  const now = Date.now();
  if (!force && now - s.lastPersistedAt < PERSIST_EVERY_MS) {
    return;
  }
  if (s.persisting) {
    return;
  }
  s.persisting = true;
  s.lastPersistedAt = now;
  const snapshot = toPersisted(s);
  void savePersistedSimSession(snapshot)
    .catch((error) => {
      console.error('[sim] failed to persist session', error);
    })
    .finally(() => {
      s.persisting = false;
    });
}

async function restoreSessionFromStore(): Promise<void> {
  const saved = await loadPersistedSimSession();
  if (!saved) {
    return;
  }
  if (saved.matchId !== SIM_MATCH_ID) {
    console.warn(
      `[sim] ignoring persisted session for unknown match ${saved.matchId}`,
    );
    return;
  }

  session = {
    state: saved.state,
    matchId: saved.matchId,
    speed: saved.speed,
    kickoffOffsetMs: saved.kickoffOffsetMs,
    startedAt: null,
    accumulatedMs: Math.max(0, saved.accumulatedMs),
    cursor: Math.max(0, saved.cursor),
    sentCount: Math.max(0, saved.sentCount),
    lastError: null,
    timer: null,
    sending: false,
    lastPersistedAt: Date.now(),
    persisting: false,
  };

  console.log(
    `[sim] restored ${saved.state} session at ${Math.round(saved.accumulatedMs / 1000)}s (cursor ${saved.cursor})`,
  );
}

/** Load paused/finished sim from Supabase before accepting traffic. */
export function initSimFromStore(): Promise<void> {
  if (!restorePromise) {
    restorePromise = restoreSessionFromStore().catch((error) => {
      console.error('[sim] failed to restore session from Supabase', error);
    });
  }
  return restorePromise;
}

export function getSessionStatus(): PublicSimStatus {
  if (!session) {
    return emptyStatus();
  }
  const elapsed = elapsedSimMs(session);
  return {
    state: session.state,
    matchId: session.matchId,
    speed: session.speed,
    kickoffOffsetMs: session.kickoffOffsetMs,
    elapsedSimMs: Math.min(elapsed, endMs()),
    matchMinute: matchMinuteFromElapsed(elapsed),
    cursor: session.cursor,
    totalMessages: loadSimChat().length,
    sentCount: session.sentCount,
    lastError: session.lastError,
    peek: peekMessages(session.cursor, 20),
  };
}

function clearTimer(s: Session) {
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

  if (elapsed >= endMs()) {
    s.accumulatedMs = endMs();
    s.startedAt = null;
    s.state = 'finished';
    clearTimer(s);
    persistSession(s, true);
    return;
  }

  const threshold = s.kickoffOffsetMs + elapsed;
  const messages = loadSimChat();
  let sentThisTick = 0;

  s.sending = true;
  try {
    while (
      s.cursor < messages.length &&
      messages[s.cursor]!.offsetMs <= threshold &&
      sentThisTick < MAX_SENDS_PER_TICK
    ) {
      const msg = messages[s.cursor]!;
      // Skip messages before kickoff window (pre-match chatter when kickoffOffset > 0)
      if (msg.offsetMs < s.kickoffOffsetMs) {
        s.cursor += 1;
        continue;
      }
      try {
        await sendCrowdMessage(s.matchId, msg.author, msg.text);
        s.sentCount += 1;
        sentThisTick += 1;
      } catch (error) {
        s.lastError =
          error instanceof Error ? error.message : 'Failed to send crowd message';
        console.error('[sim] send failed', error);
        break;
      }
      s.cursor += 1;
    }

    // If cursor is still before kickoff, jump to first due message
    if (
      s.cursor < messages.length &&
      messages[s.cursor]!.offsetMs < s.kickoffOffsetMs
    ) {
      s.cursor = findCursorAfter(s.kickoffOffsetMs - 1);
    }
  } finally {
    s.sending = false;
  }

  persistSession(s);
}

export function startSim(options: {
  matchId?: string;
  speed?: number;
  kickoffOffsetMs?: number;
}) {
  if (session && (session.state === 'running' || session.state === 'paused')) {
    throw new Error('Sim already active; stop it first');
  }

  const matchId = options.matchId?.trim() || SIM_MATCH_ID;
  if (matchId !== SIM_MATCH_ID) {
    throw new Error(`Sim only supports match ${SIM_MATCH_ID}`);
  }

  const speed = Number(options.speed ?? 1);
  if (![1, 2, 3, 5, 10].includes(speed)) {
    throw new Error('speed must be 1, 2, 3, 5, or 10');
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
    lastPersistedAt: 0,
    persisting: false,
  };

  persistSession(session, true);

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
  persistSession(session, true);
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
  persistSession(session, true);
  void tick();
  return getSessionStatus();
}

export function setSimSpeed(speed: number) {
  if (!session || (session.state !== 'running' && session.state !== 'paused')) {
    throw new Error('Sim is not active');
  }
  if (![1, 2, 3, 5, 10].includes(speed)) {
    throw new Error('speed must be 1, 2, 3, 5, or 10');
  }
  if (session.state === 'running') {
    session.accumulatedMs = elapsedSimMs(session);
    session.startedAt = Date.now();
  }
  session.speed = speed;
  persistSession(session, true);
  return getSessionStatus();
}

export function stopSim() {
  if (session) {
    clearTimer(session);
  }
  session = null;
  void clearPersistedSimSession().catch((error) => {
    console.error('[sim] failed to clear sim session', error);
  });
  return getSessionStatus();
}
