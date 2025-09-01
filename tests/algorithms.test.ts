import { describe, it, expect } from 'vitest';
import * as algorithms from '../src/core/algorithms';
import { slidingWindow } from '../src/core/slidingWindow';
import { tokenBucket } from '../src/core/tokenBucket';

describe('algorithms', () => {
  it('exports slidingWindow algorithm', () => {
    expect(algorithms.slidingWindow).toBe(slidingWindow);
    expect(typeof algorithms.slidingWindow).toBe('function');
  });

  it('exports tokenBucket algorithm', () => {
    expect(algorithms.tokenBucket).toBe(tokenBucket);
    expect(typeof algorithms.tokenBucket).toBe('function');
  });

  it('exports all expected algorithms', () => {
    const expectedExports = ['slidingWindow', 'tokenBucket'];
    const actualExports = Object.keys(algorithms);
    
    expectedExports.forEach(exportName => {
      expect(actualExports).toContain(exportName);
    });
  });

  it('creates algorithms that implement Algorithm interface', () => {
    const sliding = algorithms.slidingWindow({ limit: 10, windowMs: 1000 });
    const bucket = algorithms.tokenBucket({ capacity: 10, refillRatePerSec: 1 });
    
    // Check required properties
    expect(sliding).toHaveProperty('name');
    expect(sliding).toHaveProperty('compute');
    expect(typeof sliding.compute).toBe('function');
    
    expect(bucket).toHaveProperty('name');
    expect(bucket).toHaveProperty('compute');
    expect(typeof bucket.compute).toBe('function');
    
    // Check algorithm names
    expect(sliding.name).toBe('sliding');
    expect(bucket.name).toBe('tokenBucket');
  });
});