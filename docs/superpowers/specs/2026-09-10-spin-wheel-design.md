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

## Data: `src/lib/spin-mock.ts`

`SpinPrize`/`SpinPrizeIcon` are defined here (not in `games.ts`) precisely so `games.ts` only ever
imports *from* `spin-mock.ts` and never the other way around — a clean one-way dependency, the
same shape as `quiz-mock.ts`'s one-way type import from `QuizSheet.tsx`, just with the type's home
file swapped. `SpinWheelOverlay.tsx` also imports `SpinPrize`/`SpinPrizeIcon` from here.

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

## Data & types: `src/lib/games.ts`

```ts
import type { QuizQuestion } from '@/components/dugout/QuizSheet';
import { MOCK_QUIZ_QUESTION } from '@/lib/quiz-mock';
import { MOCK_SPIN_PRIZES, INITIAL_SPINS_LEFT, type SpinPrize } from '@/lib/spin-mock';

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

**Feasibility flag:** `react-native-svg` has zero existing usage anywhere in this app today — this
is the first time it's actually driven by Reanimated here. `Animated.createAnimatedComponent`
wrapping an `react-native-svg` `G` and rotating it via `useAnimatedProps` is a documented,
widely-used pattern for this exact library pairing, but it is *not yet verified in this codebase*.
The implementation plan must include a small standalone spike (render one static SVG circle,
confirm it rotates smoothly via a Reanimated shared value on both iOS and Android) as its first
task, before building the full wheel on top of that foundation — treat this as a de-risking step,
not a formality.

**Required `Icon.tsx` additions:** none of `coins`/`car`/`smartphone`/`bike`/`gift`/`award` exist
in `src/components/dugout/Icon.tsx` today. The plan must add all six as new `ICONS` map entries
before `SpinWheelOverlay.tsx` can compile:

```ts
import { Award, Bike, Car, Coins, Gift, Smartphone } from 'lucide-react-native';
// ...added to the existing ICONS map:
coins: Coins,
car: Car,
smartphone: Smartphone,
bike: Bike,
gift: Gift,
award: Award,
```

(All six are confirmed exports of the installed `lucide-react-native` version.)

- Outer gold ring: `Circle` stroke, `colors.amber600`-ish gold tone, radius ~140.
- 6 pie segments via `Path` arcs, alternating `semantic.surfaceBrand` (red) and `semantic.surfaceTint`
  (light pink) fills, each spanning 60°.
- Each segment's prize icon (via the `Icon.tsx` names added above) is placed at that segment's
  mid-angle, at ~65% of the radius from center, wrapped in a small white circular badge for
  contrast (same visual idea as the reference's white icon discs).
- All of the above (ring, segments, icons) lives inside one rotating `<G>` whose `rotation`/
  `origin` prop is driven by a Reanimated shared value converted to a plain number each frame
  (via `useAnimatedProps` on the `G`).
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

**Angle convention (must be followed exactly, not re-derived per-implementation):**
- Segment `i` (0-indexed, 0-5) is drawn spanning `[i * 60°, (i + 1) * 60°)` using standard SVG
  arc angles: 0° is 3 o'clock, angles increase **clockwise** (this is `react-native-svg`'s/SVG's
  native convention — no sign flip needed when computing `Path` arc coordinates with
  `cos`/`sin`). Segment `i`'s center angle is therefore `i * 60 + 30` degrees.
- The static pointer is drawn at 12 o'clock, which is **270°** in that same convention (or
  equivalently `-90°`).
- The `<G>` rotates **clockwise** for positive `rotation` values (SVG's `rotation` prop convention).
  After rotating the group by `R` degrees, the segment that was originally at angle `A` is now at
  angle `A + R` (mod 360). For the winning segment (`winningIndex`, drawn center angle
  `Aw = winningIndex * 60 + 30`) to land under the pointer at 270°, we need
  `(Aw + R) mod 360 === 270`, i.e. `R mod 360 === (270 - Aw) mod 360`.
- `startSpin()` computes: `targetMod = ((270 - Aw) % 360 + 360) % 360` (normalize to [0, 360)),
  then `target = (Math.ceil(rotation.value / 360) * 360) + (4 * 360) + targetMod` — i.e. take the
  current rotation up to its next full multiple of 360, add 4 extra full spins for visual effect,
  then add `targetMod` so the final absolute angle mod 360 equals `targetMod`. This guarantees
  `target > rotation.value` (always spins forward) and lands exactly on the winning segment.
- `startSpin()`: guarded to no-op unless `phase === 'idle' && spinsLeft > 0`. Picks
  `winningIndex = Math.floor(Math.random() * prizes.length)`, computes `target` per the formula
  above, sets `phase = 'spinning'`, and animates via
  `rotation.value = withTiming(target, { duration: 3000, easing: Easing.out(Easing.cubic) },
  (finished) => { if (finished) runOnJS(handleSpinLanded)(winningIndex); })`. **The `finished`
  guard is required**: `withTiming`'s callback fires with `finished=false` if `rotation` is
  reassigned mid-flight (e.g. by the reset-on-close effect below) — only treat the spin as landed
  when `finished === true`, otherwise skip the state transition entirely (the reset effect already
  puts `phase` back to `'idle'` in that case, so there is nothing else to do).
- `handleSpinLanded(winningIndex)` (runs on JS thread): set `phase = 'result'` (the landed
  segment's icon badge gets a brief scale/opacity pulse for 1.2s), decrement `spinsLeft`, and
  schedule a single `setTimeout(..., 1200)` — stored in a ref so it can be cleared — that then:
  if `spinsLeft > 0`, resets `phase = 'idle'` and `countdownSec = 10` (arming the next auto-spin
  countdown); if `spinsLeft === 0`, calls `onClose()`. The last spin (whether triggered manually or
  by auto-spin) always ends by closing the overlay once its result has been shown, per the user's
  explicit direction ("let the user spin or close it after auto spin").
- Cleanup: the component clears both the countdown `setInterval` and the result-pause `setTimeout`
  (via refs, same pattern as `QuizSheet`'s `intervalRef`) on unmount and whenever `visible` becomes
  `false`, so neither can call `setState` after the overlay is gone.
- Reset-on-close: like `QuizSheet`, a `!visible` effect clears both timers, then resets `spinsLeft`,
  `phase`, `countdownSec`, and `rotation.value` back to their initial values (no `withTiming` — a
  direct assignment, so any in-flight animation's callback subsequently fires with
  `finished=false` and is correctly ignored per the guard above) so reopening the overlay always
  starts fresh (Modal doesn't unmount on `visible=false`).

## Integration: `src/app/match/[matchId]/chat.tsx`

- New state: `activeGame: ActiveGame | null`, `loadingGame: boolean`.
- The `Composer`'s public props rename: `onOpenQuiz` → `onOpenGame`, `quizBadge` → `gameBadge`.
  Rename the internal bits too, for consistency (it's still the same round gamepad button, just no
  longer quiz-specific): the destructured prop names, and the style keys `styles.quizButton` →
  `styles.gameButton`, `styles.quizBadge` → `styles.gameBadge` in `Composer.tsx`. Handler:

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
