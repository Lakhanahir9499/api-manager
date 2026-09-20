import { RateLimitCounter } from '@/models/RateLimit';
import { RateLimitWindow } from '@/models/RateLimit';
import mongoose from 'mongoose';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  window: RateLimitWindow;
}

function getWindowStart(window: RateLimitWindow): Date {
  const now = new Date();
  switch (window) {
    case 'minute':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
    case 'hour':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
}

function getWindowEnd(window: RateLimitWindow, windowStart: Date): Date {
  const end = new Date(windowStart);
  switch (window) {
    case 'minute':
      end.setMinutes(end.getMinutes() + 1);
      break;
    case 'hour':
      end.setHours(end.getHours() + 1);
      break;
    case 'day':
      end.setDate(end.getDate() + 1);
      break;
    case 'month':
      end.setMonth(end.getMonth() + 1);
      break;
  }
  return end;
}

export async function checkAndIncrementRateLimit(
  keyId: string,
  limits: { perMinute: number; daily: number; monthly: number }
): Promise<RateLimitResult[]> {
  const windows: RateLimitWindow[] = ['minute', 'day', 'month'];
  const limitsMap: Record<RateLimitWindow, number> = {
    minute: limits.perMinute,
    day: limits.daily,
    month: limits.monthly,
    hour: 0,
  };

  const results: RateLimitResult[] = [];

  for (const window of windows) {
    const limit = limitsMap[window];
    if (limit <= 0) {
      results.push({
        allowed: true,
        limit: 0,
        remaining: 0,
        resetTime: getWindowEnd(window, getWindowStart(window)),
        window,
      });
      continue;
    }

    const windowStart = getWindowStart(window);
    const windowEnd = getWindowEnd(window, windowStart);

    const counter = await RateLimitCounter.findOneAndUpdate(
      {
        keyId: new mongoose.Types.ObjectId(keyId),
        window,
        windowStart,
      },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const count = counter?.count || 1;
    const remaining = Math.max(0, limit - count);

    results.push({
      allowed: count <= limit,
      limit,
      remaining,
      resetTime: windowEnd,
      window,
    });
  }

  return results;
}

export async function getCurrentUsage(keyId: string): Promise<Record<RateLimitWindow, number>> {
  const windows: RateLimitWindow[] = ['minute', 'day', 'month'];
  const now = new Date();
  const usage: Record<RateLimitWindow, number> = { minute: 0, day: 0, month: 0, hour: 0 };

  for (const window of windows) {
    const windowStart = getWindowStart(window);
    const counter = await RateLimitCounter.findOne({
      keyId: new mongoose.Types.ObjectId(keyId),
      window,
      windowStart,
    }).lean();
    usage[window] = counter?.count || 0;
  }

  return usage;
}

export async function resetRateLimit(keyId: string): Promise<void> {
  await RateLimitCounter.deleteMany({ keyId: new mongoose.Types.ObjectId(keyId) });
}