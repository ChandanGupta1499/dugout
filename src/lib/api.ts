import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { Match } from '@/lib/matches';

const FETCH_TIMEOUT_MS = 12_000;

function isLoopbackHost(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

function expoDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    null;

  if (typeof hostUri !== 'string' || !hostUri.trim()) {
    return null;
  }

  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  return host;
}

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

  if (!isLoopbackHost(configured)) {
    return configured.replace(/\/$/, '');
  }

  // Physical device cannot reach the Mac via localhost — use Expo's LAN host.
  if (Device.isDevice) {
    const host = expoDevHost();
    if (host) {
      try {
        const url = new URL(configured);
        url.hostname = host;
        return url.toString().replace(/\/$/, '');
      } catch {
        return configured
          .replace('localhost', host)
          .replace('127.0.0.1', host)
          .replace(/\/$/, '');
      }
    }
  }

  // Android emulator: localhost is the emulator itself.
  if (Platform.OS === 'android') {
    return configured
      .replace('localhost', '10.0.2.2')
      .replace('127.0.0.1', '10.0.2.2')
      .replace(/\/$/, '');
  }

  return configured.replace(/\/$/, '');
}

const apiUrl = resolveApiUrl();

export type TokenResponse = {
  apiKey: string;
  token: string;
  user: { id: string; name: string };
};

export type MatchChannelResponse = {
  channelType: 'messaging';
  channelId: string;
};

export type BotBanterResponse = {
  text: string;
  botUserId: string;
  messageId: string;
  channelId: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Request failed: ${response.status}`;
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return `API returned HTML (${response.status}). Check EXPO_PUBLIC_API_URL points at your local server (http://localhost:3001) and restart Expo with -c.`;
  }
  try {
    const payload = JSON.parse(text) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Non-JSON body — return a short snippet, not a full HTML dump.
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}

async function fetchWithTimeout(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `Timed out reaching ${apiUrl}. Is the server running on port 3001? On a physical device, set EXPO_PUBLIC_API_URL to your Mac LAN IP (e.g. http://192.168.1.10:3001) and restart Expo with -c.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(path);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export function fetchMatches() {
  return getJson<Match[]>('/matches');
}

export function fetchMatch(matchId: string) {
  return getJson<Match>(`/matches/${encodeURIComponent(matchId)}`);
}

export function fetchToken(userId: string, name: string) {
  return postJson<TokenResponse>('/token', { userId, name });
}

export function ensureMatchChannel(matchId: string, userId: string) {
  return postJson<MatchChannelResponse>('/channels/match', { matchId, userId });
}

export function requestBotBanter(matchId: string, team: string) {
  return postJson<BotBanterResponse>('/bot/banter', { matchId, team });
}

export type MatchScoreboard = {
  matchId: string;
  teamA: { label: string; score: number };
  teamB: { label: string; score: number };
  clockLabel: string;
  matchMinute: number | null;
  state: 'idle' | 'running' | 'paused' | 'finished' | 'static';
};

export function fetchScoreboard(matchId: string) {
  return getJson<MatchScoreboard>(
    `/matches/${encodeURIComponent(matchId)}/scoreboard`,
  );
}

export type GiphyKind = 'gif' | 'sticker';

export type GiphyItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
};

export type GiphySearchResponse = {
  items: GiphyItem[];
};

export function searchGiphy(query: string, kind: GiphyKind, limit = 24) {
  const params = new URLSearchParams({
    kind,
    limit: String(limit),
  });
  if (query.trim()) {
    params.set('q', query.trim());
  }
  return getJson<GiphySearchResponse>(`/media/giphy?${params.toString()}`).then(
    (payload) => payload.items,
  );
}

/** Resolved API base used by the client (useful for debugging). */
export function getApiBaseUrl() {
  return apiUrl;
}
