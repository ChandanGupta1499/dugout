/**
 * One-shot: root semiFinal.chat.json + semifinal.commentary.json
 * → server/data/sim/chat.json + commentary.json
 *
 * Run from server/: npx tsx scripts/normalize-sim-data.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(serverRoot, '..');
const outDir = join(serverRoot, 'data/sim');

type YtRun = { text?: string; emoji?: { emojiId?: string; image?: { accessibility?: { accessibilityData?: { label?: string } } } } };
type YtItem = {
  replayChatItemAction?: {
    videoOffsetTimeMsec?: string;
    actions?: Array<{
      addChatItemAction?: {
        item?: {
          liveChatTextMessageRenderer?: {
            message?: { runs?: YtRun[] };
            authorName?: { simpleText?: string };
          };
        };
      };
    }>;
  };
};

function parseTimeLabel(label: string): number | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)'(?:\+(\d+)')?$/);
  if (!match) return null;
  return Number(match[1]) + Number(match[2] ?? 0);
}

function normalizeChat() {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'semiFinal.chat.json'), 'utf8'),
  ) as YtItem[];

  const messages: Array<{ offsetMs: number; author: string; text: string }> =
    [];

  for (const obj of raw) {
    const rca = obj.replayChatItemAction;
    if (!rca?.videoOffsetTimeMsec) continue;
    const offsetMs = Number(rca.videoOffsetTimeMsec);
    for (const action of rca.actions ?? []) {
      const renderer =
        action.addChatItemAction?.item?.liveChatTextMessageRenderer;
      if (!renderer) continue;
      const parts: string[] = [];
      for (const run of renderer.message?.runs ?? []) {
        if (run.text) parts.push(run.text);
        else if (run.emoji) {
          const label =
            run.emoji.image?.accessibility?.accessibilityData?.label ??
            run.emoji.emojiId ??
            '';
          if (label) parts.push(label);
        }
      }
      const text = parts.join('').trim();
      if (!text) continue;
      messages.push({
        offsetMs,
        author: renderer.authorName?.simpleText?.trim() || 'viewer',
        text,
      });
    }
  }

  messages.sort((a, b) => a.offsetMs - b.offsetMs);
  writeFileSync(join(outDir, 'chat.json'), JSON.stringify(messages));
  return messages.length;
}

function normalizeCommentary() {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'semifinal.commentary.json'), 'utf8'),
  ) as { plays?: Array<{ text?: string; timeLabel?: string }> };

  const events: Array<{ matchMinute: number; label: string; text: string }> =
    [];

  for (const play of [...(raw.plays ?? [])].reverse()) {
    const text = play.text?.trim();
    if (!text) continue;
    const label = play.timeLabel?.trim() ?? '';
    const matchMinute = parseTimeLabel(label);
    if (matchMinute == null) continue;
    events.push({ matchMinute, label, text });
  }

  events.sort((a, b) => a.matchMinute - b.matchMinute);
  writeFileSync(
    join(outDir, 'commentary.json'),
    JSON.stringify(
      { matchId: 'eng-arg-semi-2026', events },
      null,
      2,
    ),
  );
  return events.length;
}

mkdirSync(outDir, { recursive: true });
const chatCount = normalizeChat();
const commentaryCount = normalizeCommentary();
console.log(
  `Wrote data/sim/chat.json (${chatCount} msgs) and data/sim/commentary.json (${commentaryCount} events)`,
);
