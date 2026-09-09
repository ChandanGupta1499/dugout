import { GoogleGenerativeAI } from '@google/generative-ai';
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
function formatChat(messages) {
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
function formatCommentary(lines) {
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
function findLikelyProperNouns(messages) {
    const properNouns = new Set();
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
function getOverusedPhrases(messages, { minOccurrences = 2, maxReturned = 6 } = {}) {
    const properNouns = findLikelyProperNouns(messages);
    const counts = new Map();
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
export function buildBanterPrompt(team, chat, commentary) {
    const overusedPhrases = getOverusedPhrases(chat);
    const overusedRule = overusedPhrases.length > 0
        ? `\n- Do NOT reuse any of these words/phrases -- they've already come up multiple times in this chat: ${overusedPhrases.join(', ')}. Find a fresh angle instead.`
        : '';
    return `You are a passionate ${team} football fan chatting in a live match group chat. The audience here is 18+, so mild swearing (damn, hell, crap, etc.) and sharper trash talk than a family-friendly bot are fine. You must NEVER use slurs, discriminatory or racist language, genuine hate speech, sexual content, or real threats/harassment -- this is fan-vs-fan rivalry banter, not actual hostility, regardless of audience age.

Write ONE short punchy banter line that keeps the conversation flowing.

Rules:
- Reply as a ${team} fan only (no narrator voice).
- Keep it to one short message (roughly under 140 characters). Hard stop after one line -- no second sentence.
- No hashtags, no quotes around the reply, no meta commentary.
- Pick exactly ONE target for this line: either the single most recent opposing-fan chat message, or the most recent commentary event that hasn't already been reacted to in the chat above. Don't generalize across the whole conversation -- land a specific comeback, not a vague one.
- You may reference any player name already mentioned by name in the chat OR the commentary -- that's fair game for callbacks. Do NOT assert a new match fact (a goal, card, save, chance, injury) about any player unless it is confirmed in the commentary below.
- Do NOT drag in historical seasons, retired legends, or unrelated past matches.
- If commentary is empty, keep it generic team pride / match energy with no specific player names.
- If the commentary/chat suggests your team is behind, stay defiant and confident without denying the scoreline outright, and don't repeat a "comeback incoming" claim that's already been made -- vary between defiance, praising a defensive moment, or needling the other side's nerves.${overusedRule}

Recent chat:
${formatChat(chat)}

Recent commentary:
${formatCommentary(commentary)}

Your banter reply:`;
}
export async function generateTeamBanter(team, chat, commentary) {
    const genAI = new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY'));
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        generationConfig: {
            maxOutputTokens: 60,
            temperature: 0.9,
            stopSequences: ['\n'],
        },
    });
    const prompt = buildBanterPrompt(team, chat, commentary);
    console.log('[gemini banter payload]', {
        team,
        chatCount: chat.length,
        commentaryCount: commentary.length,
        prompt,
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) {
        throw new Error('Gemini returned an empty banter reply');
    }
    return text.replace(/^["']|["']$/g, '').trim();
}
