# Quiz Bottom Sheet — Design

## Context

Dugout's match chat screen (`src/app/match/[matchId]/chat.tsx`) already has a manual per-team
bot-banter trigger (`BotBanterBar`) and a media picker sheet (`MediaSheet`). We're adding a third
piece of match-chat interactivity: a live trivia quiz shown as a bottom sheet, modeled on a
reference mockup (`quiz-view.png`) and the "Dugout Design System" Claude Design project
(`components/chat/PollCard.jsx`, `components/app/BottomSheet.jsx`).

Dugout is a football (soccer) product — matches, sim data, and scoreboard state
(`server/src/scoreboard.ts`) all use `matchMinute`/`clockLabel`, not cricket overs. The reference
mockup's "Over 14" framing is cricket-styled reference art only; the shipped copy is adapted to
football terms.

Confirmed via search: no quiz/poll/tug/vote concept exists anywhere in `server/` or `src/` today.
This is a greenfield UI feature with local mock data — no backend changes in this slice.

## Goals

- A `QuizSheet` bottom-sheet component matching the visual language of the existing design system
  (`BottomSheet`, `PollCard`, `Badge`, `Button`) and the reference screenshot.
- A manual trigger (test button) in the match chat screen to open it, same pattern as the existing
  per-team banter buttons.
- Tap-to-lock single-choice answering with a running countdown timer that auto-locks at zero.
- Local mock quiz data shaped so a future `GET /quiz`-style endpoint is a drop-in replacement.

## Non-goals

- No tug-of-war / fan-vs-fan meter bar (explicitly excluded).
- No backend/Gemini quiz generation, no Supabase persistence, no real-time sync across clients.
- No auto-trigger from a Stream chat event — this slice is manual-trigger only.

## Component: `src/components/dugout/QuizSheet.tsx`

Structural pattern borrowed from `MediaSheet.tsx`: `Modal` (`transparent`, `animationType="slide"`)
containing a backdrop `Pressable` (dismiss on tap) and an animated sheet `View` anchored to the
bottom, rounded top corners (`radius.xl`), `semantic.surfacePage` background.

Props:

```ts
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
  onClose: () => void;
};
```

`QuizOption`/`QuizQuestion` are exported from `QuizSheet.tsx` so `chat.tsx` (or
`src/lib/quiz-mock.ts`) can type the mock data against them.

Internal state: `selectedKey: string | null`, `remainingSec: number`. Both reset via a dedicated
`!visible` effect — mirroring `MediaSheet.tsx`'s reset effect (lines 80–89) — that sets
`selectedKey` back to `null`, `remainingSec` back to `question.durationSec`, and clears any pending
interval, so reopening the sheet after a prior lock/timeout always starts fresh. While `visible` is
true and `remainingSec > 0`, a 1s interval ticks `remainingSec` down. Selecting an option when
`selectedKey` is null and `remainingSec > 0` locks in that answer (`selectedKey` set, interval
cleared). When the timer reaches 0 with no selection, the countdown stops and the correct answer is
revealed as if locked (no user pick highlighted).

### Layout (top to bottom)

1. **Handle** — 40×4 pill, `semantic.lineStrong`, centered (matches `MediaSheet`'s handle exactly:
   `width: 40, height: 4`).
2. **Header row** — flex row, space-between:
   - Left column: small uppercase red label `typography.label` reading `LIVE · <clockLabel or
     "MIN --">` (clock text passed in or defaulted), then `typography.displayMd` "Quiz" below it.
   - Right: a circular countdown badge — 56px circle, `semantic.surfaceBrand` fill (or
     `semantic.lineBrand` tint once at 0), white bold `M:SS` text, small "LEFT" caption beneath,
     mirroring the reference screenshot's red circle timer.
