import express from 'express';
import { Ratelimit, algorithms, memoryStore } from '../src';
import { expressMiddleware } from '../src/middleware/express';

const app = express();

const limiter = new Ratelimit({
  algorithm: algorithms.slidingWindow({ limit: 5, windowMs: 10000 }),
  store: memoryStore(),
  key: (ctx) => ctx.ip ?? 'anon',
  namespace: 'global'
});

app.use(expressMiddleware(limiter));
app.get('/hello', (_req, res) => res.json({ ok: true, t: Date.now() }));
app.listen(3000, () => console.log('http://localhost:3000'));
