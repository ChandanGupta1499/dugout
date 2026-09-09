import { StreamChat } from 'stream-chat';
import { requireMatch } from './matches.js';
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
let client = null;
export function getStreamClient() {
    if (!client) {
        client = StreamChat.getInstance(requireEnv('STREAM_API_KEY'), requireEnv('STREAM_API_SECRET'));
    }
    return client;
}
export function getApiKey() {
    return requireEnv('STREAM_API_KEY');
}
export async function upsertGuestUser(userId, name) {
    const stream = getStreamClient();
    await stream.upsertUser({ id: userId, name });
    return stream.createToken(userId);
}
export function matchChannelId(matchId) {
    return requireMatch(matchId).channelId;
}
function channelMeta(match) {
    return {
        name: match.title,
        match_id: match.id,
    };
}
export async function ensureMatchChannel(matchId, userId) {
    const match = requireMatch(matchId);
    const stream = getStreamClient();
    const channel = stream.channel(match.channelType, match.channelId, {
        ...channelMeta(match),
        created_by_id: userId,
        members: [userId],
    });
    await channel.create();
    await channel.addMembers([userId]);
    return {
        channelType: match.channelType,
        channelId: match.channelId,
    };
}
export function teamBotUserId(team) {
    return `bot-${team}`;
}
export function teamBotDisplayName(team) {
    const label = team
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    return `${label || 'Team'} Fan`;
}
export async function queryRecentMessages(matchId, limit = 20) {
    const match = requireMatch(matchId);
    const stream = getStreamClient();
    const channel = stream.channel(match.channelType, match.channelId);
    const state = await channel.query({
        messages: { limit },
        state: true,
    });
    const messages = state.messages ?? [];
    return messages
        .filter((message) => typeof message.text === 'string' && message.text.trim())
        .map((message) => ({
        userId: message.user?.id ?? 'unknown',
        name: message.user?.name,
        text: message.text.trim(),
    }));
}
export async function upsertTeamBot(team) {
    const stream = getStreamClient();
    const botUserId = teamBotUserId(team);
    const name = teamBotDisplayName(team);
    await stream.upsertUser({ id: botUserId, name, role: 'user' });
    return { botUserId, name };
}
export async function sendBotMessage(matchId, botUserId, text) {
    const match = requireMatch(matchId);
    const stream = getStreamClient();
    const channel = stream.channel(match.channelType, match.channelId, {
        ...channelMeta(match),
        created_by_id: botUserId,
        members: [botUserId],
    });
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
