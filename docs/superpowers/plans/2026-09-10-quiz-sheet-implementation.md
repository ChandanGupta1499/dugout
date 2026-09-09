# Quiz Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually-triggered "Quiz" bottom sheet to the match chat screen — a tap-to-lock, single-choice trivia question with a countdown timer, built from local mock data, matching the Dugout Design System's visual language.

**Architecture:** One new self-contained RN component (`QuizSheet.tsx`, modeled structurally on the existing `MediaSheet.tsx`), one new mock-data module, two small additions to the existing token file and icon registry, and a small integration diff in the match chat screen to render a trigger button and the sheet itself. No backend or Stream chat changes.

**Tech Stack:** Expo / React Native, TypeScript, `lucide-react-native` icons, existing `src/theme/tokens.ts` design tokens.

**Spec:** `docs/superpowers/specs/2026-09-10-quiz-sheet-design.md` — read this first for full rationale; this plan is the literal execution of that spec.

---

## Chunk 1: Tokens, icons, mock data, and the QuizSheet component

### Task 1: Add success color tokens

**Files:**
- Modify: `src/theme/tokens.ts`

- [ ] **Step 1: Add `surfaceSuccess` and `textSuccess` to the `semantic` object**

Open `src/theme/tokens.ts`. In the `semantic` export (around line 40-60), add two new keys. Insert them right after `statusLive` so they sit with the other status-ish tokens:

```ts
export const semantic = {
  surfacePage: colors.white,
  surfaceCard: colors.white,
  surfaceTint: colors.red50,
  surfaceTintStrong: colors.red100,
  surfaceBrand: colors.red600,
  surfaceBrandPressed: colors.red700,

  textDisplay: colors.ink,
  textBody: colors.grey800,
  textMuted: colors.grey600,
  textPlaceholder: colors.grey500,
  textBrand: colors.red600,
  textOnBrand: colors.white,

  lineHairline: colors.grey200,
  lineStrong: colors.grey300,
  lineBrand: colors.red200,

  statusLive: colors.red600,
  // colors.green600 @ 12% — mirrors surfaceTint's role for the brand red, but
  // there's no precomputed green50/green100 tint in `colors` to reference.
  surfaceSuccess: 'rgba(18, 133, 90, 0.12)',
  textSuccess: colors.green600,
} as const;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/chandan.gupta/Desktop/learning/temp1/dugout && npx tsc --noEmit -p .`
Expected: no new errors related to `tokens.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat: add success color tokens for quiz correct-answer state"
```

---

### Task 2: Add check/x icons

**Files:**
- Modify: `src/components/dugout/Icon.tsx`

- [ ] **Step 1: Register `circle-check` and `circle-x`**

Replace the full contents of `src/components/dugout/Icon.tsx`:

```tsx
import { CheckCircle2, ChevronLeft, Plus, Send, XCircle } from 'lucide-react-native';

const ICONS = {
  'chevron-left': ChevronLeft,
  plus: Plus,
  send: Send,
  'circle-check': CheckCircle2,
  'circle-x': XCircle,
} as const;

type Props = {
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color }: Props) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color} />;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dugout/Icon.tsx
git commit -m "feat: add circle-check and circle-x icons"
```

---

### Task 3: Create the quiz mock data module

**Files:**
- Create: `src/lib/quiz-mock.ts`

- [ ] **Step 1: Write the mock question**

This is defined in its own module (not inline in `QuizSheet.tsx`) so `chat.tsx` can import a ready-made question without depending on the component file for data, and so a future real endpoint can replace just this file.

```ts
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
```

- [ ] **Step 2: Commit** (after Task 4 creates `QuizSheet.tsx` and its exported types — do this step then, so the import resolves; skip committing this file standalone)

Leave this file uncommitted for now; it will be committed together with Task 4 since it depends on `QuizSheet.tsx`'s exported types.

---

### Task 4: Create the `QuizSheet` component

