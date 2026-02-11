import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  /** Optional key prefix to isolate rate-limit budgets per route */
  key?: string;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 5;

const store = new Map<string, RateLimitEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs * 2) {
        store.delete(key);
      }
    }
  }, windowMs);
  cleanupInterval.unref();
}

export function buildRateLimiter(config: RateLimitConfig = {}) {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = config.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const keyPrefix = config.key ?? '';

  ensureCleanup(windowMs);

  return async function rateLimitHandler(request: FastifyRequest, reply: FastifyReply) {
    const ip = request.ip;
    const storeKey = keyPrefix ? `${keyPrefix}:${ip}` : ip;
    const now = Date.now();

    const entry = store.get(storeKey);

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(storeKey, { count: 1, windowStart: now });
      return;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      request.log.warn({ ip }, 'Rate limit exceeded');
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      });
    }
  };
}

export function resetRateLimitStore() {
  store.clear();
}
