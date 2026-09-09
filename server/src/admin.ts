import { Router, type NextFunction, type Request, type Response } from 'express';

import {
  insertMatchCommentary,
  listMatchCommentary,
} from './commentary-store.js';
import { getMatch } from './matches.js';
import { sendCrowdMessage } from './sim/stream-crowd.js';

export const adminRouter = Router();

function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY?.trim();
  if (!expected) {
    res.status(503).json({ error: 'ADMIN_API_KEY is not configured' });
    return;
  }
  const provided = req.header('x-admin-key')?.trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

adminRouter.use('/admin', requireAdminKey);

adminRouter.post('/admin/chat', async (req, res) => {
  try {
    const { matchId, text, author } = req.body ?? {};

    if (typeof matchId !== 'string' || !matchId.trim()) {
      res.status(400).json({ error: 'matchId is required' });
      return;
    }
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'text is required' });
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

    const displayAuthor =
      typeof author === 'string' && author.trim() ? author.trim() : 'admin';

    const result = await sendCrowdMessage(
      matchId.trim(),
      displayAuthor,
      text.trim(),
    );
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('has no Stream channel id')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('POST /admin/chat failed', error);
    res.status(500).json({ error: 'Failed to send chat' });
  }
});

adminRouter.post('/admin/commentary', async (req, res) => {
  try {
    const { matchId, text, minute, type, scoreAfter } = req.body ?? {};

    if (typeof matchId !== 'string' || !matchId.trim()) {
      res.status(400).json({ error: 'matchId is required' });
      return;
    }
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const match = await getMatch(matchId.trim());
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    const row = await insertMatchCommentary({
      matchId: matchId.trim(),
      text: text.trim(),
      minuteLabel: typeof minute === 'string' ? minute : null,
      type: typeof type === 'string' ? type : null,
      scoreAfter: typeof scoreAfter === 'string' ? scoreAfter : null,
    });
    res.json(row);
  } catch (error) {
    console.error('POST /admin/commentary failed', error);
    res.status(500).json({ error: 'Failed to insert commentary' });
  }
});

adminRouter.get('/admin/commentary', async (req, res) => {
  try {
    const matchId =
      typeof req.query.matchId === 'string' ? req.query.matchId.trim() : '';
    if (!matchId) {
      res.status(400).json({ error: 'matchId query param is required' });
      return;
    }

    const match = await getMatch(matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    const rows = await listMatchCommentary(matchId);
    res.json(rows);
  } catch (error) {
    console.error('GET /admin/commentary failed', error);
    res.status(500).json({ error: 'Failed to load commentary' });
  }
});
