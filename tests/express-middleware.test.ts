import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expressMiddleware } from '../src/middleware/express';
import { Ratelimit } from '../src/core/ratelimit';
import { memoryStore } from '../src/store/memory';
import { slidingWindow } from '../src/core/slidingWindow';
import type { Request, Response, NextFunction } from 'express';

describe('expressMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let limiter: Ratelimit;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET'
    };

    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    nextFn = vi.fn();

    limiter = new Ratelimit({
      algorithm: slidingWindow({ limit: 10, windowMs: 60000 }),
      store: memoryStore(),
      key: (ctx) => ctx.ip || 'unknown'
    });
  });

  describe('basic functionality', () => {
    it('calls next() when request is allowed', async () => {
      const middleware = expressMiddleware(limiter);
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(nextFn).toHaveBeenCalledTimes(1);
      expect(nextFn).toHaveBeenCalledWith(); // No error
    });

    it('sends 429 response when request is denied', async () => {
      // Create a limiter with very low limit to trigger denial
      const strictLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 1, windowMs: 60000 }),
        store: memoryStore(),
        key: (ctx) => ctx.ip || 'unknown'
      });

      const middleware = expressMiddleware(strictLimiter);
      
      // First request should be allowed
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
      
      // Second request should be denied
      const nextFn2 = vi.fn();
      await middleware(mockReq as Request, mockRes as Response, nextFn2);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.send).toHaveBeenCalledWith('Too Many Requests');
      expect(nextFn2).not.toHaveBeenCalled();
    });

    it('applies rate limit headers by default', async () => {
      const middleware = expressMiddleware(limiter);
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Limit', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Reset', expect.any(String));
    });
  });

  describe('options', () => {
    it('uses custom headers options', async () => {
      const middleware = expressMiddleware(limiter, {
        headers: { standard: false, legacy: true }
      });
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      
      // Should not set standard headers
      expect(mockRes.setHeader).not.toHaveBeenCalledWith('RateLimit-Limit', expect.any(String));
    });

    it('uses custom getContext function', async () => {
      const getContext = vi.fn().mockReturnValue({ userId: 'user123' });
      const middleware = expressMiddleware(limiter, { getContext });
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(getContext).toHaveBeenCalledWith(mockReq);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('uses default context when getContext not provided', async () => {
      const middleware = expressMiddleware(limiter);
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      // Should work with default context extraction
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('calls custom onDenied handler when provided', async () => {
      const onDenied = vi.fn();
      const strictLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 1, windowMs: 60000 }),
        store: memoryStore(),
        key: () => 'test'
      });

      const middleware = expressMiddleware(strictLimiter, { onDenied });
      
      // First request to exhaust limit
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      // Second request should trigger onDenied
      const nextFn2 = vi.fn();
      await middleware(mockReq as Request, mockRes as Response, nextFn2);
      
      expect(onDenied).toHaveBeenCalledWith(mockReq, mockRes, expect.objectContaining({
        allowed: false
      }));
      expect(nextFn2).not.toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled(); // Default handler not called
    });
  });

  describe('error handling', () => {
    it('calls next with error when limiter throws', async () => {
      const errorLimiter = {
        limit: vi.fn().mockRejectedValue(new Error('Store error'))
      } as any;
      
      const middleware = expressMiddleware(errorLimiter);
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('calls next with error when getContext throws', async () => {
      const getContext = vi.fn().mockImplementation(() => {
        throw new Error('Context error');
      });
      
      const middleware = expressMiddleware(limiter, { getContext });
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('context extraction', () => {
    it('extracts ip, path, and method from request', async () => {
      const contextSpy = vi.fn();
      const spyLimiter = new Ratelimit({
        algorithm: slidingWindow({ limit: 10, windowMs: 60000 }),
        store: memoryStore(),
        key: (ctx) => {
          contextSpy(ctx);
          return 'test';
        }
      });
      
      const middleware = expressMiddleware(spyLimiter);
      
      await middleware(mockReq as Request, mockRes as Response, nextFn);
      
      expect(contextSpy).toHaveBeenCalledWith({
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET'
      });
    });

    it('handles missing request properties gracefully', async () => {
      const incompleteReq = {} as Request;
      const middleware = expressMiddleware(limiter);
      
      await middleware(incompleteReq, mockRes as Response, nextFn);
      
      expect(nextFn).toHaveBeenCalledTimes(1);
    });
  });
});