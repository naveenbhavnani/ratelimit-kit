import { describe, it, expect, vi } from 'vitest';
import { build, apply } from '../src/headers';
import type { LimitResult } from '../src/core/types';

describe('headers', () => {
  const mockResult: LimitResult = {
    allowed: true,
    limit: 100,
    remaining: 95,
    reset: 1234567890,
    now: Date.now()
  };

  const mockDeniedResult: LimitResult = {
    allowed: false,
    limit: 100,
    remaining: 0,
    reset: 1234567890,
    retryAfter: 5000,
    now: Date.now()
  };

  describe('build', () => {
    it('returns standard headers by default', () => {
      const headers = build(mockResult);
      
      expect(headers).toEqual({
        'RateLimit-Limit': '100',
        'RateLimit-Remaining': '95',
        'RateLimit-Reset': '1234567890'
      });
    });

    it('includes Retry-After header when retryAfter is present', () => {
      const headers = build(mockDeniedResult);
      
      expect(headers).toMatchObject({
        'RateLimit-Limit': '100',
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': '1234567890',
        'Retry-After': '5' // 5000ms / 1000 = 5 seconds
      });
    });

    it('rounds up retryAfter to nearest second', () => {
      const result = { ...mockDeniedResult, retryAfter: 1500 };
      const headers = build(result);
      
      expect(headers['Retry-After']).toBe('2'); // Math.ceil(1500/1000) = 2
    });

    it('includes legacy headers when enabled', () => {
      const headers = build(mockResult, { legacy: true, standard: false });
      
      expect(headers).toEqual({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': '1234567890'
      });
    });

    it('includes both standard and legacy headers when both enabled', () => {
      const headers = build(mockResult, { standard: true, legacy: true });
      
      expect(headers).toEqual({
        'RateLimit-Limit': '100',
        'RateLimit-Remaining': '95',
        'RateLimit-Reset': '1234567890',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': '1234567890'
      });
    });

    it('includes Retry-After in legacy headers when present', () => {
      const headers = build(mockDeniedResult, { legacy: true, standard: false });
      
      expect(headers).toMatchObject({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1234567890',
        'Retry-After': '5'
      });
    });

    it('includes policy header when enabled and present', () => {
      const resultWithPolicy = { ...mockResult, policy: '100;w=60' };
      const headers = build(resultWithPolicy as any, { policy: true });
      
      expect(headers).toMatchObject({
        'RateLimit-Policy': '100;w=60'
      });
    });

    it('does not include policy header when enabled but not present', () => {
      const headers = build(mockResult, { policy: true });
      
      expect(headers).not.toHaveProperty('RateLimit-Policy');
    });

    it('returns empty object when all options disabled', () => {
      const headers = build(mockResult, { 
        standard: false, 
        legacy: false, 
        policy: false 
      });
      
      expect(headers).toEqual({});
    });

    it('handles zero retryAfter', () => {
      const result = { ...mockDeniedResult, retryAfter: 0 };
      const headers = build(result);
      
      expect(headers['Retry-After']).toBe('0');
    });
  });

  describe('apply', () => {
    it('applies headers to Express-style response with setHeader method', () => {
      const mockRes = {
        setHeader: vi.fn()
      };

      apply(mockRes, mockResult);

      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '100');
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '95');
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Reset', '1234567890');
      expect(mockRes.setHeader).toHaveBeenCalledTimes(3);
    });

    it('applies headers to Fetch API-style response with headers.set method', () => {
      const mockRes = {
        headers: {
          set: vi.fn()
        }
      };

      apply(mockRes, mockResult);

      expect(mockRes.headers.set).toHaveBeenCalledWith('RateLimit-Limit', '100');
      expect(mockRes.headers.set).toHaveBeenCalledWith('RateLimit-Remaining', '95');
      expect(mockRes.headers.set).toHaveBeenCalledWith('RateLimit-Reset', '1234567890');
      expect(mockRes.headers.set).toHaveBeenCalledTimes(3);
    });

    it('returns the response object', () => {
      const mockRes = { setHeader: vi.fn() };
      const result = apply(mockRes, mockResult);
      
      expect(result).toBe(mockRes);
    });

    it('handles response objects without header methods gracefully', () => {
      const mockRes = {};
      
      expect(() => apply(mockRes, mockResult)).not.toThrow();
    });

    it('applies headers with custom options', () => {
      const mockRes = { setHeader: vi.fn() };
      
      apply(mockRes, mockResult, { legacy: true, standard: false });
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '95');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', '1234567890');
    });
  });
});