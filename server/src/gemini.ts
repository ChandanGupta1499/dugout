import { GoogleGenerativeAI, type Tool } from '@google/generative-ai';

import type { CommentaryLine } from './context.js';
import type { ChatMessageLine } from './stream.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function formatChat(messages: ChatMessageLine[]): string {
  if (messages.length === 0) {
    return '(no recent chat messages)';
  }
  return messages
    .map((message) => {
      const who = message.name?.trim() || message.userId;
      return `${who}: ${message.text}`;
    })
    .join('\n');
}

function formatCommentary(lines: CommentaryLine[]): string {
  if (lines.length === 0) {
    return '(no recent commentary)';
  }
  return lines
    .map((line) => (line.at ? `[${line.at}] ${line.text}` : line.text))
    .join('\n');
}

// Words too short/common to be useful as "overused phrase" flags, plus a
// couple of banter-specific filler words worth capping even though they
// aren't classic stopwords (e.g. "mate" tends to get repeated by every fan).
const FILLER_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'was', 'are', 'and', 'to', 'of', 'in', 'on',
  'you', 'your', 'we', 'our', 'i', 'it', 'that', 'this', 'for', 'at',
  'mate', 'already', 'just',
]);

/**
 * Words that are capitalized mid-sentence (not just because they start a
 * sentence) are almost always proper nouns -- player/team names -- which we
 * want to keep OUT of the "overused phrase" ban list. Banning a name like
 * "Courtois" just because it came up twice would directly contradict the
 * prompt rule that lets the model reuse names already established in chat
 * for callbacks.
 */
