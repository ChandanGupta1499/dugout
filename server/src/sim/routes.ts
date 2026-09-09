import { Router } from 'express';

import {
  getSessionStatus,
  pauseSim,
  resumeSim,
  setSimSpeed,
  startSim,
  stopSim,
} from './scheduler.js';

export const simRouter = Router();

simRouter.get('/sim/status', (_req, res) => {
  res.json(getSessionStatus());
});

simRouter.post('/sim/start', (req, res) => {
  try {
    const { matchId, speed, kickoffOffsetMs } = req.body ?? {};
    const status = startSim({
      matchId: typeof matchId === 'string' ? matchId : undefined,
      speed: speed != null ? Number(speed) : undefined,
      kickoffOffsetMs:
        kickoffOffsetMs != null ? Number(kickoffOffsetMs) : undefined,
    });
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start sim';
    res.status(400).json({ error: message });
  }
});

simRouter.post('/sim/pause', (_req, res) => {
  try {
    res.json(pauseSim());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to pause';
    res.status(400).json({ error: message });
  }
});

simRouter.post('/sim/resume', (_req, res) => {
  try {
    res.json(resumeSim());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resume';
    res.status(400).json({ error: message });
  }
});

simRouter.post('/sim/speed', (req, res) => {
  try {
    const speed = Number(req.body?.speed);
    res.json(setSimSpeed(speed));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set speed';
    res.status(400).json({ error: message });
  }
});

simRouter.post('/sim/stop', (_req, res) => {
  res.json(stopSim());
});
