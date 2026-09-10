export const REACTION_TYPES = ['like', 'love', 'haha', 'fire', 'wow'] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  fire: '🔥',
  wow: '😮',
};

export function isReactionType(value: string): value is ReactionType {
  return (REACTION_TYPES as readonly string[]).includes(value);
}
