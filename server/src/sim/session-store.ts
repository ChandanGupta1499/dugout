import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SimState } from './types.js';

export type PersistedSimSession = {
  version: 1;
  matchId: string;
  speed: number;
  kickoffOffsetMs: number;
  accumulatedMs: number;
  cursor: number;
  sentCount: number;
  /** Always paused or finished on disk; running sessions are snapshotted as paused. */
  state: Extract<SimState, 'paused' | 'finished'>;
};

const sessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../data/sim/session.json',
);

export function loadPersistedSimSession(): PersistedSimSession | null {
  if (!existsSync(sessionPath)) {
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(sessionPath, 'utf8')) as PersistedSimSession;
    if (raw?.version !== 1 || typeof raw.matchId !== 'string') {
      return null;
    }
    if (raw.state !== 'paused' && raw.state !== 'finished') {
      return null;
    }
    return raw;
  } catch (error) {
    console.error('[sim] failed to load session.json', error);
    return null;
  }
}

export function savePersistedSimSession(data: PersistedSimSession): void {
  mkdirSync(dirname(sessionPath), { recursive: true });
  writeFileSync(sessionPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function clearPersistedSimSession(): void {
  if (existsSync(sessionPath)) {
    unlinkSync(sessionPath);
  }
}
