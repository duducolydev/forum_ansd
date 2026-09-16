import IORedis from "ioredis";

/**
 * Limitation de débit (brief §7) — utilisée par l'inscription (5/min/IP), le
 * lien magique (3/min/email) et la vérification de badge (30/min/IP).
 *
 * Redis quand il est disponible (compteur partagé entre instances), sinon
 * repli en mémoire du processus : suffisant en développement, mais à ne pas
 * considérer comme une protection en production multi-instances.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

declare global {
  var __rateLimitRedis: IORedis | undefined;
  var __rateLimitMemory: Map<string, { count: number; resetAt: number }> | undefined;
}

function getRedis(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  globalThis.__rateLimitRedis ??= new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  return globalThis.__rateLimitRedis;
}

function getMemoryStore(): Map<string, { count: number; resetAt: number }> {
  globalThis.__rateLimitMemory ??= new Map();
  return globalThis.__rateLimitMemory;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();

  if (redis) {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  const store = getMemoryStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}
