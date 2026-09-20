import { Request, Response, NextFunction } from 'express';
import { ApiKey } from '@/models/ApiKey';

export interface ApiKeyData {
  keyId: string;
  keyPrefix: string;
  name: string;
  upstreamApi: string;
  rateLimit: {
    perMinute: number;
    daily: number;
    monthly: number;
  };
  ipWhitelist: string[];
  ipBlacklist: string[];
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyData;
    }
  }
}

async function verifyKeyHash(key: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(key, hash);
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['x-api-key'] as string | undefined;
  if (!authHeader) {
    res.status(401).json({ error: 'API key required', code: 'MISSING_API_KEY' });
    return;
  }

  const key = authHeader.trim();
  if (!key.startsWith('ak_live_') && !key.startsWith('ak_test_')) {
    res.status(401).json({ error: 'Invalid API key format', code: 'INVALID_KEY_FORMAT' });
    return;
  }

  const prefix = key.substring(0, 8);
  const apiKey = await ApiKey.findOne({ keyPrefix: prefix, status: { $ne: 'deleted' } }).select('+keyHash').lean();

  if (!apiKey) {
    res.status(401).json({ error: 'Invalid API key', code: 'INVALID_KEY' });
    return;
  }

  const isValid = await verifyKeyHash(key, apiKey.keyHash);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid API key', code: 'INVALID_KEY' });
    return;
  }

  if (apiKey.status !== 'active') {
    res.status(403).json({ error: 'API key is suspended', code: 'KEY_SUSPENDED' });
    return;
  }

  req.apiKey = {
    keyId: apiKey._id.toString(),
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    upstreamApi: apiKey.upstreamApi.toString(),
    rateLimit: apiKey.rateLimit,
    ipWhitelist: apiKey.ipWhitelist,
    ipBlacklist: apiKey.ipBlacklist,
  };

  next();
}