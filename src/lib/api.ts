import { Platform } from 'react-native';

import type { Match } from '@/lib/matches';

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

  // Android emulator: localhost is the emulator, not the host machine.
  if (
    Platform.OS === 'android' &&
    (configured.includes('localhost') || configured.includes('127.0.0.1'))
  ) {
    return configured
      .replace('localhost', '10.0.2.2')
      .replace('127.0.0.1', '10.0.2.2');
  }

  return configured;
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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
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
