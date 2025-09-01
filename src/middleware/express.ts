import type { Request, Response, NextFunction } from 'express';
import { HeadersOptions, LimitContext, LimitResult } from '../core/types';
import { Ratelimit } from '../core/ratelimit';
import * as header from '../headers';

type Opts = {
  headers?: HeadersOptions;
  onDenied?: (req: Request, res: Response, result: LimitResult) => void;
  getContext?: (req: Request) => LimitContext;
};

export function expressMiddleware(limiter: Ratelimit, opts: Opts = {}) {
  const { headers: ho = { standard: true, legacy: false }, onDenied, getContext } = opts;

  return async function rl(req: Request, res: Response, next: NextFunction) {
    try {
      const ctx: LimitContext = getContext ? getContext(req) : { 
        ip: req.ip || undefined, 
        path: req.path, 
        method: req.method 
      };
      const result = await limiter.limit(ctx);
      header.apply(res as any, result, ho);
      if (!result.allowed) {
        if (onDenied) return onDenied(req, res, result);
        return res.status(429).send('Too Many Requests');
      }
      return next();
    } catch (err) {
      return next(err as any);
    }
  };
}
