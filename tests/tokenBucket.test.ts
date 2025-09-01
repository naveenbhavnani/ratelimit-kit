import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ratelimit } from '../src/core/ratelimit';
import { memoryStore } from '../src/store/memory';
import { tokenBucket } from '../src/core/tokenBucket';

describe('tokenBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validation', () => {
    it('throws error for non-positive capacity', () => {
      expect(() => tokenBucket({ capacity: 0, refillRatePerSec: 1 })).toThrow('capacity must be > 0');
      expect(() => tokenBucket({ capacity: -5, refillRatePerSec: 1 })).toThrow('capacity must be > 0');
    });

    it('throws error for non-positive refillRatePerSec', () => {
      expect(() => tokenBucket({ capacity: 10, refillRatePerSec: 0 })).toThrow('refillRatePerSec must be > 0');
      expect(() => tokenBucket({ capacity: 10, refillRatePerSec: -1 })).toThrow('refillRatePerSec must be > 0');
    });
  });

  describe('algorithm properties', () => {
    it('has correct name and policy', () => {
      const alg = tokenBucket({ capacity: 50, refillRatePerSec: 10 });
      expect(alg.name).toBe('tokenBucket');
      expect(alg.policy).toBe('50;w=1;burst=50');
    });
  });

  describe('basic functionality', () => {
    it('allows requests up to capacity', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 3, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const r1 = await limiter.limit({});
      const r2 = await limiter.limit({});
      const r3 = await limiter.limit({});
      const r4 = await limiter.limit({});

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);
      expect(r4.allowed).toBe(false);
    });

    it('returns correct remaining count', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const r1 = await limiter.limit({});
      const r2 = await limiter.limit({});
      
      expect(r1.remaining).toBe(9); // 10 - 1
      expect(r2.remaining).toBe(8); // 10 - 2
    });

    it('calculates retryAfter when tokens insufficient', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 1, refillRatePerSec: 2 }), // 2 tokens per second = 500ms per token
        store: memoryStore(),
        key: () => 'test',
        cost: () => 2 // Need 2 tokens but only have 1
      });

      const result = await limiter.limit({});
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(500); // Need 1 more token, at 2/sec = 500ms
    });
  });

  describe('token refill mechanism', () => {
    it('refills over time', async () => {
      const start = Date.now();
      vi.setSystemTime(start);

      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 2, refillRatePerSec: 10 }), // 10 tokens per second
        store: memoryStore(),
        key: () => 'test'
      });

      const r1 = await limiter.limit({});
      const r2 = await limiter.limit({});
      const r3 = await limiter.limit({});
      
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(false);

      // Advance time by 150ms (should add 1.5 tokens)
      vi.setSystemTime(start + 150);
      
      const r4 = await limiter.limit({});
      expect(r4.allowed).toBe(true);
    });

    it('caps refill at capacity', async () => {
      const start = Date.now();
      vi.setSystemTime(start);

      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 10 }),
        store: memoryStore(),
        key: () => 'test'
      });

      // Use 2 tokens
      await limiter.limit({});
      await limiter.limit({});
      
      // Wait a very long time (should refill to capacity, not beyond)
      vi.setSystemTime(start + 10000); // 10 seconds
      
      const result = await limiter.limit({});
      expect(result.remaining).toBe(4); // 5 - 1, not more
    });

    it('handles fractional token accumulation', async () => {
      const start = Date.now();
      vi.setSystemTime(start);

      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 3 }), // 3 tokens per second
        store: memoryStore(),
        key: () => 'test'
      });

      // Use all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.limit({});
      }
      
      // Wait 500ms (should add 1.5 tokens, but only 1 usable)
      vi.setSystemTime(start + 500);
      
      const r1 = await limiter.limit({});
      const r2 = await limiter.limit({});
      
      expect(r1.allowed).toBe(true); // Uses the 1 full token
      expect(r2.allowed).toBe(false); // 0.5 token remaining, insufficient
    });
  });

  describe('cost handling', () => {
    it('applies cost correctly', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test',
        cost: () => 3
      });

      const r1 = await limiter.limit({});
      const r2 = await limiter.limit({});
      
      expect(r1.remaining).toBe(7); // 10 - 3
      expect(r2.remaining).toBe(4); // 10 - 3 - 3
    });

    it('denies requests when cost exceeds available tokens', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test',
        cost: () => 8 // More than capacity
      });

      const result = await limiter.limit({});
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(5); // Tokens not consumed on denial
    });
  });

  describe('reset calculation', () => {
    it('calculates reset time correctly', async () => {
      const start = 1000000000000; // Fixed timestamp
      vi.setSystemTime(start);
      
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test'
      });
      
      const result = await limiter.limit({});
      
      // Reset should be approximately start + 1000ms, rounded to seconds
      const expectedReset = Math.ceil((start + 1000) / 1000);
      expect(result.reset).toBe(expectedReset);
    });
  });

  describe('edge cases', () => {
    it('handles undefined state correctly', async () => {
      const start = Date.now();
      vi.setSystemTime(start);
      
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'new-key'
      });

      const result = await limiter.limit({});
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Started with full capacity
    });

    it('handles time going backwards gracefully', async () => {
      const start = Date.now();
      vi.setSystemTime(start);
      
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test'
      });

      // Use some tokens
      await limiter.limit({});
      await limiter.limit({});
      
      // Go back in time
      vi.setSystemTime(start - 1000);
      
      const result = await limiter.limit({});
      
      // Should not refill when time goes backwards
      expect(result.remaining).toBe(2); // 5 - 1 - 1 - 1 = 2
    });

    it('handles zero refill rate edge case in retryAfter', async () => {
      const alg = tokenBucket({ capacity: 5, refillRatePerSec: 0.001 }); // Very slow refill
      
      const state = { tokens: 1, last: Date.now() };
      const result = alg.compute(state, 3, Date.now()); // Need 3, have 1
      
      expect(result.result.allowed).toBe(false);
      expect(typeof result.result.retryAfter).toBe('number');
      expect(result.result.retryAfter).toBeGreaterThan(0);
    });

    it('floors remaining tokens to integer', async () => {
      const start = Date.now();
      vi.setSystemTime(start);
      
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 3 }),
        store: memoryStore(),
        key: () => 'test'
      });

      // Use 1 token, then wait to accumulate fractional tokens
      await limiter.limit({});
      
      vi.setSystemTime(start + 100); // Should add 0.3 tokens
      
      const result = await limiter.limit({});
      
      // Should floor the remaining count
      expect(Number.isInteger(result.remaining)).toBe(true);
    });
  });
});
