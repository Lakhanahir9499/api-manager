import { Request, Response, NextFunction } from 'express';
import { checkAndIncrementRateLimit } from '@/services/rateLimitService';

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.apiKey;
  if (!apiKey) {
    next();
    return;
  }

  checkAndIncrementRateLimit(apiKey.keyId, apiKey.rateLimit)
    .then((results) => {
      const minuteResult = results.find((r) => r.window === 'minute');
      const dailyResult = results.find((r) => r.window === 'day');
      const monthlyResult = results.find((r) => r.window === 'month');

      const blocked = results.some((r) => !r.allowed);
      if (blocked) {
        const retryAfter = Math.min(
          ...results.filter((r) => !r.allowed).map((r) => Math.ceil((r.resetTime.getTime() - Date.now()) / 1000))
        );
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          limits: {
            minute: { limit: minuteResult?.limit, remaining: minuteResult?.remaining, reset: minuteResult?.resetTime },
            daily: { limit: dailyResult?.limit, remaining: dailyResult?.remaining, reset: dailyResult?.resetTime },
            monthly: { limit: monthlyResult?.limit, remaining: monthlyResult?.remaining, reset: monthlyResult?.resetTime },
          },
        });
        return;
      }

      res.set({
        'X-RateLimit-Limit-Minute': String(minuteResult?.limit || 0),
        'X-RateLimit-Remaining-Minute': String(minuteResult?.remaining || 0),
        'X-RateLimit-Reset-Minute': String(Math.ceil((minuteResult?.resetTime.getTime() || 0) / 1000)),
        'X-RateLimit-Limit-Daily': String(dailyResult?.limit || 0),
        'X-RateLimit-Remaining-Daily': String(dailyResult?.remaining || 0),
        'X-RateLimit-Reset-Daily': String(Math.ceil((dailyResult?.resetTime.getTime() || 0) / 1000)),
        'X-RateLimit-Limit-Monthly': String(monthlyResult?.limit || 0),
        'X-RateLimit-Remaining-Monthly': String(monthlyResult?.remaining || 0),
        'X-RateLimit-Reset-Monthly': String(Math.ceil((monthlyResult?.resetTime.getTime() || 0) / 1000)),
      });

      next();
    })
    .catch((err) => {
      console.error('Rate limiter error:', err);
      next();
    });
}