function findLikelyProperNouns(messages: ChatMessageLine[]): Set<string> {
  const properNouns = new Set<string>();
  for (const message of messages) {
    const sentences = message.text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const words = sentence.match(/[a-zA-Z']+/g) ?? [];
      words.forEach((raw, index) => {
        if (index > 0 && /^[A-Z]/.test(raw)) {
          properNouns.add(raw.toLowerCase());
        }
      });
    }
  }
  return properNouns;
}

/**
 * Scans recent chat text for (non-proper-noun) words repeated 2+ times so
 * the prompt can explicitly tell the model to avoid them. Without this, the
 * model treats its own earlier lines (which are part of the chat history
 * it's shown) as "established style to continue" and keeps recycling the
 * same callbacks ("sweating bullets", "that equalizer is loading", etc.)
 * instead of finding a fresh angle.
 */
function getOverusedPhrases(
  messages: ChatMessageLine[],
  { minOccurrences = 2, maxReturned = 6 } = {},
): string[] {
  const properNouns = findLikelyProperNouns(messages);
  const counts = new Map<string, number>();
  for (const message of messages) {
    const words = message.text.toLowerCase().match(/[a-z']+/g) ?? [];
    for (const word of words) {
      if (word.length < 4 || FILLER_STOPWORDS.has(word) || properNouns.has(word)) {
        continue;
      }
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxReturned)
    .map(([word]) => word);
}

// Below this many combined chat + commentary lines, there usually isn't
// enough live material for a specific callback, so the prompt tells the
// model it's allowed to reach for a real head-to-head/history fact via
// search instead of inventing something vague.
const SPARSE_CONTEXT_THRESHOLD = 4;

type BanterLanguage = 'english' | 'hindi' | 'hinglish';

const LANGUAGE_INSTRUCTIONS: Record<BanterLanguage, string> = {
  english: 'Write this line fully in English.',
  hindi: 'Write this line fully in Hindi (Devanagari script).',
  hinglish: 'Write this line in Hinglish -- Hindi mixed with English, in Roman script, the way Indian fans actually type in chat (e.g. "yeh toh sharam ki baat hai bhai").',
};

// Each call is stateless (no memory of what language the last reply used),
// so leaving the choice up to the model converges on whichever style it
// happens to favor -- picking it here, weighted toward English/Hinglish
// since that's how most of this chat actually talks, guarantees an
// actual mix across replies instead of the model settling into one lane.
function pickBanterLanguage(): BanterLanguage {
  const roll = Math.random();
  if (roll < 0.45) return 'english';
  if (roll < 0.85) return 'hinglish';
  return 'hindi';
}

export function buildBanterPrompt(
  team: string,
  opponent: string | undefined,
  chat: ChatMessageLine[],
  commentary: CommentaryLine[],
  language: BanterLanguage = pickBanterLanguage(),
): string {
  const overusedPhrases = getOverusedPhrases(chat);
  const overusedRule =
    overusedPhrases.length > 0
      ? `\n- Do NOT reuse any of these words/phrases -- they've already come up multiple times in this chat: ${overusedPhrases.join(', ')}. Find a fresh angle instead.`
      : '';

  const isSparse = chat.length + commentary.length < SPARSE_CONTEXT_THRESHOLD;
  const opponentLabel = opponent ?? 'the opposing team';
  const searchRule = isSparse
    ? `\n- The chat and commentary below are thin right now -- there's not much to react to. Use search to find one real, specific fact about ${team} vs ${opponentLabel} (head-to-head record, a famous past meeting, a recent result, a known rivalry storyline) and build your line around that instead of generic hype.`
    : `\n- Only reach for search if the chat and commentary genuinely give you nothing to react to. Prefer a live callback over a history lesson whenever one is available.`;

  return `You are a die-hard ${team} fan trash-talking in a live match group chat against ${opponentLabel} fans. This is an 18+ app. You are here to bait, provoke, and keep rival fans hooked and replying -- think of yourself as a rival supporter at the pub, not a moderated brand account. Sharp, brutal, cocky trash talk is the whole point: mock the other team's play, their fans' nerves, their manager's tactics, their history of chokes. Mild-to-medium swearing (damn, hell, crap, screw, pathetic, choke, etc.) is fine and encouraged when it lands. Confidence and mockery, not caution.

Hard limits (never cross these, no matter how heated it gets):
- No slurs or discriminatory language of any kind (race, nationality, religion, gender, sexuality, etc.).
- No genuine hate speech, no sexual content, no real-world threats, no harassment of a real named private individual.
- Target the TEAM, the PLAY, and the FANS' in-chat cockiness -- never a player's family, health, or anything outside football.
This is fan-vs-fan rivalry theater, not actual hostility -- brutal on the banter, never genuinely cruel.

Write ONE short punchy line that acts as a hook -- it should needle the other side hard enough that they want to fire back immediately. Ending on a taunt, a challenge, or a pointed jab works better than just stating an opinion. A reply nobody feels the need to respond to is a failure, no matter how accurate it is.

Bad examples (too soft/bland -- never write like this):
- "Nice save though."
- "This is a good match."
- "We'll get one back soon."
Good examples (this is the bar -- specific, cocky, baiting a reply):
- "That 'keeper's been carrying your whole back line, say thank you to him later."
- "Comfortable? Your fans were already refreshing flight prices to the final an hour ago."
- "Bro really cleared that off the line with his face and y'all are calling it composure."
- "Itna ghabra kyu rahe ho bhai, abhi toh match shuru hua hai."

Rules:
- Reply as a ${team} fan only (no narrator voice).
- Keep it to one short message (roughly under 140 characters). Exactly one sentence, no follow-up sentence.
- Output ONLY the banter line itself -- no lead-in like "Sure," "Here's one:", no quotes around it, no hashtags, no meta commentary, no explanation of the joke.
- Never write a bland/neutral/pleasant line (e.g. "nice one", "good game", "great save") -- if you don't have a sharp angle, dig for one via the rules below rather than defaulting to something safe.
- Pick exactly ONE target for this line: either the single most recent opposing-fan chat message, or the most recent commentary event that hasn't already been reacted to in the chat above. Don't generalize across the whole conversation -- land a specific comeback, not a vague one.
- You may reference any player name already mentioned by name in the chat OR the commentary -- that's fair game for callbacks. Do NOT assert a new match fact (a goal, card, save, chance, injury) about any player unless it is confirmed in the commentary below.${searchRule}
- If the commentary/chat suggests your team is behind, stay defiant and confident without denying the scoreline outright, and don't repeat a "comeback incoming" claim that's already been made -- vary between defiance, praising a defensive moment, or needling the other side's nerves.${overusedRule}
- Language for THIS reply: ${LANGUAGE_INSTRUCTIONS[language]} It still has to land as a sharp taunt in that language/style, not a stiff translation of a polite line.

Recent chat (up to the last 500 messages):
${formatChat(chat)}

Commentary so far:
${formatCommentary(commentary)}

Output only the banter line, nothing else:`;
}

export async function generateTeamBanter(
  team: string,
  opponent: string | undefined,
  chat: ChatMessageLine[],
  commentary: CommentaryLine[],
): Promise<string> {
  const genAI = new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY'));
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig: {
      // Grounded (search) turns spend part of the budget on internal
      // retrieval/reasoning before the model writes the actual reply, and
      // that's been eating most of a 200-500 token budget and cutting the
      // visible line off mid-sentence. (Tried forcing thinkingBudget: 0 to
      // stop that outright, but this model rejects that field with a 400 --
      // so just give it a lot more headroom instead.)
      maxOutputTokens: 1024,
      temperature: 1.0,
    },
    // `googleSearch` (Gemini 2.0+ grounding) isn't in this SDK version's
    // Tool union yet -- it only knows the older `googleSearchRetrieval`
    // shape -- but the REST payload accepts it, so we cast past the type.
    tools: [{ googleSearch: {} } as unknown as Tool],
  });
  const language = pickBanterLanguage();
  const prompt = buildBanterPrompt(team, opponent, chat, commentary, language);
  console.log('[gemini banter payload]', {
    team,
    opponent,
    language,
    chatCount: chat.length,
    commentaryCount: commentary.length,
    prompt,
  });
  const result = await model.generateContent(prompt);
  const finishReason = result.response.candidates?.[0]?.finishReason;
  const raw = result.response.text().trim();

  if (finishReason === 'MAX_TOKENS') {
    console.warn('[gemini banter] response hit maxOutputTokens and may be truncated', {
      team,
      raw,
      usageMetadata: result.response.usageMetadata,
    });
  }

  if (!raw) {
    throw new Error('Gemini returned an empty banter reply');
  }

  // The model sometimes prefixes the real line with a throwaway lead-in
  // ("Sure, here's one:") on its own line despite instructions not to --
  // the actual banter is reliably the last non-empty line it writes.
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const text = (lines[lines.length - 1] ?? raw).replace(/^["']|["']$/g, '').trim();

  console.log('[gemini banter response]', {
    team,
    opponent,
    raw,
    text,
  });

  return text;
}
