import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { adminAuth } from '@/middleware/auth';
import { verifyAdminPassword, generateAdminToken, generateRefreshToken } from '@/middleware/auth';
import { createKey, getKeys, getKeyById, updateKey, suspendKey, unsuspendKey, deleteKey, getKeyStats } from '@/services/keyService';
import { UpstreamApi } from '@/models/UpstreamApi';
import { ApiKey } from '@/models/ApiKey';
import { getActiveUpstreams } from '@/services/proxyService';
import { RateLimitCounter } from '@/models/RateLimit';
import { env } from '@/config/env';
import jwt from 'jsonwebtoken';

const router = Router();

const loginSchema = z.object({ password: z.string().min(1) });
const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  upstreamApi: z.string().min(1),
  rateLimit: z.object({ perMinute: z.number().int().min(0).default(60), daily: z.number().int().min(0).default(1000), monthly: z.number().int().min(0).default(10000) }).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  ipBlacklist: z.array(z.string()).optional(),
});
const updateKeySchema = createKeySchema.partial().extend({ status: z.enum(['active', 'suspended', 'deleted']).optional() });
const createUpstreamSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  pathPattern: z.string().min(1),
  queryParams: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  placeholders: z.array(z.string()).optional(),
  timeout: z.number().int().min(100).max(60000).optional(),
});
const updateUpstreamSchema = createUpstreamSchema.partial();

router.post('/login', async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const valid = await verifyAdminPassword(result.data.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const accessToken = generateAdminToken();
  const refreshToken = generateRefreshToken();

  res.cookie('admin_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('admin_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('admin_token');
  res.clearCookie('admin_refresh');
  res.json({ success: true });
});

router.get('/me', adminAuth, (_req: Request, res: Response) => {
  res.json({ isAdmin: true });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.admin_refresh;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as { isAdmin: boolean; type?: string };
    if (!decoded.isAdmin || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = generateAdminToken();
    res.cookie('admin_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/stats', adminAuth, async (_req: Request, res: Response) => {
  const [totalKeys, activeKeys, suspendedKeys, totalUpstreams, todayRequests] = await Promise.all([
    ApiKey.countDocuments({ status: { $ne: 'deleted' } }),
    ApiKey.countDocuments({ status: 'active' }),
    ApiKey.countDocuments({ status: 'suspended' }),
    UpstreamApi.countDocuments({ active: true }),
    getTodayRequests(),
  ]);

  const topKeys = await ApiKey.find({ status: { $ne: 'deleted' } })
    .sort({ usageCount: -1 })
    .limit(5)
    .select('name usageCount lastUsedAt keyPrefix')
    .lean();

  res.json({
    totalKeys,
    activeKeys,
    suspendedKeys,
    totalUpstreams,
    todayRequests,
    topKeys,
  });
});

async function getTodayRequests(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const counters = await RateLimitCounter.aggregate([
    { $match: { window: 'day', windowStart: startOfDay } },
    { $group: { _id: null, total: { $sum: '$count' } } },
  ]);
  return counters[0]?.total || 0;
}

router.get('/keys', adminAuth, async (req: Request, res: Response) => {
  const status = req.query.status as string;
  const upstreamApi = req.query.upstreamApi as string;
  const keys = await getKeys({ status: status as any, upstreamApi });
  res.json(keys);
});

router.post('/keys', adminAuth, async (req: Request, res: Response) => {
  const result = createKeySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  try {
    const { key, apiKey } = await createKey(result.data);
    res.status(201).json({ key, apiKey: { ...apiKey, keyHash: undefined } });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create key' });
  }
});

router.get('/keys/:id', adminAuth, async (req: Request, res: Response) => {
  const key = await getKeyById(req.params.id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json({ ...key, keyHash: undefined });
});

router.patch('/keys/:id', adminAuth, async (req: Request, res: Response) => {
  const result = updateKeySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const key = await updateKey(req.params.id, result.data);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json({ ...key, keyHash: undefined });
});

router.post('/keys/:id/suspend', adminAuth, async (req: Request, res: Response) => {
  const key = await suspendKey(req.params.id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json({ ...key, keyHash: undefined });
});

router.post('/keys/:id/unsuspend', adminAuth, async (req: Request, res: Response) => {
  const key = await unsuspendKey(req.params.id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json({ ...key, keyHash: undefined });
});

router.delete('/keys/:id', adminAuth, async (req: Request, res: Response) => {
  const deleted = await deleteKey(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Key not found' });
  res.json({ success: true });
});

router.get('/keys/:id/stats', adminAuth, async (req: Request, res: Response) => {
  const stats = await getKeyStats(req.params.id);
  if (!stats) return res.status(404).json({ error: 'Key not found' });
  res.json(stats);
});

router.get('/upstreams', adminAuth, async (_req: Request, res: Response) => {
  const upstreams = await UpstreamApi.find().sort({ createdAt: -1 }).lean();
  res.json(upstreams);
});

router.post('/upstreams', adminAuth, async (req: Request, res: Response) => {
  const result = createUpstreamSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  try {
    const upstream = await UpstreamApi.create(result.data);
    res.status(201).json(upstream);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Upstream with this name already exists' });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create upstream' });
  }
});

router.get('/upstreams/:id', adminAuth, async (req: Request, res: Response) => {
  const upstream = await UpstreamApi.findById(req.params.id).lean();
  if (!upstream) return res.status(404).json({ error: 'Upstream not found' });
  res.json(upstream);
});

router.patch('/upstreams/:id', adminAuth, async (req: Request, res: Response) => {
  const result = updateUpstreamSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() });
  }

  const upstream = await UpstreamApi.findByIdAndUpdate(req.params.id, result.data, { new: true }).lean();
  if (!upstream) return res.status(404).json({ error: 'Upstream not found' });
  res.json(upstream);
});

router.delete('/upstreams/:id', adminAuth, async (req: Request, res: Response) => {
  const upstream = await UpstreamApi.findByIdAndDelete(req.params.id);
  if (!upstream) return res.status(404).json({ error: 'Upstream not found' });
  res.json({ success: true });
});

router.get('/upstreams/active', adminAuth, async (_req: Request, res: Response) => {
  const upstreams = await getActiveUpstreams();
  res.json(upstreams);
});

export default router;