**Files:**
- Create: `src/components/dugout/QuizSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fonts, radius, semantic, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';

export type QuizOption = { key: string; label: string };
export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[]; // exactly 4, rendered as a 2x2 grid
  correctKey: string;
  durationSec: number; // countdown length, e.g. 45
};

type Props = {
  visible: boolean;
  question: QuizQuestion;
  liveLabel?: string; // e.g. "LIVE · 63'"; defaults to "LIVE · MIN --"
  onClose: () => void;
};

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QuizSheet({ visible, question, liveLabel, onClose }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(question.durationSec);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Reset all interactive state whenever the sheet is closed, so reopening
  // (even with the same question object) always starts fresh. Modal doesn't
  // unmount its subtree on visible=false, so this reset can't be skipped.
  useEffect(() => {
    if (!visible) {
      clearTimer();
      setSelectedKey(null);
      setRemainingSec(question.durationSec);
    }
  }, [visible, question.durationSec, clearTimer]);

  useEffect(() => {
    if (!visible || selectedKey !== null || remainingSec <= 0) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSec((current) => Math.max(0, current - 1));
    }, 1000);

    return clearTimer;
  }, [visible, selectedKey, remainingSec, clearTimer]);

  const locked = selectedKey !== null || remainingSec === 0;

  const handleSelect = useCallback(
    (key: string) => {
      if (locked) return;
      clearTimer();
      setSelectedKey(key);
    },
    [locked, clearTimer],
  );

  const rows = [question.options.slice(0, 2), question.options.slice(2, 4)];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.liveLabel}>{liveLabel ?? "LIVE · MIN --"}</Text>
              <Text style={styles.title}>Quiz</Text>
            </View>
            <View style={[styles.timerCircle, remainingSec === 0 && styles.timerCircleExpired]}>
              <Text style={styles.timerValue}>{formatClock(remainingSec)}</Text>
              <Text style={styles.timerCaption}>LEFT</Text>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.sectionLabel}>Quiz break · pick one</Text>
            <Text style={styles.prompt}>{question.prompt}</Text>

            <View style={styles.grid}>
              {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.gridRow}>
                  {row.map((option) => {
                    const isCorrect = option.key === question.correctKey;
                    const isWrongPick = locked && selectedKey === option.key && !isCorrect;
                    const isRevealedCorrect = locked && isCorrect;
                    const isDimmed = locked && !isRevealedCorrect && !isWrongPick;

                    return (
                      <Pressable
                        key={option.key}
                        disabled={locked}
                        onPress={() => handleSelect(option.key)}
                        style={[
                          styles.option,
                          isRevealedCorrect && styles.optionCorrect,
                          isWrongPick && styles.optionWrong,
                          isDimmed && styles.optionDimmed,
                        ]}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isRevealedCorrect && styles.optionLabelCorrect,
                            isWrongPick && styles.optionLabelWrong,
                          ]}
                          numberOfLines={1}>
                          {option.label}
                        </Text>
                        {isRevealedCorrect ? (
                          <Icon name="circle-check" size={18} color={semantic.textSuccess} />
                        ) : null}
                        {isWrongPick ? (
                          <Icon name="circle-x" size={18} color={semantic.textBrand} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 16, 19, 0.4)',
  },
  sheet: {
    backgroundColor: semantic.surfacePage,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.s4,
    paddingHorizontal: spacing.gutterScreen,
    paddingBottom: spacing.s8,
    gap: spacing.s6,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: semantic.lineStrong,
    marginBottom: spacing.s4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: spacing.s2,
  },
  liveLabel: {
    ...typography.label,
    color: semantic.textBrand,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.displayMd,
    color: semantic.textDisplay,
  },
  timerCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCircleExpired: {
    backgroundColor: semantic.lineBrand,
  },
  timerValue: {
    fontFamily: fonts.button,
    fontSize: 14,
    color: semantic.textOnBrand,
  },
  timerCaption: {
    ...typography.caption,
    fontSize: 9,
    color: semantic.textOnBrand,
  },
  questionCard: {
    gap: spacing.s5,
    padding: spacing.s5,
    backgroundColor: semantic.surfaceTint,
    borderWidth: 1,
    borderColor: semantic.lineBrand,
    borderRadius: radius.card,
  },
  sectionLabel: {
    ...typography.label,
    color: semantic.textBrand,
    textTransform: 'uppercase',
  },
  prompt: {
    ...typography.title,
    color: semantic.textDisplay,
    textTransform: 'uppercase',
  },
  grid: {
    gap: spacing.s4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.s4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.controlH,
    paddingHorizontal: spacing.s5,
    borderRadius: radius.md,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 1,
    borderColor: semantic.lineHairline,
  },
  optionCorrect: {
    backgroundColor: semantic.surfaceSuccess,
    borderColor: semantic.textSuccess,
  },
  optionWrong: {
    backgroundColor: semantic.surfaceTintStrong,
    borderColor: semantic.textBrand,
  },
  optionDimmed: {
    opacity: 0.6,
  },
  optionLabel: {
    ...typography.rowName,
    color: semantic.textDisplay,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  optionLabelCorrect: {
    color: semantic.textSuccess,
  },
  optionLabelWrong: {
    color: semantic.textBrand,
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors in `QuizSheet.tsx` or `quiz-mock.ts` (this also validates Task 3's file, since it imports `QuizQuestion` from here).

- [ ] **Step 3: Commit both files together**

```bash
git add src/components/dugout/QuizSheet.tsx src/lib/quiz-mock.ts
git commit -m "feat: add QuizSheet component and mock quiz question"
```

---

## Chunk 2: Integration into the match chat screen

### Task 5: Wire the trigger button and sheet into `chat.tsx`

**Files:**
- Modify: `src/app/match/[matchId]/chat.tsx`

- [ ] **Step 1: Add the `quizOpen` state**

Find this block (around line 137-138):

```tsx
  const [mediaOpen, setMediaOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
```

Change it to:

```tsx
  const [mediaOpen, setMediaOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
```

- [ ] **Step 2: Add the imports**

Find the import block at the top of the file (around lines 18-35). Add `QuizSheet` next to the other `dugout` component imports, and `MOCK_QUIZ_QUESTION` next to the `@/lib/api` / `@/lib/matches` imports:

```tsx
import { BotBanterBar } from '@/components/dugout/BotBanterBar';
import { ChatBubble, type ChatBubbleKind } from '@/components/dugout/ChatBubble';
import { ChatHeader } from '@/components/dugout/ChatHeader';
import { Composer } from '@/components/dugout/Composer';
import { MediaSheet } from '@/components/dugout/MediaSheet';
import { QuizSheet } from '@/components/dugout/QuizSheet';
import { ScoreStrip } from '@/components/dugout/ScoreStrip';
import {
  ensureMatchChannel,
  fetchMatch,
  fetchScoreboard,
  requestBotBanter,
  type GiphyItem,
  type GiphyKind,
  type MatchScoreboard,
} from '@/lib/api';
import type { Match, MatchTeam } from '@/lib/matches';
import { MOCK_QUIZ_QUESTION } from '@/lib/quiz-mock';
import { isReactionType, type ReactionType } from '@/lib/reactions';
import { semantic, spacing } from '@/theme/tokens';
import { useGuest } from '@/providers/chat-provider';
```

- [ ] **Step 3: Add the trigger row above the composer**

Find this block (around lines 427-436):

```tsx
          {hasBotTeams && match?.teamA && match?.teamB ? (
            <BotBanterBar
              teamA={match.teamA}
              teamB={match.teamB}
              pendingTeam={pendingTeam}
              error={banterError}
              onTrigger={(team) => void triggerBanter(team)}
            />
          ) : null}
          <View style={[styles.composerWrap, { paddingBottom: composerBottomPad }]}>
```

Replace it with:

```tsx
          {hasBotTeams && match?.teamA && match?.teamB ? (
            <BotBanterBar
              teamA={match.teamA}
              teamB={match.teamB}
              pendingTeam={pendingTeam}
              error={banterError}
              onTrigger={(team) => void triggerBanter(team)}
            />
          ) : null}
          <View style={styles.quizTriggerRow}>
            <Pressable
              style={styles.quizTriggerButton}
              onPress={() => {
                Keyboard.dismiss();
                setQuizOpen(true);
              }}>
              <Text style={styles.quizTriggerLabel}>Quiz</Text>
            </Pressable>
          </View>
          <View style={[styles.composerWrap, { paddingBottom: composerBottomPad }]}>
```

- [ ] **Step 4: Render the `QuizSheet` as a sibling of `MediaSheet`**

Find this block (near the end of the returned JSX, around lines 455-459):

```tsx
      <MediaSheet
        visible={mediaOpen}
        onClose={closeMediaSheet}
        onPickMedia={(item, kind) => void sendMedia(item, kind)}
      />
    </>
  );
}
```

Replace it with:

```tsx
      <MediaSheet
        visible={mediaOpen}
        onClose={closeMediaSheet}
        onPickMedia={(item, kind) => void sendMedia(item, kind)}
      />
      <QuizSheet
        visible={quizOpen}
        question={MOCK_QUIZ_QUESTION}
        liveLabel={scoreboard ? `LIVE · ${scoreboard.clockLabel}` : undefined}
        onClose={() => setQuizOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 5: Add the trigger row styles**

Find the `styles` object's closing section (around lines 508-514):

```tsx
  composerWrap: {
    paddingHorizontal: spacing.gutterScreen,
    paddingTop: spacing.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.lineHairline,
    backgroundColor: semantic.surfacePage,
  },
});
```

Replace it with:

```tsx
  composerWrap: {
    paddingHorizontal: spacing.gutterScreen,
    paddingTop: spacing.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.lineHairline,
    backgroundColor: semantic.surfacePage,
  },
  quizTriggerRow: {
    paddingHorizontal: spacing.gutterScreen,
    paddingTop: spacing.s4,
  },
  quizTriggerButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s3,
    borderRadius: spacing.controlHSm / 2,
    borderWidth: 1,
    borderColor: semantic.lineBrand,
    backgroundColor: semantic.surfaceTint,
  },
  quizTriggerLabel: {
    fontFamily: fonts.button,
    fontSize: 13,
    color: semantic.textBrand,
    textTransform: 'uppercase',
  },
});
```

Note: `fonts` isn't currently imported in `chat.tsx` (only `semantic, spacing` are, per the existing `import { semantic, spacing } from '@/theme/tokens';` on line 35). Update that import line (already shown updated in Step 2 above) — confirm it now reads:

```tsx
import { fonts, semantic, spacing } from '@/theme/tokens';
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/match/[matchId]/chat.tsx
git commit -m "feat: wire Quiz trigger button and QuizSheet into match chat"
```

---

### Task 6: Manual verification in the running app

**Files:** none (manual QA only)

- [ ] **Step 1: Start the app**

Use the `run` skill (or `npx expo start`) to launch Dugout, per `server/README.md` / repo conventions, and navigate to an existing match's chat screen.

- [ ] **Step 2: Verify the trigger and sheet**

Check each of:
- A "Quiz" pill button appears above the composer (below the bot-banter row if present, or in its place if the match has no `teamA`/`teamB`).
- Tapping it slides up the `QuizSheet` from the bottom with a dimmed backdrop over the whole screen (header, score strip, chat feed).
- The countdown timer ticks down once per second from 0:45.
- Tapping an option locks all four options immediately: the correct option turns green with a checkmark, and — if you tapped a wrong one — that option turns red with an X; untapped incorrect options dim.
- Tapping the backdrop, or the answered state, still allows dismissing (tap backdrop) and reopening the sheet, and reopening always starts fresh (fresh timer, no locked-in state carried over from the previous open).
- Letting the timer run to `0:00` without picking an answer locks the sheet and reveals the correct answer with no wrong-answer highlight.

- [ ] **Step 3: Report results**

If any check fails, note which one and fix before considering this plan complete. No automated test suite exists for this UI (consistent with `MediaSheet`/`BotBanterBar`), so this manual pass is the acceptance gate.
