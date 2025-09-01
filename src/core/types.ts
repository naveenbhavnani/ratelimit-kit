export type LimitContext = {
  ip?: string | undefined;
  userId?: string | undefined;
  apiKey?: string | undefined;
  path?: string | undefined;
  method?: string | undefined;
  [k: string]: any;
};

export type LimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;       // epoch seconds
  retryAfter?: number | undefined; // milliseconds
  now: number;         // epoch ms
  meta?: Record<string, any>;
};

export interface Algorithm {
  name: 'sliding' | 'tokenBucket';
  compute(state: any | undefined, cost: number, now: number): {
    state: any;
    result: Omit<LimitResult, 'now'>;
    ttlMs: number;
  };
  policy?: string;
}

export interface Store {
  load(key: string): Promise<any | undefined>;
  save(key: string, state: any, ttlMs: number): Promise<void>;
  reset?(key: string): Promise<void>;
}

export type KeyFn = (ctx: LimitContext) => string;

export type RatelimitOptions = {
  store: Store;
  algorithm: Algorithm;
  key: KeyFn;
  namespace?: string;
  cost?: (ctx: LimitContext) => number; // default 1
};

export type HeadersOptions = {
  standard?: boolean;
  legacy?: boolean;
  policy?: boolean;
};
