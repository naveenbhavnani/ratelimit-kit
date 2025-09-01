import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { memoryStore } from '../src/store/memory';

describe('memoryStore', () => {
  let store: ReturnType<typeof memoryStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = memoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('load and save', () => {
    it('returns undefined for non-existent key', async () => {
      const result = await store.load('non-existent');
      expect(result).toBeUndefined();
    });

    it('saves and loads state correctly', async () => {
      const state = { count: 5, timestamp: Date.now() };
      await store.save('test-key', state, 5000);
      
      const loaded = await store.load('test-key');
      expect(loaded).toEqual(state);
    });

    it('respects TTL expiration', async () => {
      const state = { count: 3 };
      await store.save('test-key', state, 1000);
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(1001);
      
      const result = await store.load('test-key');
      expect(result).toBeUndefined();
    });

    it('returns data before TTL expires', async () => {
      const state = { count: 7 };
      await store.save('test-key', state, 2000);
      
      // Advance time but not beyond TTL
      vi.advanceTimersByTime(1500);
      
      const result = await store.load('test-key');
      expect(result).toEqual(state);
    });

    it('cleans up expired entries during operations', async () => {
      // Save multiple entries with different TTLs
      await store.save('key1', { data: 1 }, 1000);
      await store.save('key2', { data: 2 }, 2000);
      await store.save('key3', { data: 3 }, 3000);
      
      // Advance time to expire first entry
      vi.advanceTimersByTime(1500);
      
      // Access any key to trigger cleanup
      await store.load('key2');
      
      // Verify expired entry is gone
      const result1 = await store.load('key1');
      const result2 = await store.load('key2');
      const result3 = await store.load('key3');
      
      expect(result1).toBeUndefined();
      expect(result2).toEqual({ data: 2 });
      expect(result3).toEqual({ data: 3 });
    });
  });

  describe('reset', () => {
    it('removes specific key', async () => {
      await store.save('key1', { data: 1 }, 5000);
      await store.save('key2', { data: 2 }, 5000);
      
      await store.reset('key1');
      
      const result1 = await store.load('key1');
      const result2 = await store.load('key2');
      
      expect(result1).toBeUndefined();
      expect(result2).toEqual({ data: 2 });
    });

    it('handles reset of non-existent key gracefully', async () => {
      await expect(store.reset('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles zero TTL', async () => {
      await store.save('test-key', { data: 'test' }, 0);
      const result = await store.load('test-key');
      expect(result).toBeUndefined();
    });

    it('handles negative TTL', async () => {
      await store.save('test-key', { data: 'test' }, -1000);
      const result = await store.load('test-key');
      expect(result).toBeUndefined();
    });

    it('overwrites existing key', async () => {
      await store.save('test-key', { data: 'old' }, 5000);
      await store.save('test-key', { data: 'new' }, 5000);
      
      const result = await store.load('test-key');
      expect(result).toEqual({ data: 'new' });
    });

    it('handles complex state objects', async () => {
      const complexState = {
        nested: { deep: { value: 42 } },
        array: [1, 2, 3],
        date: new Date(),
        func: undefined, // functions are not serializable but shouldn't break
      };
      
      await store.save('complex', complexState, 5000);
      const result = await store.load('complex');
      
      expect(result.nested.deep.value).toBe(42);
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.date).toEqual(complexState.date);
    });
  });
});