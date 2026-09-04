import { Router } from 'express';
import { config } from '../config.js';
import { getCatalog, getCatalogError } from '../catalogCache.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let catalog = 'ok';
  try {
    await getCatalog();
  } catch {
    catalog = 'error';
  }
  res.json({
    ok: true,
    time: new Date().toISOString(),
    mainApiBase: config.apiBaseUrl,
    catalog,
    catalogError: catalog === 'error' ? getCatalogError() : null,
  });
});
