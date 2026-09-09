import { StreamChat } from 'stream-chat';

import { requireMatch, type MatchRecord } from './matches.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

let client: StreamChat | null = null;

export function getStreamClient(): StreamChat {
  if (!client) {
    client = StreamChat.getInstance(
      requireEnv('STREAM_API_KEY'),
      requireEnv('STREAM_API_SECRET'),
    );
  }
  return client;
}

export function getApiKey(): string {
  return requireEnv('STREAM_API_KEY');
}

export async function upsertGuestUser(userId: string, name: string) {
  const stream = getStreamClient();
  await stream.upsertUser({ id: userId, name });
  return stream.createToken(userId);
}

export function matchChannelId(matchId: string): string {
  return requireMatch(matchId).channelId;
}

function channelMeta(match: MatchRecord) {
  return {
    name: match.title,
    match_id: match.id,
  };
}

export async function ensureMatchChannel(matchId: string, userId: string) {
  const match = requireMatch(matchId);
  const stream = getStreamClient();
  const channel = stream.channel(match.channelType, match.channelId, {
    ...channelMeta(match),
    created_by_id: userId,
    members: [userId],
  } as Record<string, unknown>);

  await channel.create();
  await channel.addMembers([userId]);

  return {
    channelType: match.channelType,
    channelId: match.channelId,
  };
}

export type ChatMessageLine = {
  userId: string;
  name?: string;
  text: string;
};

export function teamBotUserId(team: string): string {
  return `bot-${team}`;
}

export function teamBotDisplayName(team: string): string {
  const label = team
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `${label || 'Team'} Fan`;
}

// Stream caps a single channel.query messages page at 100, so pulling a
// larger window (e.g. 500) means paging backwards with id_lt cursors.
const MAX_PAGE_SIZE = 100;

export async function queryRecentMessages(
  matchId: string,
  limit = 20,
): Promise<ChatMessageLine[]> {
  const match = requireMatch(matchId);
  const stream = getStreamClient();
  const channel = stream.channel(match.channelType, match.channelId);

  let messages: Awaited<ReturnType<typeof channel.query>>['messages'] = [];
  let idLt: string | undefined;

  while (messages.length < limit) {
    const pageLimit = Math.min(MAX_PAGE_SIZE, limit - messages.length);
    const state = await channel.query({
      messages: { limit: pageLimit, ...(idLt ? { id_lt: idLt } : {}) },
      state: true,
    });
    const page = state.messages ?? [];
    if (page.length === 0) {
      break;
    }
    // Each page comes back oldest -> newest; prepend since we're paging
    // further into the past on every iteration.
    messages = [...page, ...messages];
    idLt = page[0]?.id;
    if (page.length < pageLimit) {
      break;
    }
  }

  return messages
    .filter((message) => typeof message.text === 'string' && message.text.trim())
    .map((message) => ({
      userId: message.user?.id ?? 'unknown',
      name: message.user?.name,
      text: message.text!.trim(),
    }));
}

export async function upsertTeamBot(team: string) {
  const stream = getStreamClient();
  const botUserId = teamBotUserId(team);
  const name = teamBotDisplayName(team);
  await stream.upsertUser({ id: botUserId, name, role: 'user' });
  return { botUserId, name };
}

export async function sendBotMessage(
  matchId: string,
  botUserId: string,
  text: string,
) {
  const match = requireMatch(matchId);
  const stream = getStreamClient();
  const channel = stream.channel(match.channelType, match.channelId, {
    ...channelMeta(match),
    created_by_id: botUserId,
    members: [botUserId],
  } as Record<string, unknown>);

  await channel.create();
  await channel.addMembers([botUserId]);

  const response = await channel.sendMessage({
    text,
    user_id: botUserId,
  });

  return {
    channelId: match.channelId,
    messageId: response.message.id,
  };
}
