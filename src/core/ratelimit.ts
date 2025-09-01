import { Algorithm, KeyFn, LimitContext, LimitResult, RatelimitOptions, Store } from './types';

export class Ratelimit {
  private store: Store;
  private algorithm: Algorithm;
  private keyFn: KeyFn;
  private namespace: string;
  private costFn: (ctx: LimitContext) => number;

  constructor(opts: RatelimitOptions) {
    this.store = opts.store;
    this.algorithm = opts.algorithm;
    this.keyFn = opts.key;
    this.namespace = opts.namespace ?? 'default';
    this.costFn = opts.cost ?? (() => 1);
  }

  async limit(ctx: LimitContext): Promise<LimitResult> {
    const now = Date.now();
    const key = `${this.namespace}:${this.keyFn(ctx)}`;
    const cost = Math.max(0, Math.floor(this.costFn(ctx)) || 1);
    const state = await this.store.load(key);
    const { state: newState, result, ttlMs } = this.algorithm.compute(state, cost, now);
    await this.store.save(key, newState, ttlMs);
    return { ...result, now };
  }
}
