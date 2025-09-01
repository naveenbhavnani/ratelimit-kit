import { Store } from '../core/types';

/**
 * Memory store: suitable for dev/tests only (per-process).
 */
export function memoryStore(): Store {
  const map = new Map<string, { state: any; expiresAt: number }>();

  function cleanup(now: number) {
    for (const [k, v] of map) {
      if (v.expiresAt <= now) map.delete(k);
    }
  }

  return {
    async load(key: string) {
      const now = Date.now();
      cleanup(now);
      const v = map.get(key);
      if (!v) return undefined;
      if (v.expiresAt <= now) { map.delete(key); return undefined; }
      return v.state;
    },
    async save(key: string, state: any, ttlMs: number) {
      const now = Date.now();
      cleanup(now);
      map.set(key, { state, expiresAt: now + ttlMs });
    },
    async reset(key: string) {
      map.delete(key);
    }
  };
}
