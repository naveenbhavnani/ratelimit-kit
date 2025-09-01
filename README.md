# ratelimit-kit (v0.1)

Runtime-agnostic, store-pluggable rate limiter with standards-compliant `RateLimit-*` headers for Node & Edge runtimes.

- **Algorithms:** Sliding window (2-window approximation) and Token Bucket (GCRA-like).
- **Stores:** Memory (dev), Redis (Lua outline for atomic ops). Upstash/Cloudflare stores can be added similarly.
- **Adapters:** Express & Hono; use core API for Workers/Middleware.

> **Status:** Early preview. Memory store is per-process; use Redis/DO for multi-instance limits.

## Quick start (Express)
```ts
import express from 'express';
import { Ratelimit, algorithms, memoryStore } from 'ratelimit-kit';
import { expressMiddleware } from 'ratelimit-kit/express';

const app = express();

const limiter = new Ratelimit({
  algorithm: algorithms.slidingWindow({ limit: 100, windowMs: 30_000 }),
  store: memoryStore(),
  key: (ctx) => ctx.ip ?? 'anon',
  namespace: 'global'
});

app.use(expressMiddleware(limiter));
app.get('/hello', (_req, res) => res.json({ ok: true }));
app.listen(3000);
```
