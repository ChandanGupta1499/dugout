export type SimStatus = {
  state: 'idle' | 'running' | 'paused' | 'finished';
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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

export function fetchStatus() {
  return request<SimStatus>('/sim/status');
}

export function startSim(body: {
  matchId: string;
  speed: number;
  kickoffOffsetMs: number;
}) {
  return request<SimStatus>('/sim/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function pauseSim() {
  return request<SimStatus>('/sim/pause', { method: 'POST', body: '{}' });
}

export function resumeSim() {
  return request<SimStatus>('/sim/resume', { method: 'POST', body: '{}' });
}

export function stopSim() {
  return request<SimStatus>('/sim/stop', { method: 'POST', body: '{}' });
}

export function setSpeed(speed: number) {
  return request<SimStatus>('/sim/speed', {
    method: 'POST',
    body: JSON.stringify({ speed }),
  });
}
