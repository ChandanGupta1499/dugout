import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import { postTeamBanter } from './bot.js';
import { getMatch, listMatches } from './matches.js';
import { getMatchScoreboard } from './scoreboard.js';
import { simRouter } from './sim/index.js';
import {
  ensureMatchChannel,
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
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/matches', (_req, res) => {
  res.json(listMatches());
});

app.get('/matches/:matchId', (req, res) => {
  const match = getMatch(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  res.json(match);
});

app.get('/matches/:matchId/scoreboard', (req, res) => {
  const match = getMatch(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  const scoreboard = getMatchScoreboard(req.params.matchId);
  if (!scoreboard) {
    res.status(404).json({ error: 'Scoreboard not available for this match' });
    return;
  }
  res.json(scoreboard);
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

    if (!getMatch(matchId.trim())) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    const channel = await ensureMatchChannel(matchId.trim(), userId.trim());
    res.json(channel);
  } catch (error) {
    console.error('POST /channels/match failed', error);
    res.status(500).json({ error: 'Failed to ensure match channel' });
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

    if (!getMatch(matchId.trim())) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    const result = await postTeamBanter(matchId.trim(), team);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('is not part of match')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('POST /bot/banter failed', error);
    res.status(500).json({ error: 'Failed to post bot banter' });
  }
});

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
});
