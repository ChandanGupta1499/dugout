# Spin & Win Wheel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Spin & Win" wheel overlay to match chat, opened (alongside the existing Quiz sheet) from a single unified "games" entry point on the composer that decides which one to show via a mocked async lookup.

**Architecture:** A new centered `Modal` overlay component (`SpinWheelOverlay.tsx`) drawing a 6-segment prize wheel with `react-native-svg`, animated by rotating a single `Animated.View` wrapper (Reanimated `useAnimatedStyle` + `transform: rotate`) around it — see the implementation-approach note in Task 4 for why this supersedes the spec's SVG-`<G>`-`useAnimatedProps` sketch. A new `src/lib/games.ts` module exposes `fetchActiveGame()`, shaped like a real API call but backed by a mock; the composer's existing quiz-only entry point becomes generic and calls it.

**Tech Stack:** Expo / React Native, TypeScript, `react-native-svg` (already installed, first real usage in this app), `react-native-reanimated` (already used elsewhere), `lucide-react-native` icons, existing `src/theme/tokens.ts`.

**Spec:** `docs/superpowers/specs/2026-09-10-spin-wheel-design.md` — read this first. This plan implements it, with one noted deviation (Task 4).

---

## Chunk 1: Data, icons, and the wheel component

### Task 1: Add prize icons

**Files:**
- Modify: `src/components/dugout/Icon.tsx`

- [ ] **Step 1: Register the six prize icons**

Replace the full contents of `src/components/dugout/Icon.tsx`:

```tsx
import {
  Award,
  Bike,
  Car,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Gamepad2,
  Gift,
  Plus,
  Send,
  Smartphone,
  XCircle,
} from 'lucide-react-native';

const ICONS = {
  'chevron-left': ChevronLeft,
  plus: Plus,
  send: Send,
  'circle-check': CheckCircle2,
  'circle-x': XCircle,
  gamepad: Gamepad2,
  coins: Coins,
  car: Car,
  smartphone: Smartphone,
  bike: Bike,
  gift: Gift,
  award: Award,
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

Run: `cd /Users/chandan.gupta/Desktop/learning/temp1/dugout && npx tsc --noEmit -p . 2>&1 | grep -v "^sim-ui/"`
Expected: no output (no errors outside the pre-existing, unrelated `sim-ui/` ones).

- [ ] **Step 3: Commit**

```bash
git add src/components/dugout/Icon.tsx
git commit -m "feat: add spin-wheel prize icons"
```

---

### Task 2: Create the spin mock data module

**Files:**
- Create: `src/lib/spin-mock.ts`

- [ ] **Step 1: Write the mock prizes and types**

`SpinPrize`/`SpinPrizeIcon` live here (not in `games.ts`) so `games.ts` only ever imports *from*
this file, never the reverse — a clean one-way dependency.

```ts
export type SpinPrizeIcon = 'coins' | 'car' | 'smartphone' | 'bike' | 'gift' | 'award';
export type SpinPrize = { id: string; label: string; icon: SpinPrizeIcon };

export const INITIAL_SPINS_LEFT = 2;

export const MOCK_SPIN_PRIZES: SpinPrize[] = [
  { id: 'coins', label: '500 Coins', icon: 'coins' },
  { id: 'car', label: 'Toy Car', icon: 'car' },
  { id: 'phone', label: 'Smartphone', icon: 'smartphone' },
  { id: 'bike', label: 'Bike', icon: 'bike' },
  { id: 'goldbar', label: 'Gold Bar', icon: 'award' },
  { id: 'gift', label: 'Mystery Gift', icon: 'gift' },
];
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "^sim-ui/"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spin-mock.ts
git commit -m "feat: add mock spin-wheel prize data"
```

---

### Task 3: Create the unified games-lookup module

**Files:**
- Create: `src/lib/games.ts`

- [ ] **Step 1: Write `fetchActiveGame`**

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "^sim-ui/"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/games.ts
git commit -m "feat: add mocked active-game lookup"
```

---

### Task 4: Create the `SpinWheelOverlay` component

**Files:**
- Create: `src/components/dugout/SpinWheelOverlay.tsx`

