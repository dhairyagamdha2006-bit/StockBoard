import { NextRequest, NextResponse } from "next/server";
import { getUpstashConfig } from "@/lib/env";

/**
 * Rate limiting with a production backend and a dev fallback.
 *
 * - If UPSTASH_REDIS_REST_URL/TOKEN are set, we use Upstash Redis (sliding
 *   window) so limits hold across serverless instances and regions.
 * - Otherwise we fall back to an in-memory fixed-window limiter, which is fine
 *   for local dev / single-instance but resets per instance.
 *
 * The Upstash path is async; the in-memory path is sync. `enforceRateLimit` is
 * async and handles both transparently, so call sites just `await` it.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number; // epoch ms
  limit: number;
}

/** Synchronous in-memory limiter (also exported for tests). */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, limit };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return { ok, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt, limit };
}

// ---------------------------------------------------------------------------
// Upstash Redis backend (lazy-initialized, optional).
// ---------------------------------------------------------------------------
type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number; limit: number }>;
};
const upstashLimiters = new Map<string, UpstashLimiter>();
let upstashUnavailable = false;

async function getUpstashLimiter(
  scope: string,
  limit: number,
  windowMs: number
): Promise<UpstashLimiter | null> {
  if (upstashUnavailable) return null;
  const cfg = getUpstashConfig();
  if (!cfg) return null;

  const cacheKey = `${scope}:${limit}:${windowMs}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;

  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit"),
      import("@upstash/redis"),
    ]);
    const redis = new Redis({ url: cfg.url, token: cfg.token });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `stockboard:${scope}`,
      analytics: false,
    });
    upstashLimiters.set(cacheKey, limiter);
    return limiter;
  } catch {
    // If the package or network is unavailable, never block requests — fall back.
    upstashUnavailable = true;
    return null;
  }
}

/** Derive a stable client identifier from a request (user id preferred, else IP). */
export function clientKey(req: NextRequest, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "anon";
  return `ip:${ip}`;
}

function tooMany(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "RateLimit-Limit": String(result.limit),
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(retryAfter),
      },
    }
  );
}

/**
 * Enforce a limit and return a 429 response if exceeded, otherwise null.
 * Uses Upstash when configured, in-memory otherwise.
 */
export async function enforceRateLimit(
  req: NextRequest,
  opts: { scope: string; limit: number; windowMs: number; userId?: string | null }
): Promise<NextResponse | null> {
  const id = clientKey(req, opts.userId);

  const upstash = await getUpstashLimiter(opts.scope, opts.limit, opts.windowMs);
  if (upstash) {
    const r = await upstash.limit(id);
    if (r.success) return null;
    return tooMany({ ok: false, remaining: r.remaining, resetAt: r.reset, limit: r.limit });
  }

  const result = rateLimit(`${opts.scope}:${id}`, opts.limit, opts.windowMs);
  if (result.ok) return null;
  return tooMany(result);
}
