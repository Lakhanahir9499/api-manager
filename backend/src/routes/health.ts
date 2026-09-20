import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: states[dbState] || 'unknown',
    uptime: process.uptime(),
  });
});

router.get('/ready', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, database: 'not connected' });
  }
});

// Ping endpoint for keep-alive (external cron)
router.get('/ping', (_req: Request, res: Response) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

export default router;