**Implementation-approach note (deviation from the spec):** the spec sketches rotating an SVG
`<G>` via `Animated.createAnimatedComponent(G)` + `useAnimatedProps`. This codebase has zero
existing `react-native-svg` usage, and the spec itself flagged that combination as unverified. This
task uses a lower-risk, equally-standard alternative that achieves the identical visual result:
wrap the **entire** wheel graphic (the static SVG *and* the prize icon overlays) in one plain
`Animated.View` whose `useAnimatedStyle` sets `transform: [{ rotate: `${rotation.value}deg` }]`.
RN's `Animated`/Reanimated view rotation is a long-established, heavily-used pattern (no
SVG-specific API involved), and rotating a parent `View` rotates its entire subtree — including a
nested `<Svg>` — uniformly. The angle math from the spec (SVG convention: 0°=3 o'clock, clockwise)
still applies unchanged, since RN's `rotate` transform uses the same clockwise-for-positive-degrees
convention. This removes the need for a separate feasibility spike task.

- [ ] **Step 1: Write the component**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { SpinPrize } from '@/lib/spin-mock';
import { colors, radius, semantic, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  prizes: SpinPrize[]; // exactly 6
  initialSpinsLeft: number;
  onClose: () => void;
};

type Phase = 'idle' | 'spinning' | 'result';

const WHEEL_SIZE = 280;
const WHEEL_RADIUS = 140;
const SEGMENT_COUNT = 6;
const SEGMENT_DEG = 360 / SEGMENT_COUNT;
const SPIN_DURATION_MS = 3000;
const RESULT_PAUSE_MS = 1200;
const COUNTDOWN_START_SEC = 10;
const EXTRA_FULL_SPINS = 4;
const POINTER_ANGLE_DEG = 270; // 12 o'clock, in SVG's 0deg-at-3-o'clock/clockwise convention

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeSegmentPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export function SpinWheelOverlay({ visible, prizes, initialSpinsLeft, onClose }: Props) {
  const [spinsLeft, setSpinsLeft] = useState(initialSpinsLeft);
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdownSec, setCountdownSec] = useState(COUNTDOWN_START_SEC);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);

  const rotation = useSharedValue(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearResultTimer = useCallback(() => {
    if (resultTimeoutRef.current !== null) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  }, []);

  // Reset everything whenever the overlay closes, so reopening always starts
  // fresh. Modal doesn't unmount its subtree on visible=false. A direct
  // (non-withTiming) reassignment here means any in-flight spin's completion
  // callback will subsequently fire with finished=false and be ignored by the
  // guard in startSpin's callback below.
  useEffect(() => {
    if (!visible) {
      clearCountdown();
      clearResultTimer();
      setSpinsLeft(initialSpinsLeft);
      setPhase('idle');
      setCountdownSec(COUNTDOWN_START_SEC);
      setLandedIndex(null);
      rotation.value = 0;
    }
  }, [visible, initialSpinsLeft, clearCountdown, clearResultTimer, rotation]);

  // Clear the result-pause timer on unmount so it can never call setState
  // (including the onClose it may invoke) after the component is gone.
  useEffect(() => clearResultTimer, [clearResultTimer]);

  const handleSpinLanded = useCallback(
    (winningIndex: number) => {
      setPhase('result');
      setLandedIndex(winningIndex);
      setSpinsLeft((current) => {
        const next = current - 1;
        resultTimeoutRef.current = setTimeout(() => {
          resultTimeoutRef.current = null;
          if (next > 0) {
            setPhase('idle');
            setCountdownSec(COUNTDOWN_START_SEC);
            setLandedIndex(null);
          } else {
            onClose();
          }
        }, RESULT_PAUSE_MS);
        return next;
      });
    },
    [onClose],
  );

  const startSpin = useCallback(() => {
    if (phase !== 'idle' || spinsLeft <= 0) return;
    clearCountdown();

    const winningIndex = Math.floor(Math.random() * prizes.length);
    const segmentCenterDeg = winningIndex * SEGMENT_DEG + SEGMENT_DEG / 2;
    const targetMod = (((POINTER_ANGLE_DEG - segmentCenterDeg) % 360) + 360) % 360;
    const target = Math.ceil(rotation.value / 360) * 360 + EXTRA_FULL_SPINS * 360 + targetMod;

    setPhase('spinning');
    rotation.value = withTiming(
      target,
      { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(handleSpinLanded)(winningIndex);
        }
      },
    );
  }, [phase, spinsLeft, prizes.length, rotation, clearCountdown, handleSpinLanded]);

  // startSpin's identity changes whenever the parent's onClose prop does
  // (chat.tsx re-renders roughly once per second from scoreboard polling, so
  // this is frequent in practice, not theoretical). Routing calls through a
  // ref — updated every render but never itself a dependency — means the
  // countdown effect below never needs startSpin in its dependency array, so
  // a churning parent can never tear down and rebuild the 1s interval before
  // it fires.
  const startSpinRef = useRef(startSpin);
  useEffect(() => {
    startSpinRef.current = startSpin;
  }, [startSpin]);

  // Auto-spin countdown: runs while idle with spins remaining; hitting 0 spins
  // the same way a tap on the hub would.
  useEffect(() => {
    if (!visible || phase !== 'idle' || spinsLeft <= 0) {
      return;
    }
    if (countdownSec <= 0) {
      startSpinRef.current();
      return;
    }
    countdownIntervalRef.current = setInterval(() => {
      setCountdownSec((current) => Math.max(0, current - 1));
    }, 1000);
    return clearCountdown;
  }, [visible, phase, spinsLeft, countdownSec, clearCountdown]);

  const wheelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const segments = useMemo(
    () =>
      prizes.slice(0, SEGMENT_COUNT).map((prize, index) => {
        const startDeg = index * SEGMENT_DEG;
        const endDeg = startDeg + SEGMENT_DEG;
        const midDeg = startDeg + SEGMENT_DEG / 2;
        const iconPos = polarToCartesian(
          WHEEL_SIZE / 2,
          WHEEL_SIZE / 2,
          WHEEL_RADIUS * 0.65,
          midDeg,
        );
        return { prize, index, startDeg, endDeg, iconPos };
      }),
    [prizes],
  );

  const canInteract = phase === 'idle' && spinsLeft > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (phase === 'idle') onClose();
          }}
        />
        <Animated.View
          entering={ZoomIn.duration(240)}
          exiting={ZoomOut.duration(160)}
          style={styles.content}>
          <View style={styles.wheelWrap}>
            <Animated.View style={[styles.wheelSpinner, wheelAnimatedStyle]}>
              <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                <Circle
                  cx={WHEEL_SIZE / 2}
                  cy={WHEEL_SIZE / 2}
                  r={WHEEL_RADIUS}
                  fill="none"
                  stroke={colors.amber600}
                  strokeWidth={6}
                />
                {segments.map(({ index, startDeg, endDeg }) => (
                  <Path
                    key={index}
                    d={describeSegmentPath(
                      WHEEL_SIZE / 2,
                      WHEEL_SIZE / 2,
                      WHEEL_RADIUS - 3,
                      startDeg,
                      endDeg,
                    )}
                    fill={index % 2 === 0 ? semantic.surfaceBrand : semantic.surfaceTint}
                  />
                ))}
              </Svg>
              {segments.map(({ prize, index, iconPos }) => {
                const isWinning = phase === 'result' && landedIndex === index;
                return (
                  <View
                    key={prize.id}
                    style={[
                      styles.prizeBadge,
                      {
                        left: iconPos.x - 18,
                        top: iconPos.y - 18,
                      },
                      isWinning && styles.prizeBadgeWinning,
                    ]}>
                    <Icon name={prize.icon} size={18} color={semantic.textBrand} />
                  </View>
                );
              })}
            </Animated.View>
            <View style={styles.pointer} />
            <Pressable
              disabled={!canInteract}
              onPress={startSpin}
              style={[styles.hub, !canInteract && styles.hubDisabled]}>
              <Text style={styles.hubTapTo}>TAP TO</Text>
              <Text style={styles.hubSpin}>SPIN{'\n'}& WIN</Text>
            </Pressable>
          </View>

          {phase === 'idle' && spinsLeft > 0 ? (
            <Text style={styles.autoSpinCaption}>Auto spin in {countdownSec} secs</Text>
          ) : null}

          {spinsLeft > 0 ? (
            <View style={styles.spinsPill}>
              <Text style={styles.spinsPillLabel}>x{spinsLeft} spins left</Text>
            </View>
          ) : null}

          <Text style={styles.termsLink}>Terms and Conditions</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 16, 19, 0.4)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s5,
  },
  wheelWrap: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSpinner: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  },
  prizeBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeBadgeWinning: {
    backgroundColor: semantic.surfaceSuccess,
  },
  pointer: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.amber600,
  },
  hub: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 2,
    borderColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubDisabled: {
    opacity: 0.5,
  },
  hubTapTo: {
    ...typography.caption,
    color: semantic.textBrand,
  },
  hubSpin: {
    ...typography.title,
    color: semantic.textBrand,
    textAlign: 'center',
    lineHeight: 16,
  },
  autoSpinCaption: {
    ...typography.bodySm,
    color: semantic.textDisplay,
  },
  spinsPill: {
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s3,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 1,
    borderColor: semantic.lineHairline,
  },
  spinsPillLabel: {
    ...typography.label,
    color: semantic.textDisplay,
    textTransform: 'none',
  },
  termsLink: {
    ...typography.caption,
    color: semantic.textBrand,
    textDecorationLine: 'underline',
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "^sim-ui/"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/dugout/SpinWheelOverlay.tsx
git commit -m "feat: add SpinWheelOverlay component"
```

---

## Chunk 2: Unify the entry point and integrate into chat

### Task 5: Generalize `Composer`'s entry-point button

**Files:**
- Modify: `src/components/dugout/Composer.tsx`

- [ ] **Step 1: Rename the quiz-specific props and internals to generic "game" naming**

Replace the full contents of `src/components/dugout/Composer.tsx`:

```tsx
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radius, semantic, spacing } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onOpenMedia?: () => void;
  mediaOpen?: boolean;
  onOpenGame?: () => void;
  gameBadge?: boolean;
  editable?: boolean;
};

