import express from 'express';
import compression from 'compression';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { configRouter } from './routes/config.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(compression());
app.use(express.json({ limit: '5mb' }));

// Proxy item photos from the main system (/uploads/...) through this server so
// the shop never exposes the main API URL to the browser.
app.use('/uploads', async (req, res) => {
  try {
    const upstream = await fetch(`${config.apiBaseUrl}${req.originalUrl}`, {
      method: 'GET',
      headers: { Accept: req.headers.accept || '*/*' },
    });
    if (!upstream.ok) return res.status(upstream.status).end();
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch {
    res.status(502).end();
  }
});

app.use('/api', healthRouter);
app.use('/api', configRouter);
app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'route.notfound' }));

// Production: serve the built shop client from the same process.
const clientDist = path.resolve(import.meta.dirname, '../../client/dist');
const clientIndex = path.join(clientDist, 'index.html');
if (fs.existsSync(clientIndex)) {
  // Vite emits content-hashed filenames — cache them for a year without revalidation.
  app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '365d', immutable: true }));
  app.use(express.static(clientDist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(clientIndex);
  });
  console.log(`[serve] serving shop client from ${clientDist}`);
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[shop error]', err);
  res.status(err.status || 500).json({ error: err.expose || err.status ? err.message : 'internal' });
});

app.listen(config.port, () => {
  console.log(`B2B shop listening on http://localhost:${config.port}`);
  console.log(`  main API: ${config.apiBaseUrl}`);
  console.log(`  guest ordering: ${config.guestOrderingEnabled ? 'on' : 'off'}`);
  console.log(`  down payment: ${config.downPaymentPercent}%`);
});
