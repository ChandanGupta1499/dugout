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

export type MatchSummary = {
  id: string;
  title: string;
  subtitle: string;
  channelType: string;
  channelId: string | null;
  teamA?: { slug: string; label: string };
  teamB?: { slug: string; label: string };
};

export type CommentaryRow = {
  id: string;
  matchId: string;
  minuteLabel: string | null;
  type: string | null;
  text: string;
  scoreAfter: string | null;
  createdAt: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const ADMIN_KEY_STORAGE = 'dugout-admin-api-key';

export function getStoredAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setStoredAdminKey(key: string) {
  try {
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
  } catch {
    /* ignore */
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { adminKey?: string },
): Promise<T> {
  const { adminKey, headers, ...rest } = init ?? {};
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
      ...(headers ?? {}),
    },
    ...rest,
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

export function fetchMatches() {
  return request<MatchSummary[]>('/matches');
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

export function fetchCommentary(matchId: string, adminKey: string) {
  return request<CommentaryRow[]>(
    `/admin/commentary?matchId=${encodeURIComponent(matchId)}`,
    { adminKey },
  );
}

export function postChat(
  body: { matchId: string; text: string; author?: string },
  adminKey: string,
) {
  return request<{ messageId: string; channelId: string; userId: string }>(
    '/admin/chat',
    {
      method: 'POST',
      body: JSON.stringify(body),
      adminKey,
    },
  );
}

export function postCommentary(
  body: {
    matchId: string;
    text: string;
    minute?: string;
    type?: string;
    scoreAfter?: string;
  },
  adminKey: string,
) {
  return request<CommentaryRow>('/admin/commentary', {
    method: 'POST',
    body: JSON.stringify(body),
    adminKey,
  });
}