export function Composer({
  value,
  onChangeText,
  onSend,
  onOpenMedia,
  mediaOpen = false,
  onOpenGame,
  gameBadge = false,
  editable = true,
}: Props) {
  return (
    <View style={styles.row}>
      {onOpenGame ? (
        <Pressable
          onPress={onOpenGame}
          disabled={!editable}
          style={[styles.gameButton, !editable && styles.disabled]}>
          <Icon name="gamepad" size={20} color={semantic.textOnBrand} />
          {gameBadge ? <View style={styles.gameBadge} /> : null}
        </Pressable>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Roast, react, or poll…"
          placeholderTextColor={semantic.textPlaceholder}
          style={styles.input}
          editable={editable}
          onSubmitEditing={onSend}
          returnKeyType="send"
          multiline={false}
        />
        {onOpenMedia ? (
          <Pressable
            onPress={onOpenMedia}
            disabled={!editable}
            hitSlop={8}
            style={[styles.plusInside, !editable && styles.disabled]}>
            <Icon
              name="plus"
              size={20}
              color={mediaOpen ? semantic.textBrand : semantic.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onSend}
        disabled={!editable || !value.trim()}
        style={[styles.sendButton, (!editable || !value.trim()) && styles.sendButtonDisabled]}>
        <Icon name="send" size={20} color={semantic.textOnBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s5,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: spacing.controlH,
    paddingLeft: spacing.s6,
    paddingRight: spacing.s3,
    backgroundColor: semantic.surfaceTint,
    borderWidth: 1,
    borderColor: semantic.lineBrand,
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: fonts.body,
    fontSize: 15,
    color: semantic.textBody,
  },
  plusInside: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: spacing.controlH,
    height: spacing.controlH,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  gameButton: {
    width: spacing.controlH,
    height: spacing.controlH,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.amber600,
    borderWidth: 1.5,
    borderColor: semantic.surfaceBrand,
  },
  disabled: {
    opacity: 0.5,
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "^sim-ui/"`
Expected: errors in `src/app/match/[matchId]/chat.tsx` referencing `onOpenQuiz`/`quizBadge` not
existing on `Composer`'s props — this is expected until Task 6 updates that call site. Do not fix
chat.tsx here.

- [ ] **Step 3: Commit**

```bash
git add src/components/dugout/Composer.tsx
git commit -m "refactor: generalize Composer's quiz button into a games entry point"
```

---

### Task 6: Wire `fetchActiveGame` and both overlays into `chat.tsx`

**Files:**
- Modify: `src/app/match/[matchId]/chat.tsx`

- [ ] **Step 1: Update imports**

Find:

```tsx
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
```

Replace with:

```tsx
import { MediaSheet } from '@/components/dugout/MediaSheet';
import { QuizSheet } from '@/components/dugout/QuizSheet';
import { ScoreStrip } from '@/components/dugout/ScoreStrip';
import { SpinWheelOverlay } from '@/components/dugout/SpinWheelOverlay';
import {
  ensureMatchChannel,
  fetchMatch,
  fetchScoreboard,
  requestBotBanter,
  type GiphyItem,
  type GiphyKind,
  type MatchScoreboard,
} from '@/lib/api';
import { fetchActiveGame, type ActiveGame } from '@/lib/games';
import type { Match, MatchTeam } from '@/lib/matches';
import { MOCK_QUIZ_QUESTION } from '@/lib/quiz-mock';
import { isReactionType, type ReactionType } from '@/lib/reactions';
import { INITIAL_SPINS_LEFT, MOCK_SPIN_PRIZES } from '@/lib/spin-mock';
import { semantic, spacing } from '@/theme/tokens';
```

- [ ] **Step 2: Replace `quizOpen` state with `activeGame`/`loadingGame`**

Find:

```tsx
  const [mediaOpen, setMediaOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
```

Replace with:

```tsx
  const [mediaOpen, setMediaOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [loadingGame, setLoadingGame] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
```

- [ ] **Step 3: Replace the `Composer`'s quiz props with the generic game handler**

Find:

```tsx
              onOpenQuiz={() => {
                setReactionTargetId(null);
                Keyboard.dismiss();
                setQuizOpen(true);
              }}
              quizBadge
```

Replace with:

```tsx
              onOpenGame={() => {
                setReactionTargetId(null);
                Keyboard.dismiss();
                if (!matchId || loadingGame) return;
                setLoadingGame(true);
                void fetchActiveGame(matchId)
                  .then(setActiveGame)
                  .catch((err) => {
                    console.warn('Fetch active game failed', err);
                  })
                  .finally(() => setLoadingGame(false));
              }}
              gameBadge
```

- [ ] **Step 4: Replace the `QuizSheet` render with both overlays**

Find:

```tsx
      <QuizSheet
        visible={quizOpen}
        question={MOCK_QUIZ_QUESTION}
        liveLabel={scoreboard ? `LIVE · ${scoreboard.clockLabel}` : undefined}
        onClose={() => setQuizOpen(false)}
      />
```

Replace with:

```tsx
      <QuizSheet
        visible={activeGame?.type === 'quiz'}
        question={activeGame?.type === 'quiz' ? activeGame.question : MOCK_QUIZ_QUESTION}
        liveLabel={scoreboard ? `LIVE · ${scoreboard.clockLabel}` : undefined}
        onClose={() => setActiveGame(null)}
      />
      <SpinWheelOverlay
        visible={activeGame?.type === 'spin'}
        prizes={activeGame?.type === 'spin' ? activeGame.prizes : MOCK_SPIN_PRIZES}
        initialSpinsLeft={activeGame?.type === 'spin' ? activeGame.spinsLeft : INITIAL_SPINS_LEFT}
        onClose={() => setActiveGame(null)}
      />
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "^sim-ui/"`
Expected: no output. This also retroactively confirms Task 5's `Composer` rename is fully wired
(no more `onOpenQuiz`/`quizBadge` references anywhere).

- [ ] **Step 6: Commit**

```bash
git add "src/app/match/[matchId]/chat.tsx"
git commit -m "feat: route the games entry point to quiz or spin via fetchActiveGame"
```

---

### Task 7: Manual verification in the running app

**Files:** none (manual QA only)

- [ ] **Step 1: Start the app** and navigate to a match's chat screen (per repo conventions /
  the `run` skill).

- [ ] **Step 2: Verify the unified entry point**

- Tapping the round gamepad button in the composer triggers a brief mocked-loading pause (~400ms),
  then opens either the Quiz sheet (slides up from bottom) or the Spin wheel (fades/zooms in from
  center) — confirm both appear across repeated taps (the mock is 50/50).

- [ ] **Step 3: Verify the spin wheel specifically**

- The wheel renders as 6 alternating red/pink segments in a gold ring, each with a prize icon,
  centered on screen with no header/scorecard, sponsor row, or bottom nav visible.
- "Auto spin in {n} secs" counts down from 10; letting it hit 0 spins the wheel automatically.
- Tapping the center hub also spins it (when idle and spins remain).
- The wheel visibly rotates smoothly (this is the first use of `react-native-svg` + Reanimated
  together in this app — watch closely for jank, a frozen wheel, or icons drifting out of sync
  with the segments during rotation, since this exact combination wasn't previously proven in this
  codebase).
- It comes to rest with a segment's icon under the top pointer, and that segment briefly
  highlights.
- The "x{n} spins left" pill decrements after each spin.
- After the **first** spin (spinsLeft 2→1): the wheel resets to idle, the countdown restarts at
  10, and it can be spun again.
- After the **second** spin (spinsLeft 1→0): shortly after the result is shown, the overlay closes
  itself automatically — with no further interaction possible from a closed overlay.
- Tapping the backdrop while idle closes the overlay; tapping it mid-spin does nothing.
- "Terms and Conditions" text renders (tapping it is expected to do nothing — no destination
  exists yet).
- Closing and reopening the wheel (via the games button again) always starts fresh at 2 spins
  left, regardless of how the previous session ended.

- [ ] **Step 4: Report results**

If the SVG+Reanimated rotation is janky, doesn't render, or icons/segments desync during spin,
that's a real finding — report it rather than working around it silently, since this plan
explicitly flagged that combination as this app's first use of the pairing. No automated test
suite exists for this UI (consistent with `MediaSheet`/`QuizSheet` precedent), so this manual pass
is the acceptance gate.
