import { Router, Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '@/middleware/apiKeyAuth';
import { ipFilter } from '@/middleware/ipFilter';
import { rateLimiter } from '@/middleware/rateLimiter';
import { proxyToUpstream, getUpstreamById } from '@/services/proxyService';
import { incrementUsage } from '@/services/keyService';

const router = Router();

router.use(apiKeyAuth);
router.use(ipFilter);
router.use(rateLimiter);

router.all('/*', async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.apiKey!;
  const upstream = await getUpstreamById(apiKey.upstreamApi);
  if (!upstream) {
    return res.status(500).json({ error: 'Upstream API not configured', code: 'UPSTREAM_NOT_FOUND' });
  }

  const path = req.params[0] || '';
  const query: Record<string, string> = {};
  const rawQuery = req.query as Record<string, string | string[] | undefined>;
  for (const [key, value] of Object.entries(rawQuery)) {
    if (Array.isArray(value)) {
      query[key] = value[0] || '';
    } else if (typeof value === 'string') {
      query[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      query[key] = String(value);
    }
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value[0];
  }
  delete headers['x-api-key'];
  delete headers['host'];

  try {
    const response = await proxyToUpstream(upstream, {
      method: req.method,
      path,
      query,
      headers,
      body: req.body,
    });

    await incrementUsage(apiKey.keyId);

    for (const [key, value] of Object.entries(response.headers)) {
      res.set(key, value);
    }
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Upstream request timeout') {
      return res.status(504).json({ error: 'Upstream timeout', code: 'UPSTREAM_TIMEOUT' });
    }
    console.error('Proxy error:', error);
    return res.status(502).json({ error: 'Bad gateway', code: 'UPSTREAM_ERROR' });
  }
});

export default router;