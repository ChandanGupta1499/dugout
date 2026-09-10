import type { QuizQuestion } from '@/components/dugout/QuizSheet';
import { MOCK_QUIZ_QUESTION } from '@/lib/quiz-mock';
import { INITIAL_SPINS_LEFT, MOCK_SPIN_PRIZES, type SpinPrize } from '@/lib/spin-mock';

export type ActiveGame =
  | { type: 'quiz'; question: QuizQuestion }
  | { type: 'spin'; prizes: SpinPrize[]; spinsLeft: number }
  | { type: 'none' };

const MOCK_DELAY_MS = 400;

// Mock now; swap the body for a real `getJson<ActiveGame>('/games/active?matchId=...')`
// call later without changing this function's signature or its callers.
export async function fetchActiveGame(matchId: string): Promise<ActiveGame> {
  void matchId; // accepted for signature parity with the future real endpoint
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  const type = Math.random() < 0.5 ? 'quiz' : 'spin';
  if (type === 'quiz') {
    return { type: 'quiz', question: MOCK_QUIZ_QUESTION };
  }
  return { type: 'spin', prizes: MOCK_SPIN_PRIZES, spinsLeft: INITIAL_SPINS_LEFT };
}
