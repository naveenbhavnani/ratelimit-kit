import { describe, it, expect } from 'vitest';
import { Ratelimit } from '../src/core/ratelimit';
import { memoryStore } from '../src/store/memory';
import { slidingWindow } from '../src/core/slidingWindow';
import { tokenBucket } from '../src/core/tokenBucket';

describe('Ratelimit', () => {
  describe('constructor and options', () => {
    it('creates instance with required options', () => {
      const limiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 5, windowMs: 1000 }),
        store: memoryStore(),
        key: () => 'test'
      });
      expect(limiter).toBeInstanceOf(Ratelimit);
    });

    it('uses default namespace when not provided', async () => {
      const store = memoryStore();
      const spy = { calls: [] as any[] };
      const originalSave = store.save;
      store.save = async (key, state, ttl) => {
        spy.calls.push({ key, state, ttl });
        return originalSave.call(store, key, state, ttl);
      };

      const limiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 5, windowMs: 1000 }),
        store,
        key: () => 'test'
      });

      await limiter.limit({});
      expect(spy.calls[0].key).toBe('default:test');
    });

    it('uses custom namespace when provided', async () => {
      const store = memoryStore();
      const spy = { calls: [] as any[] };
      const originalSave = store.save;
      store.save = async (key, state, ttl) => {
        spy.calls.push({ key, state, ttl });
        return originalSave.call(store, key, state, ttl);
      };

      const limiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 5, windowMs: 1000 }),
        store,
        key: () => 'test',
        namespace: 'custom'
      });

      await limiter.limit({});
      expect(spy.calls[0].key).toBe('custom:test');
    });

    it('uses default cost function when not provided', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const result = await limiter.limit({});
      expect(result.remaining).toBe(4); // 5 - 1 (default cost)
    });

    it('uses custom cost function when provided', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test',
        cost: () => 3
      });

      const result = await limiter.limit({});
      expect(result.remaining).toBe(7); // 10 - 3 (custom cost)
    });
  });

  describe('limit method', () => {
    it('returns correct result structure', async () => {
      const limiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 5, windowMs: 1000 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const result = await limiter.limit({});
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('reset');
      expect(result).toHaveProperty('now');
      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.reset).toBe('number');
      expect(typeof result.now).toBe('number');
    });

    it('handles negative cost by treating as 0', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test',
        cost: () => -5
      });

      const result = await limiter.limit({});
      // Math.max(0, Math.floor(-5) || 1) = Math.max(0, -5) = 0, so no tokens consumed
      expect(result.remaining).toBe(10);
    });

    it('handles fractional cost by flooring', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test',
        cost: () => 2.7
      });

      const result = await limiter.limit({});
      expect(result.remaining).toBe(8); // 10 - 2 (2.7 floored to 2)
    });

    it('handles NaN cost by treating as 1', async () => {
      const limiter = new Ratelimit({
        algorithm: tokenBucket({ capacity: 10, refillRatePerSec: 1 }),
        store: memoryStore(),
        key: () => 'test',
        cost: () => NaN
      });

      const result = await limiter.limit({});
      expect(result.remaining).toBe(9); // 10 - 1 (NaN treated as 1)
    });

    it('works with different key functions', async () => {
      const store = memoryStore();
      const limiter1 = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store,
        key: (ctx) => `user:${ctx.userId}`
      });

      const limiter2 = new Ratelimit({
        algorithm: tokenBucket({ capacity: 5, refillRatePerSec: 1 }),
        store,
        key: (ctx) => `ip:${ctx.ip}`
      });

      await limiter1.limit({ userId: 'user1' });
      await limiter2.limit({ ip: '127.0.0.1' });

      const result1 = await limiter1.limit({ userId: 'user1' });
      const result2 = await limiter2.limit({ ip: '127.0.0.1' });

      expect(result1.remaining).toBe(3); // Second call for user1
      expect(result2.remaining).toBe(3); // Second call for ip
    });
  });
});