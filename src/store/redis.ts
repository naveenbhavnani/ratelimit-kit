import { Store } from '../core/types';

export type RedisLike = {
  eval(script: string, numKeys: number, ...args: (string|number)[]): Promise<any>;
};

export function redisStore(client: RedisLike, namespace = 'rl'): Store {
  // Lua script for atomic load operation
  const loadScript = `
    local key = ARGV[1]
    local data = redis.call('GET', key)
    if data then
      local ttl = redis.call('TTL', key)
      if ttl > 0 then
        return data
      else
        redis.call('DEL', key)
        return nil
      end
    end
    return nil
  `;

  // Lua script for atomic save operation
  const saveScript = `
    local key = ARGV[1]
    local value = ARGV[2]
    local ttlMs = tonumber(ARGV[3])
    local ttlSec = math.ceil(ttlMs / 1000)
    
    redis.call('SET', key, value)
    redis.call('EXPIRE', key, ttlSec)
    return 'OK'
  `;

  // Lua script for reset operation
  const resetScript = `
    local key = ARGV[1]
    return redis.call('DEL', key)
  `;

  return {
    async load(key: string) {
      const fullKey = `${namespace}:${key}`;
      try {
        const result = await client.eval(loadScript, 0, fullKey);
        if (!result) return undefined;
        return JSON.parse(result);
      } catch (error) {
        throw new Error(`Redis load failed: ${error}`);
      }
    },

    async save(key: string, state: any, ttlMs: number) {
      const fullKey = `${namespace}:${key}`;
      const serialized = JSON.stringify(state);
      try {
        await client.eval(saveScript, 0, fullKey, serialized, ttlMs.toString());
      } catch (error) {
        throw new Error(`Redis save failed: ${error}`);
      }
    },

    async reset(key: string) {
      const fullKey = `${namespace}:${key}`;
      try {
        await client.eval(resetScript, 0, fullKey);
      } catch (error) {
        throw new Error(`Redis reset failed: ${error}`);
      }
    }
  };
}
