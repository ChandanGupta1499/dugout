# Spin & Win Wheel — Design

## Context

Following the Quiz bottom sheet (`docs/superpowers/specs/2026-09-10-quiz-sheet-design.md`), Dugout's
match chat gets a second "game": a Spin & Win wheel, per the reference mockup `play-spin.png`. Per
the user's scoping, this slice covers **only** the wheel UI itself — no header/scorecard, no
sponsor-logo ("unlock on this spin") row, no bottom nav. Those are excluded from `play-spin.png`
on purpose.

Today the chat composer (`src/components/dugout/Composer.tsx`) has a single round "gamepad" entry
button that always opens `QuizSheet` (`onOpenQuiz` prop, wired in
`src/app/match/[matchId]/chat.tsx`). Per the user: this button must become a **unified games
entry point** — tapping it asks "what game is active right now" and opens either the quiz or the
spin wheel based on the answer. The user explicitly wants this shaped as an API call (mocked for
now, real later): "whenever I hit the Games icon a api call will be made and based on res we will
show spin or quiz."

## Goals

- `src/lib/games.ts`: `fetchActiveGame(matchId: string): Promise<ActiveGame>` — a real async
  function signature with a mock body (simulated delay, random result), matching the existing
  "shape the API now, swap the implementation later" pattern already used for the guest Stream
  token.
- Composer's gamepad button calls `fetchActiveGame`, then opens `QuizSheet` or the new
  `SpinWheelOverlay` based on the resolved `type`.
- `SpinWheelOverlay`: a centered (not bottom-sheet) overlay showing the 6-segment prize wheel,
  center "tap to spin" hub, auto-spin countdown, spins-left pill, and a Terms and Conditions link.
- Client-side random prize selection, mock prize data, no backend/persistence.

## Non-goals

- No real backend endpoint, no Supabase persistence, no real prize fulfillment.
- No header/scorecard, sponsor-logo row, or bottom nav in `SpinWheelOverlay` (explicitly out of
  frame per the reference crop).
- No T&C content/screen — the link renders but is inert (no navigation target exists yet).
- No changes to `QuizSheet`'s own internals — only how it's *triggered* changes.

## Data & types: `src/lib/games.ts`

```ts
import type { QuizQuestion } from '@/components/dugout/QuizSheet';
import { MOCK_QUIZ_QUESTION } from '@/lib/quiz-mock';
import { MOCK_SPIN_PRIZES, INITIAL_SPINS_LEFT } from '@/lib/spin-mock';

export type SpinPrize = { id: string; label: string; icon: SpinPrizeIcon };
export type SpinPrizeIcon = 'coins' | 'car' | 'smartphone' | 'bike' | 'gift' | 'award';

export type ActiveGame =
  | { type: 'quiz'; question: QuizQuestion }
  | { type: 'spin'; prizes: SpinPrize[]; spinsLeft: number }
  | { type: 'none' };

const MOCK_DELAY_MS = 400;

// Mock now; swap the body for a real `getJson<ActiveGame>('/games/active?matchId=...')`
// call later without changing this function's signature or callers.
export async function fetchActiveGame(matchId: string): Promise<ActiveGame> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  const type = Math.random() < 0.5 ? 'quiz' : 'spin';
  if (type === 'quiz') {
    return { type: 'quiz', question: MOCK_QUIZ_QUESTION };
  }
  return { type: 'spin', prizes: MOCK_SPIN_PRIZES, spinsLeft: INITIAL_SPINS_LEFT };
}
```

`matchId` is accepted (for signature parity with a future real endpoint) but unused by the mock
body — this is expected and not a defect.

## Data: `src/lib/spin-mock.ts`

Six mock prizes (icon-based placeholders — no custom art in this slice) and the starting spin
count:

