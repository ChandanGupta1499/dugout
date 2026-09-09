import type { QuizQuestion } from '@/components/dugout/QuizSheet';

export const MOCK_QUIZ_QUESTION: QuizQuestion = {
  id: 'mock-1',
  prompt: 'Which country has won the most FIFA World Cup titles?',
  options: [
    { key: 'brazil', label: 'Brazil' },
    { key: 'germany', label: 'Germany' },
    { key: 'argentina', label: 'Argentina' },
    { key: 'italy', label: 'Italy' },
  ],
  correctKey: 'brazil',
  durationSec: 45,
};
