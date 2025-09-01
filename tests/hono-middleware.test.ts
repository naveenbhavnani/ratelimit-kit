import { describe, it, expect, vi, beforeEach } from 'vitest';
import { honoMiddleware } from '../src/middleware/hono';
import { Ratelimit } from '../src/core/ratelimit';
import { memoryStore } from '../src/store/memory';
import { slidingWindow } from '../src/core/slidingWindow';
import type { Context, Next } from 'hono';

describe('honoMiddleware', () => {
  let mockContext: Partial<Context>;
  let nextFn: Next;
  let limiter: Ratelimit;

  beforeEach(() => {
    mockContext = {
      req: {
        header: vi.fn().mockReturnValue(undefined),
        path: '/api/test',
        method: 'GET'
      } as any,
      header: vi.fn()
    };

    nextFn = vi.fn().mockResolvedValue(undefined);

    limiter = new Ratelimit({
      algorithm: slidingWindow({ limit: 10, windowMs: 60000 }),
      store: memoryStore(),
      key: (ctx) => ctx.ip || 'unknown'
    });
  });

  describe('basic functionality', () => {
    it('calls next() when request is allowed', async () => {
      const middleware = honoMiddleware(limiter);
      
      const result = await middleware(mockContext as Context, nextFn);
      
      expect(nextFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('returns 429 response when request is denied', async () => {
      const strictLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 1, windowMs: 60000 }),
        store: memoryStore(),
        key: (ctx) => ctx.ip || 'unknown'
      });

      const middleware = honoMiddleware(strictLimiter);
      
      await middleware(mockContext as Context, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
      
      const nextFn2 = vi.fn();
      const result = await middleware(mockContext as Context, nextFn2);
      
      expect(result).toBeInstanceOf(Response);
      expect(nextFn2).not.toHaveBeenCalled();
      
      const response = result as Response;
      expect(response.status).toBe(429);
      const text = await response.text();
      expect(text).toBe('Too Many Requests');
    });

    it('applies rate limit headers by default', async () => {
      const middleware = honoMiddleware(limiter);
      
      await middleware(mockContext as Context, nextFn);
      
      expect(mockContext.header).toHaveBeenCalledWith('RateLimit-Limit', expect.any(String));
      expect(mockContext.header).toHaveBeenCalledWith('RateLimit-Remaining', expect.any(String));
      expect(mockContext.header).toHaveBeenCalledWith('RateLimit-Reset', expect.any(String));
    });
  });

  describe('options', () => {
    it('uses custom headers options', async () => {
      const middleware = honoMiddleware(limiter, {
        headers: { standard: false, legacy: true }
      });
      
      await middleware(mockContext as Context, nextFn);
      
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      
      expect(mockContext.header).not.toHaveBeenCalledWith('RateLimit-Limit', expect.any(String));
    });

    it('uses custom getContext function', async () => {
      const getContext = vi.fn().mockReturnValue({ userId: 'user123' });
      const middleware = honoMiddleware(limiter, { getContext });
      
      await middleware(mockContext as Context, nextFn);
      
      expect(getContext).toHaveBeenCalledWith(mockContext);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('uses default context when getContext not provided', async () => {
      const middleware = honoMiddleware(limiter);
      
      await middleware(mockContext as Context, nextFn);
      
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('uses custom deniedResponse when provided', async () => {
      const customResponse = new Response('Custom Rate Limit Message', { status: 429 });
      const strictLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 1, windowMs: 60000 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const middleware = honoMiddleware(strictLimiter, { 
        deniedResponse: customResponse 
      });
      
      await middleware(mockContext as Context, vi.fn());
      
      const result = await middleware(mockContext as Context, vi.fn());
      
      expect(result).toBe(customResponse);
    });

    it('uses function deniedResponse when provided', async () => {
      const deniedResponseFn = vi.fn().mockReturnValue(
        new Response('Function Response', { status: 429 })
      );
      const strictLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 1, windowMs: 60000 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const middleware = honoMiddleware(strictLimiter, { 
        deniedResponse: deniedResponseFn 
      });
      
      await middleware(mockContext as Context, vi.fn());
      
      const result = await middleware(mockContext as Context, vi.fn());
      
      expect(deniedResponseFn).toHaveBeenCalledWith(mockContext);
      expect(result).toBeInstanceOf(Response);
      
      const response = result as Response;
      const text = await response.text();
      expect(text).toBe('Function Response');
    });
  });

  describe('context extraction', () => {
    it('extracts CF-Connecting-IP, path, and method from request', async () => {
      const contextSpy = vi.fn();
      const spyLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 10, windowMs: 60000 }),
        store: memoryStore(),
        key: (ctx) => {
          contextSpy(ctx);
          return 'test';
        }
      });
      
      (mockContext.req!.header as any).mockImplementation((name: string) => {
        if (name === 'CF-Connecting-IP') return '1.2.3.4';
        return undefined;
      });
      
      const middleware = honoMiddleware(spyLimiter);
      
      await middleware(mockContext as Context, nextFn);
      
      expect(contextSpy).toHaveBeenCalledWith({
        ip: '1.2.3.4',
        path: '/api/test',
        method: 'GET'
      });
    });

    it('handles missing CF-Connecting-IP header', async () => {
      const contextSpy = vi.fn();
      const spyLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 10, windowMs: 60000 }),
        store: memoryStore(),
        key: (ctx) => {
          contextSpy(ctx);
          return 'test';
        }
      });
      
      const middleware = honoMiddleware(spyLimiter);
      
      await middleware(mockContext as Context, nextFn);
      
      expect(contextSpy).toHaveBeenCalledWith({
        ip: undefined,
        path: '/api/test',
        method: 'GET'
      });
    });

    it('handles missing request properties gracefully', async () => {
      const incompleteContext = {
        req: { header: vi.fn() } as any,
        header: vi.fn()
      } as Context;
      
      const middleware = honoMiddleware(limiter);
      
      await middleware(incompleteContext, nextFn);
      
      expect(nextFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('header application', () => {
    it('sets all headers from buildHeaders result', async () => {
      const middleware = honoMiddleware(limiter);
      
      await middleware(mockContext as Context, nextFn);
      
      expect(mockContext.header).toHaveBeenCalledTimes(3);
    });

    it('handles policy headers when available', async () => {
      const middleware = honoMiddleware(limiter, {
        headers: { policy: true }
      });
      
      await middleware(mockContext as Context, nextFn);
      
      expect(mockContext.header).toHaveBeenCalled();
    });
  });
});