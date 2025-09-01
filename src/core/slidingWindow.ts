import { Algorithm } from './types';

/**
 * Sliding window algorithm (2-window approximation).
 */
export function slidingWindow(config: { limit: number; windowMs: number }): Algorithm {
  const { limit, windowMs } = config;
  if (limit <= 0) throw new Error('limit must be > 0');
  if (windowMs <= 0) throw new Error('windowMs must be > 0');

  return {
    name: 'sliding',
    policy: `${limit};w=${Math.round(windowMs/1000)}`,
    compute(state: any | undefined, cost: number, now: number) {
      const curWindowStart = Math.floor(now / windowMs) * windowMs;
      const prevWindowStart = curWindowStart - windowMs;

      const s = state ?? {
        windowStart: curWindowStart,
        count: 0,
        prevStart: prevWindowStart,
        prevCount: 0,
      };

      if (s.windowStart !== curWindowStart) {
        const contiguous = s.windowStart === prevWindowStart;
        s.prevStart = contiguous ? s.windowStart : prevWindowStart;
        s.prevCount = contiguous ? s.count : 0;
        s.windowStart = curWindowStart;
        s.count = 0;
      }

      s.count += cost;

      const overlapMs = windowMs - (now - curWindowStart);
      const weight = overlapMs / windowMs;
      const effective = s.count + (s.prevStart === prevWindowStart ? s.prevCount * weight : 0);

      const allowed = effective <= limit;
      const remaining = Math.max(0, Math.floor(limit - effective));
      const reset = Math.ceil((s.windowStart + windowMs) / 1000);

      let retryAfter: number | undefined;
      if (!allowed) {
        retryAfter = (s.windowStart + windowMs) - now;
        if (retryAfter < 0) retryAfter = 0;
      }

      const ttlMs = Math.max(1000, (s.windowStart + 2 * windowMs) - now);

      return {
        state: s,
        result: { allowed, limit, remaining, reset, retryAfter },
        ttlMs,
      };
    }
  };
}
