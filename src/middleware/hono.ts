import type { Context, Next } from 'hono';
import { HeadersOptions, LimitContext } from '../core/types';
import { Ratelimit } from '../core/ratelimit';
import { build as buildHeaders } from '../headers';

type Opts = {
  headers?: HeadersOptions;
  getContext?: (c: Context) => LimitContext;
  deniedResponse?: Response | ((c: Context) => Response);
};

export function honoMiddleware(limiter: Ratelimit, opts: Opts = {}) {
  const { headers = { standard: true }, getContext, deniedResponse } = opts;

  return async (c: Context, next: Next) => {
    const ctx: LimitContext = getContext ? getContext(c) : { 
      ip: c.req.header("CF-Connecting-IP") || undefined, 
      path: c.req.path, 
      method: c.req.method 
    };
    const result = await limiter.limit(ctx);

    const hdrs = buildHeaders(result, headers);
    for (const [k, v] of Object.entries(hdrs)) c.header(k, v);

    if (!result.allowed) {
      return typeof deniedResponse === 'function'
        ? (deniedResponse as any)(c)
        : (deniedResponse ?? new Response('Too Many Requests', { status: 429 }));
    }
    await next();
  };
}
