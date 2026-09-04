import { Router } from 'express';
import { config } from '../config.js';
import { getCatalog } from '../catalogCache.js';

export const configRouter = Router();

configRouter.get('/config', async (_req, res) => {
  let catalogStatus = 'unknown';
  let rates: { metalType: string; carat: string | null; pricePerGram: number | null }[] = [];
  let ratesFetchedAt: string | null = null;
  try {
    const snap = await getCatalog();
    catalogStatus = 'ok';
    ratesFetchedAt = snap.fetchedAt;
    const seen = new Set<string>();
    rates = snap.items
      .filter((i) => i.pricePerGram != null)
      .map((i) => ({ metalType: i.metalType, carat: i.carat ?? null, pricePerGram: i.pricePerGram }))
      .filter((r) => {
        const key = `${r.metalType}:${r.carat ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (a.metalType === b.metalType ? String(a.carat ?? '').localeCompare(String(b.carat ?? '')) : a.metalType.localeCompare(b.metalType)));
  } catch {
    catalogStatus = 'error';
  }
  res.json({
    storeName: config.storeName,
    currency: config.currency,
    guestOrderingEnabled: config.guestOrderingEnabled,
    publicPrices: config.publicPrices,
    downPaymentPercent: config.downPaymentPercent,
    requireAccountApproval: config.requireAccountApproval,
    defaultPaymentMethod: config.defaultPaymentMethod,
    registrationEnabled: true,
    catalogStatus,
    rates,
    ratesFetchedAt,
  });
});
