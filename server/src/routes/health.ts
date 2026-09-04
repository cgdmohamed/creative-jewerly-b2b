import { Router } from 'express';
import { getCatalog, getCatalogError } from '../catalogCache.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let catalog = 'ok';
  try {
    await getCatalog();
  } catch {
    catalog = 'error';
  }
  const ok = catalog === 'ok';
  res.status(ok ? 200 : 503).json({
    ok,
    time: new Date().toISOString(),
    catalog,
    catalogError: catalog === 'error' ? getCatalogError() : null,
  });
});
