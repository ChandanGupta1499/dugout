import { getRecentChat, getRecentCommentary } from './context.js';
import { generateTeamBanter } from './gemini.js';
import { assertTeamForMatch, requireMatch } from './matches.js';
import { sendBotMessage, upsertTeamBot } from './stream.js';

export function normalizeTeam(team: string): string {
  return team
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function postTeamBanter(matchId: string, teamInput: string) {
  const team = normalizeTeam(teamInput);
  if (!team) {
    throw new Error('team is required');
  }

  const match = requireMatch(matchId);
  assertTeamForMatch(match, team);

  const opponent = [match.teamA, match.teamB]
    .filter((side) => side && side.slug !== team)
    .map((side) => side!.label)[0];

  const [chat, commentary] = await Promise.all([
    getRecentChat(matchId),
    getRecentCommentary(matchId),
  ]);

  const text = await generateTeamBanter(team, opponent, chat, commentary);
  const { botUserId } = await upsertTeamBot(team);
  const { channelId, messageId } = await sendBotMessage(
    matchId,
    botUserId,
    text,
  );

  return {
    text,
    botUserId,
    messageId,
    channelId,
  };
}
