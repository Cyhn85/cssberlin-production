/**
 * Rate Limiting for cssberlin.de
 *
 * Uses Upstash Redis (free: 10K commands/day)
 * Falls back to in-memory Map when Redis is not configured
 *
 * Tiers:
 * - AUTH: 5 req/min per IP (login, register)
 * - API: 30 req/min per user (general API)
 * - UPLOAD: 10 req/min per user (file uploads)
 * - AI: 10 req/hour per user (AI features)
 */

// ── In-Memory Fallback (dev / no Redis) ──

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ── Rate Limit Tiers ──

export const RATE_LIMIT_TIERS = {
  AUTH: { maxRequests: 5, windowMs: 60 * 1000 },        // 5/min
  API: { maxRequests: 30, windowMs: 60 * 1000 },        // 30/min
  UPLOAD: { maxRequests: 10, windowMs: 60 * 1000 },     // 10/min
  AI: { maxRequests: 10, windowMs: 60 * 60 * 1000 },    // 10/hour
  OFFER: { maxRequests: 25, windowMs: 24 * 60 * 60 * 1000 }, // 25/day (Vinted rule)
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

// ── Result Type ──

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
}

// ── Main Function ──

export async function rateLimit(
  identifier: string,
  tier: RateLimitTier = 'API'
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_TIERS[tier];
  const key = `rl:${tier}:${identifier}`;

  // Try Upstash Redis first
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await rateLimitWithRedis(key, config);
    } catch (error) {
      console.warn('Redis rate limit failed, falling back to memory:', error);
    }
  }

  // Fallback to in-memory
  return rateLimitWithMemory(key, config);
}

// ── Redis Implementation ──

async function rateLimitWithRedis(
  key: string,
  config: { maxRequests: number; windowMs: number }
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const windowSec = Math.ceil(config.windowMs / 1000);

  // INCR + EXPIRE pattern (atomic with pipeline)
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, windowSec],
      ['TTL', key],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Redis error: ${response.status}`);
  }

  const results = await response.json();
  const count = results[0]?.result ?? 1;
  const ttl = results[2]?.result ?? windowSec;

  const remaining = Math.max(0, config.maxRequests - count);
  const reset = Date.now() + ttl * 1000;

  return {
    success: count <= config.maxRequests,
    limit: config.maxRequests,
    remaining,
    reset,
  };
}

// ── Memory Implementation ──

function rateLimitWithMemory(
  key: string,
  config: { maxRequests: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: now + config.windowMs,
    };
  }

  // Existing window
  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    success: entry.count <= config.maxRequests,
    limit: config.maxRequests,
    remaining,
    reset: entry.resetAt,
  };
}

// ── Helper: Get identifier from request ──

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return '127.0.0.1';
}
