import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/utils/rateLimit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test-${Math.random()}`;
    const limit = 3;
    const window = 60_000;

    const a = rateLimit(key, limit, window);
    const b = rateLimit(key, limit, window);
    const c = rateLimit(key, limit, window);
    const d = rateLimit(key, limit, window);

    expect(a.ok).toBe(true);
    expect(a.remaining).toBe(2);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
    expect(c.remaining).toBe(0);
    expect(d.ok).toBe(false);
    expect(d.remaining).toBe(0);
  });

  it("keeps separate counters per key", () => {
    const k1 = `k1-${Math.random()}`;
    const k2 = `k2-${Math.random()}`;
    expect(rateLimit(k1, 1, 60_000).ok).toBe(true);
    expect(rateLimit(k1, 1, 60_000).ok).toBe(false);
    expect(rateLimit(k2, 1, 60_000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    const key = `reset-${Math.random()}`;
    expect(rateLimit(key, 1, -1).ok).toBe(true); // window already expired
    // resetAt <= now on next call -> new window
    expect(rateLimit(key, 1, 60_000).ok).toBe(true);
  });
});
