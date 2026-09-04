import { Router } from 'express';
import { config } from '../config.js';
import { getCatalog } from '../catalogCache.js';

export const catalogRouter = Router();

function stripPrices(items: any[]) {
  return items.map((it) => ({ ...it, unitMetal: null, unitCraft: null, unitPrice: null, pricePerGram: null }));
}

catalogRouter.get('/', async (req, res) => {
  try {
    const snap = await getCatalog();
    const visible = config.publicPrices ? snap.items : stripPrices(snap.items);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      items: visible,
      categories: snap.categories,
      vatPercent: snap.vatPercent,
      pricesHidden: !config.publicPrices,
      fetchedAt: snap.fetchedAt,
    });
  } catch (e: any) {
    res.status(502).json({ error: 'catalog.unavailable', detail: e?.message });
  }
});

catalogRouter.get('/:id', async (req, res) => {
  try {
    const snap = await getCatalog();
    const item = snap.items.find((i) => i.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'notfound' });
    res.json(config.publicPrices ? item : { ...stripPrices([item])[0], priceable: false });
  } catch (e: any) {
    res.status(502).json({ error: 'catalog.unavailable', detail: e?.message });
  }
});