```ts
import type { SpinPrize } from '@/lib/games';

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

(`spin-mock.ts` imports the `SpinPrize` type from `games.ts`, and `games.ts` imports the mock array
from `spin-mock.ts` — this is fine in TS/ES modules since only a type is imported back into
`spin-mock.ts`, so there's no runtime circular-import issue. Confirmed pattern: same shape as
`quiz-mock.ts` importing `QuizQuestion` from `QuizSheet.tsx`.)

## Component: `src/components/dugout/SpinWheelOverlay.tsx`

Props:

```ts
type Props = {
  visible: boolean;
  prizes: SpinPrize[]; // exactly 6
  initialSpinsLeft: number;
  onClose: () => void;
};
```

### Presentation container

`Modal` (`transparent`, `animationType="fade"`, matches `QuizSheet`/`MediaSheet`'s use of `Modal`
for consistency) containing a full-screen backdrop `Pressable` (`rgba(16, 16, 19, 0.4)`, same as
`QuizSheet`/`MediaSheet`) and a centered content `View` (`justifyContent: 'center', alignItems:
'center'`, `flex: 1`). The content `View` uses Reanimated's `ZoomIn.duration(240)` /
`ZoomOut.duration(160)` entering/exiting animations (already a dependency, used in
`ChatBubble.tsx`) — this is the "from center" presentation distinct from `QuizSheet`'s bottom
slide-up.

Tapping the backdrop calls `onClose` only when the wheel is idle (not mid-spin and not in the
brief post-result pause) — spinning must not be interruptible by an accidental backdrop tap.

### Wheel graphic (`react-native-svg`)

- Outer gold ring: `Circle` stroke, `colors.amber600`-ish gold tone, radius ~140.
- 6 pie segments via `Path` arcs, alternating `semantic.surfaceBrand` (red) and `semantic.surfaceTint`
  (light pink) fills, each spanning 60°.
- Each segment's prize icon (lucide, from `SpinPrizeIcon` → component map, mirroring `Icon.tsx`'s
  pattern) is placed at that segment's mid-angle, at ~65% of the radius from center, wrapped in a
  small white circular badge for contrast (same visual idea as the reference's white icon discs).
- All of the above (ring, segments, icons) lives inside one rotating `<G>` whose `rotation`/
  `origin` prop is driven by a Reanimated shared value converted to a plain number each frame
  (via `useAnimatedProps` on the `G`, since `react-native-svg` supports Reanimated through
  `Animated.createAnimatedComponent`).
- A static (non-rotating) pointer triangle sits above the wheel at 12 o'clock, outside the `<G>`.

### Center hub

A circular `Pressable` overlapping the wheel's center (white/cream fill, red border, drop shadow),
containing two lines of text: "TAP TO" (small) / "SPIN & WIN" (bold, brand red) — mirrors
`play-spin.png`. Disabled (non-interactive, reduced opacity) while `phase !== 'idle'`.

### Below the wheel

- Auto-spin caption: `"Auto spin in {n} secs"`, `typography.bodySm`, visible only when
  `phase === 'idle'` and `spinsLeft > 0`.
- Spins-left pill: `"x{n} spins left"`, white pill with hairline border, always visible while
  `spinsLeft > 0`.
- "Terms and Conditions" — plain `Text` styled as a link (`textBrand`, underline), no `onPress`
  handler in this slice (non-goal: no T&C destination exists).

### State machine

```ts
type Phase = 'idle' | 'spinning' | 'result';
```

- `spinsLeft: number` — starts at `initialSpinsLeft`.
- `phase: Phase` — starts `'idle'`.
- `countdownSec: number` — starts at 10, ticks down by 1/sec while `phase === 'idle' && spinsLeft >
  0`; reaching 0 calls the same `startSpin()` used by the hub tap.
- `rotation` — a Reanimated shared value (`useSharedValue(0)`), persists across spins (each spin
  adds to it rather than resetting to 0, so the wheel always turns forward, never snaps back).
- `startSpin()`: guarded to no-op unless `phase === 'idle' && spinsLeft > 0`. Picks
  `winningIndex = Math.floor(Math.random() * prizes.length)`, computes the target absolute
  rotation (current rotation, rounded up to the next full multiple of 360, plus `4 * 360` extra
  full turns, plus the offset needed to bring `winningIndex`'s segment center under the top
  pointer), sets `phase = 'spinning'`, and animates `rotation` to that target via
  `withTiming(target, { duration: 3000, easing: Easing.out(Easing.cubic) })` with a
  `runOnJS`-wrapped completion callback.
- On spin completion: set `phase = 'result'` (segment visually highlighted — e.g. a subtle
  scale/opacity pulse on that segment's icon badge — for 1.2s), decrement `spinsLeft`, then after
  the 1.2s pause: if `spinsLeft > 0`, reset `phase = 'idle'` and `countdownSec = 10` (arming the
  next auto-spin countdown); if `spinsLeft === 0`, call `onClose()` — the last spin (whether
  triggered manually or by auto-spin) always ends by closing the overlay once its result has been
  shown, per the user's explicit direction ("let the user spin or close it after auto spin").
- Reset-on-close: like `QuizSheet`, a `!visible` effect resets `spinsLeft`, `phase`, `countdownSec`,
  and `rotation.value` back to their initial values so reopening the overlay always starts fresh
  (Modal doesn't unmount on `visible=false`).

## Integration: `src/app/match/[matchId]/chat.tsx`

- New state: `activeGame: ActiveGame | null`, `loadingGame: boolean`.
- The `Composer`'s `onOpenQuiz` prop is renamed to a generic `onOpenGame` (prop rename inside
  `Composer.tsx` too — it's still the same round gamepad button, just no longer quiz-specific).
  Handler:

  ```ts
  onOpenGame: async () => {
    setReactionTargetId(null);
    Keyboard.dismiss();
    if (!matchId || loadingGame) return;
    setLoadingGame(true);
    try {
      const game = await fetchActiveGame(matchId);
      setActiveGame(game);
    } finally {
      setLoadingGame(false);
    }
  }
  ```

- Render, as siblings of `MediaSheet`:

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

  (`QuizSheet`/`SpinWheelOverlay` always receive a valid `question`/`prizes` prop, falling back to
  the mock constants, so `visible={false}` never leaves them with `undefined` required props —
  same defensive pattern already implied by `QuizSheet`'s existing required `question` prop.)
- `quizBadge` on `Composer` becomes `gameBadge` (still a static `true` — no real "is a game
  available" signal exists yet, non-goal for this slice).
- Local `quizOpen` state is removed entirely, replaced by `activeGame`.

## Styling tokens used

Existing tokens only: `semantic.{surfacePage, surfaceTint, surfaceBrand, lineBrand, lineHairline,
lineStrong, textDisplay, textBrand, textMuted, textOnBrand}`, `spacing.*`, `radius.{pill, xl}`,
`typography.{label, bodySm, caption}`, plus `colors.amber600` for the wheel's gold ring (already
used for the composer's quiz badge dot).

## Testing

- Manual verification via Expo: tap the games button repeatedly until a spin result is observed
  (mock is 50/50 quiz/spin), confirm the wheel appears centered with a fade/zoom-in (not a bottom
  slide), the countdown ticks and auto-spins at 0, tapping the hub also spins, the wheel lands on
  a plausible segment under the pointer, the spins-left pill decrements, and the overlay
  auto-closes after the second (final) spin's result is shown.
- No automated tests exist for chat UI in this repo (consistent with `MediaSheet`/`QuizSheet`
  precedent); none added here.
