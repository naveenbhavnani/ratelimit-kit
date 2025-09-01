import { Algorithm } from './types';

/**
 * Token bucket (GCRA-like). capacity tokens max; refillRate tokens per second.
 */
export function tokenBucket(config: { capacity: number; refillRatePerSec: number }): Algorithm {
  const { capacity, refillRatePerSec } = config;
  if (capacity <= 0) throw new Error('capacity must be > 0');
  if (refillRatePerSec <= 0) throw new Error('refillRatePerSec must be > 0');

  const refillPerMs = refillRatePerSec / 1000;

  return {
    name: 'tokenBucket',
    policy: `${capacity};w=1;burst=${capacity}`,
    compute(state: any | undefined, cost: number, now: number) {
      const s: any = state ?? { tokens: capacity, last: now };

      if (now > s.last) {
        const delta = now - s.last;
        const refill = delta * refillPerMs;
        s.tokens = Math.min(capacity, s.tokens + refill);
        s.last = now;
      }

      let allowed = false;
      let retryAfter: number | undefined;

      if (s.tokens >= cost) {
        s.tokens -= cost;
        allowed = true;
      } else {
        const needed = cost - s.tokens;
        retryAfter = refillPerMs > 0 ? Math.ceil(needed / refillPerMs) : undefined;
        allowed = false;
      }

      const remaining = Math.max(0, Math.floor(s.tokens));
      const reset = Math.ceil((now + 1000) / 1000);
      const ttlMs = Math.max(1000, Math.ceil((capacity / refillPerMs) + 1000));

      return {
        state: s,
        result: { allowed, limit: capacity, remaining, reset, retryAfter },
        ttlMs,
      };
    }
  };
}
