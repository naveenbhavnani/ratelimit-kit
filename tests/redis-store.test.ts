import { describe, it, expect, vi } from 'vitest';
import { redisStore, type RedisLike } from '../src/store/redis';

describe('redisStore', () => {
  describe('store operations', () => {
    it('creates store instance', () => {
      const mockClient: RedisLike = {
        eval: vi.fn()
      };
      
      const store = redisStore(mockClient);
      
      expect(store).toHaveProperty('load');
      expect(store).toHaveProperty('save');
      expect(store).toHaveProperty('reset');
    });

    it('loads data from Redis using Lua script', async () => {
      const testData = { count: 5, timestamp: Date.now() };
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue(JSON.stringify(testData))
      };
      
      const store = redisStore(mockClient);
      const result = await store.load('test-key');
      
      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('local key = ARGV[1]'),
        0,
        'rl:test-key'
      );
      expect(result).toEqual(testData);
    });

    it('returns undefined when Redis returns null', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue(null)
      };
      
      const store = redisStore(mockClient);
      const result = await store.load('test-key');
      
      expect(result).toBeUndefined();
    });

    it('saves data to Redis using Lua script', async () => {
      const testData = { count: 3, timestamp: Date.now() };
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue('OK')
      };
      
      const store = redisStore(mockClient);
      await store.save('test-key', testData, 5000);
      
      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('local key = ARGV[1]'),
        0,
        'rl:test-key',
        JSON.stringify(testData),
        '5000'
      );
    });

    it('resets key in Redis using Lua script', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue(1)
      };
      
      const store = redisStore(mockClient);
      await store.reset!('test-key');
      
      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('local key = ARGV[1]'),
        0,
        'rl:test-key'
      );
    });

    it('uses custom namespace when provided', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue(null)
      };
      
      const store = redisStore(mockClient, 'custom');
      await store.load('test-key');
      
      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        0,
        'custom:test-key'
      );
    });

    it('uses default namespace when not provided', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue(null)
      };
      
      const store = redisStore(mockClient);
      await store.load('test-key');
      
      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        0,
        'rl:test-key'
      );
    });
  });

  describe('error handling', () => {
    it('throws error when load fails', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockRejectedValue(new Error('Redis connection error'))
      };
      
      const store = redisStore(mockClient);
      
      await expect(store.load('test-key')).rejects.toThrow('Redis load failed');
    });

    it('throws error when save fails', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockRejectedValue(new Error('Redis connection error'))
      };
      
      const store = redisStore(mockClient);
      
      await expect(store.save('test-key', {}, 1000)).rejects.toThrow('Redis save failed');
    });

    it('throws error when reset fails', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockRejectedValue(new Error('Redis connection error'))
      };
      
      const store = redisStore(mockClient);
      
      await expect(store.reset!('test-key')).rejects.toThrow('Redis reset failed');
    });

    it('handles JSON parse errors gracefully', async () => {
      const mockClient: RedisLike = {
        eval: vi.fn().mockResolvedValue('invalid json{')
      };
      
      const store = redisStore(mockClient);
      
      await expect(store.load('test-key')).rejects.toThrow('Redis load failed');
    });
  });

  describe('RedisLike interface', () => {
    it('requires eval method', () => {
      const validClient: RedisLike = {
        eval: vi.fn().mockResolvedValue('result')
      };
      
      expect(() => redisStore(validClient)).not.toThrow();
    });
  });
});