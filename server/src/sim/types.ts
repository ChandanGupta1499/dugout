export const SIM_MATCH_ID = 'eng-arg-semi-2026';
export const SIM_MATCH_DURATION_MINUTES = 102; // 90 + 12

export type SimChatMessage = {
  offsetMs: number;
  author: string;
  text: string;
};

export type SimCommentaryEvent = {
  matchMinute: number;
  label: string;
  text: string;
};

export type SimState = 'idle' | 'running' | 'paused' | 'finished';
