import { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  scope: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getClientKey(req: Request): string {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.length > 0) {
      return `token:${token}`;
    }
  }

  return `ip:${req.ip || 'unknown'}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const store = stores.get(options.scope) ?? new Map<string, RateLimitEntry>();
  stores.set(options.scope, store);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
    const now = Date.now();
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (current.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSeconds
      });
    }

    current.count += 1;
    next();
  };
}

export function resetRateLimitersForTest(): void {
  for (const store of stores.values()) {
    store.clear();
  }
}
