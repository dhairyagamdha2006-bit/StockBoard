import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * This is intentionally dependency-free and works well for a single Vercel
 * instance / local dev. For multi-region production scale, swap the Map for
 * Upstash Redis (`@upstash/ratelimit`) — the call sites stay identical.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically evict expired buckets so the Map doesn't grow unbounded.
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
  resetAt: number;
  limit: number;
}

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

/** Derives a stable client identifier from a request (user id preferred, else IP). */
export function clientKey(req: NextRequest, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "anon";
  return `ip:${ip}`;
}

/**
 * Convenience: enforce a limit and return a 429 response if exceeded,
 * otherwise null. Adds standard RateLimit headers.
 */
export function enforceRateLimit(
  req: NextRequest,
  opts: { scope: string; limit: number; windowMs: number; userId?: string | null }
): NextResponse | null {
  const key = `${opts.scope}:${clientKey(req, opts.userId)}`;
  const result = rateLimit(key, opts.limit, opts.windowMs);
  if (result.ok) return null;

  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
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
