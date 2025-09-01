import { HeadersOptions, LimitResult } from './core/types';

export function build(result: LimitResult, opts: HeadersOptions = {}) {
  const { standard = true, legacy = false, policy = false } = opts;
  const out: Record<string, string> = {};

  if (standard) {
    out['RateLimit-Limit'] = String(result.limit);
    out['RateLimit-Remaining'] = String(result.remaining);
    out['RateLimit-Reset'] = String(result.reset);
    if (result.retryAfter != null) out['Retry-After'] = String(Math.ceil(result.retryAfter / 1000));
  }

  if (legacy) {
    out['X-RateLimit-Limit'] = String(result.limit);
    out['X-RateLimit-Remaining'] = String(result.remaining);
    out['X-RateLimit-Reset'] = String(result.reset);
    if (result.retryAfter != null) out['Retry-After'] = String(Math.ceil(result.retryAfter / 1000));
  }

  if (policy && (result as any).policy) {
    out['RateLimit-Policy'] = String((result as any).policy);
  }

  return out;
}

export function apply(res: any, result: LimitResult, opts?: HeadersOptions) {
  const h = build(result, opts);
  for (const [k, v] of Object.entries(h)) {
    if (typeof (res).setHeader === 'function') (res).setHeader(k, v);
    else if ((res).headers && typeof (res).headers.set === 'function') (res).headers.set(k, v);
  }
  return res;
}
