import { describe, it, expect } from 'vitest';
import * as ratelimitKit from '../src/index';
import { Ratelimit } from '../src/core/ratelimit';
import { memoryStore } from '../src/store/memory';
import * as algorithms from '../src/core/algorithms';
import * as headers from '../src/headers';

describe('index exports', () => {
  it('exports Ratelimit class', () => {
    expect(ratelimitKit.Ratelimit).toBe(Ratelimit);
    expect(typeof ratelimitKit.Ratelimit).toBe('function');
  });

  it('exports memoryStore function', () => {
    expect(ratelimitKit.memoryStore).toBe(memoryStore);
    expect(typeof ratelimitKit.memoryStore).toBe('function');
  });

  it('exports algorithms namespace', () => {
    expect(ratelimitKit.algorithms).toBe(algorithms);
    expect(typeof ratelimitKit.algorithms).toBe('object');
    expect(ratelimitKit.algorithms.slidingWindow).toBeDefined();
    expect(ratelimitKit.algorithms.tokenBucket).toBeDefined();
  });

  it('exports headers namespace', () => {
    expect(ratelimitKit.headers).toBe(headers);
    expect(typeof ratelimitKit.headers).toBe('object');
    expect(ratelimitKit.headers.build).toBeDefined();
    expect(ratelimitKit.headers.apply).toBeDefined();
  });

  it('exports all types from core/types', () => {
    // Types are not runtime values, but we can verify the module structure
    expect(Object.keys(ratelimitKit)).toContain('Ratelimit');
    expect(Object.keys(ratelimitKit)).toContain('algorithms');
    expect(Object.keys(ratelimitKit)).toContain('headers');
    expect(Object.keys(ratelimitKit)).toContain('memoryStore');
  });

  it('allows creating a working rate limiter with exported components', () => {
    const limiter = new ratelimitKit.Ratelimit({
      algorithm: ratelimitKit.algorithms.slidingWindow({ limit: 10, windowMs: 60000 }),
      store: ratelimitKit.memoryStore(),
      key: (ctx) => ctx.ip || 'default'
    });
    
    expect(limiter).toBeInstanceOf(ratelimitKit.Ratelimit);
  });
});