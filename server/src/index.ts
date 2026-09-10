import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import { adminRouter } from './admin.js';
import { postTeamBanter } from './bot.js';
import { searchGiphy, type GiphyKind } from './giphy.js';
import { getMatch, listMatches } from './matches.js';
import { getMatchScoreboard } from './scoreboard.js';
import { initSimFromStore, simRouter } from './sim/index.js';
import { assertSupabaseConfigured } from './supabase.js';
import {
  ensureMatchChannel,
  ensureRoomChannel,
  getApiKey,
  upsertGuestUser,
} from './stream.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const started = Date.now();
  console.log(`→ ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const ms = Date.now() - started;
    console.log(`← ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });

  next();
});

app.use(simRouter);
app.use(adminRouter);
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/matches', async (_req, res) => {
  try {
    res.json(await listMatches());
  } catch (error) {
    console.error('GET /matches failed', error);
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

app.get('/matches/:matchId', async (req, res) => {
  try {
    const match = await getMatch(req.params.matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    res.json(match);
  } catch (error) {
    console.error('GET /matches/:matchId failed', error);
    res.status(500).json({ error: 'Failed to load match' });
  }
});

app.get('/matches/:matchId/scoreboard', async (req, res) => {
  try {
    const match = await getMatch(req.params.matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    const scoreboard = await getMatchScoreboard(req.params.matchId);
    if (!scoreboard) {
      res.status(404).json({ error: 'Scoreboard not available for this match' });
      return;
    }
    res.json(scoreboard);
  } catch (error) {
    console.error('GET /matches/:matchId/scoreboard failed', error);
    res.status(500).json({ error: 'Failed to load scoreboard' });
  }
});

app.post('/token', async (req, res) => {
  try {
    const { userId, name } = req.body ?? {};

    if (typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const id = userId.trim();
    const displayName = name.trim();
    const token = await upsertGuestUser(id, displayName);

    res.json({
      apiKey: getApiKey(),
      token,
      user: { id, name: displayName },
    });
  } catch (error) {
    console.error('POST /token failed', error);
    res.status(500).json({ error: 'Failed to mint token' });
  }
});

app.post('/channels/match', async (req, res) => {
  try {
    const { matchId, userId } = req.body ?? {};

    if (typeof matchId !== 'string' || !matchId.trim()) {
      res.status(400).json({ error: 'matchId is required' });
      return;
    }
    if (typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const match = await getMatch(matchId.trim());
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    if (!match.channelId) {
      res.status(400).json({
        error: `Match "${match.id}" has no Stream channel id; chat is not available yet`,
      });
      return;
    }

    const channel = await ensureMatchChannel(matchId.trim(), userId.trim());
    res.json(channel);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('has no Stream channel id')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('POST /channels/match failed', error);
    res.status(500).json({ error: 'Failed to ensure match channel' });
  }
});

app.post('/channels/room', async (req, res) => {
  try {
    const { roomId, userId } = req.body ?? {};

    if (typeof roomId !== 'string' || !roomId.trim()) {
      res.status(400).json({ error: 'roomId is required' });
      return;
    }
    if (typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const channel = await ensureRoomChannel(roomId.trim(), userId.trim());
    res.json(channel);
  } catch (error) {
    console.error('POST /channels/room failed', error);
    res.status(500).json({ error: 'Failed to ensure room channel' });
  }
});

app.post('/bot/banter', async (req, res) => {
  try {
    const { matchId, team } = req.body ?? {};

    if (typeof matchId !== 'string' || !matchId.trim()) {
      res.status(400).json({ error: 'matchId is required' });
      return;
    }
    if (typeof team !== 'string' || !team.trim()) {
      res.status(400).json({ error: 'team is required' });
      return;
    }

    const match = await getMatch(matchId.trim());
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    if (!match.channelId) {
      res.status(400).json({
        error: `Match "${match.id}" has no Stream channel id; chat is not available yet`,
      });
      return;
    }

    const result = await postTeamBanter(matchId.trim(), team);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('is not part of match') ||
      message.includes('has no Stream channel id')
    ) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('POST /bot/banter failed', error);
    res.status(500).json({ error: 'Failed to post bot banter' });
  }
});

app.get('/media/giphy', async (req, res) => {
  try {
    if (!process.env.GIPHY_API_KEY?.trim()) {
      res.status(503).json({ error: 'GIPHY_API_KEY is not configured' });
      return;
    }

    const kindRaw = typeof req.query.kind === 'string' ? req.query.kind : 'gif';
    if (kindRaw !== 'gif' && kindRaw !== 'sticker') {
      res.status(400).json({ error: 'kind must be gif or sticker' });
      return;
    }
    const kind = kindRaw as GiphyKind;

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limitRaw =
      typeof req.query.limit === 'string' ? Number(req.query.limit) : 24;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 24;

    const items = await searchGiphy(q, kind, limit);
    res.json({ items });
  } catch (error) {
    console.error('GET /media/giphy failed', error);
    res.status(500).json({ error: 'Failed to search Giphy' });
  }
});

async function main() {
  assertSupabaseConfigured();
  await initSimFromStore();

  app.listen(port, () => {
    console.log(`dugout server listening on http://localhost:${port}`);
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      console.warn(
        'Warning: STREAM_API_KEY / STREAM_API_SECRET are not set. Copy server/.env.example to server/.env before using /token or /channels/match.',
      );
    }
    if (!process.env.GEMINI_API_KEY) {
      console.warn(
        'Warning: GEMINI_API_KEY is not set. Copy server/.env.example to server/.env before using /bot/banter.',
      );
    }
    if (!process.env.ADMIN_API_KEY) {
      console.warn(
        'Warning: ADMIN_API_KEY is not set. /admin/* routes will return 503 until it is configured.',
      );
    }
    if (!process.env.GIPHY_API_KEY) {
      console.warn(
        'Warning: GIPHY_API_KEY is not set. GET /media/giphy will return 503 until it is configured.',
      );
    }
  });
}

main().catch((error) => {
  console.error('Failed to start dugout server', error);
  process.exit(1);
});