3. **Question card** — `semantic.surfaceTint` background, `semantic.lineBrand` 1px border,
   `radius.card`, padding `spacing.s5`, `gap spacing.s5` (visual language of `PollCard`):
   - Small red uppercase label, `typography.label`: `QUIZ BREAK · PICK ONE`.
   - Question text: `typography.title`, uppercase, `semantic.textDisplay`.
   - 2×2 option grid: a container `View` with `gap: spacing.s4` holding two row `View`s
     (`flexDirection: 'row'`, `gap: spacing.s4`), each containing two option buttons with
     `flex: 1` (no percentage widths, no `flexWrap` — avoids the width/gap math ambiguity of a
     wrapping flex-row). Each option is a white rounded-rect button (`radius.md`, min height
     `spacing.controlH`, `typography.rowName`, uppercase). States:
     - Default: white background, `semantic.lineHairline` border, `semantic.textDisplay` text.
     - Locked + this option is `correctKey`: green tint background/text (new `semantic.surfaceSuccess`
       / `semantic.textSuccess` tokens, see below), green check icon trailing.
     - Locked + this option is the wrong `selectedKey`: `semantic.surfaceTint` (red tint)
       background, `semantic.textBrand` text, red X icon trailing.
     - Locked + neither (unselected, incorrect): default styling, slightly dimmed (`opacity: 0.6`).
   - All options `disabled` (non-interactive) once `selectedKey` is set or `remainingSec === 0`.

### Icons

`Icon.tsx` currently exports `chevron-left`, `plus`, `send`. Add `circle-check` (lucide
`CheckCircle2`) and `circle-x` (lucide `XCircle`) for the locked-answer states.

### New tokens required: success color

`tokens.ts` has no green surface/text token today (only `colors.green600`, unexposed as a
semantic). Add two semantic tokens alongside the existing ones in `src/theme/tokens.ts`:

```ts
surfaceSuccess: 'rgba(18, 133, 90, 0.12)', // colors.green600 @ 12%, mirrors surfaceTint's role
textSuccess: colors.green600,
```

This is the one intentional token addition in this slice; everything else reuses existing tokens.

## Integration: `src/app/match/[matchId]/chat.tsx`

- New state: `quizOpen: boolean`.
- A local mock `QuizQuestion` constant in the screen (or a small `src/lib/quiz-mock.ts` if that
  reads cleaner) — one hardcoded football trivia question, 4 options, `durationSec: 45`.
- A manual trigger button rendered unconditionally (not gated on `hasBotTeams`), as its own row
  placed directly above the composer wrap — below `BotBanterBar` when that row is present, or in
  its place when it isn't (matches without both teams still need a way to test the quiz sheet).
  Styled as a small `outline`/`secondary` pill button reading "Quiz" — opens `quizOpen`,
  dismissing the keyboard first (same pattern as the media-sheet open handler).
- Render `<QuizSheet visible={quizOpen} question={MOCK_QUIZ_QUESTION} onClose={() =>
  setQuizOpen(false)} />` as a sibling to `<MediaSheet ... />` outside the `SafeAreaView`, so it
  overlays the whole screen including the header/score strip (matches the reference screenshot's
  dimmed backdrop covering everything above the sheet).

## Styling tokens used

Mostly existing `src/theme/tokens.ts` values, plus the two new `surfaceSuccess`/`textSuccess`
tokens noted above: `semantic.{surfacePage, surfaceTint, surfaceTintStrong, surfaceBrand,
surfaceSuccess, lineBrand, lineHairline, lineStrong, textDisplay, textBrand, textSuccess, textMuted,
textOnBrand}`, `spacing.{s3..s8, gutterScreen, controlH}`, `radius.{xl, card, md, pill}`,
`typography.{label, displayMd, title, rowName}`, `fonts.button`.

## Testing

- Manual verification via `run` skill / Expo: open match chat, tap the Quiz test button, confirm
  sheet slides up, countdown ticks, tapping an option locks it with correct/incorrect visual
  feedback, timer running out with no pick still reveals the correct answer, backdrop tap and
  auto-lock both leave the sheet dismissible.
- No automated tests exist for chat UI in this repo currently; none added for this slice
  (consistent with existing `MediaSheet`/`BotBanterBar` precedent).
