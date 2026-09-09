import { createHash } from 'node:crypto';

import { requireMatchWithChannel } from '../matches.js';
import { getStreamClient } from '../stream.js';

function shortHash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 8);
}

export function crowdUserId(author: string): string {
  return `yt-${shortHash(author)}`;
}

const upserted = new Set<string>();
const ensuredChannels = new Set<string>();

async function ensureChannel(matchId: string, userId: string) {
  const match = await requireMatchWithChannel(matchId);
  const key = `${match.channelType}:${match.channelId}`;
  const stream = getStreamClient();
  const channel = stream.channel(match.channelType, match.channelId, {
    name: match.title,
    match_id: match.id,
    created_by_id: userId,
    members: [userId],
  } as Record<string, unknown>);

  if (!ensuredChannels.has(key)) {
    await channel.create();
    ensuredChannels.add(key);
  }
  await channel.addMembers([userId]);
  return { channel, match };
}

export async function sendCrowdMessage(
  matchId: string,
  author: string,
  text: string,
) {
  const userId = crowdUserId(author);
  const name = author.replace(/^@/, '').slice(0, 40) || 'viewer';
  const stream = getStreamClient();

  if (!upserted.has(userId)) {
    await stream.upsertUser({ id: userId, name, role: 'user' });
    upserted.add(userId);
  }

  const { channel, match } = await ensureChannel(matchId, userId);

  const response = await channel.sendMessage({
    text,
    user_id: userId,
  });

  return {
    channelId: match.channelId,
    messageId: response.message.id,
    userId,
  };
}
