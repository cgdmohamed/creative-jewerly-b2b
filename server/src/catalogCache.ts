import { mainApi, isPlaceholderWeight, type ApiItem, type ApiPrice, type ApiCategory } from './apiClient.js';
import { buildCatalog, type CatalogEntry } from './pricing.js';
import { recordRateSnapshot } from './db.js';

export interface CatalogSnapshot {
  items: CatalogEntry[];
  categories: ApiCategory[];
  vatPercent: number;
  fetchedAt: string;
}

let cache: CatalogSnapshot | null = null;
let fetching: Promise<CatalogSnapshot> | null = null;
let lastError: string | null = null;

export const CATALOG_TTL_MS = 60_000;

function settingsVat(settings: Record<string, string>): number {
  const v = Number(settings.vat_percent ?? 0);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

async function load(): Promise<CatalogSnapshot> {
  const [items, prices, categories, settings] = await Promise.all([
    mainApi.fetchItems(),
    mainApi.fetchPrices(),
    mainApi.fetchCategories(),
    mainApi.fetchSettings(),
  ]);

  // Only show real, sellable pieces: active, available, with stock and a real weight.
  const visible = (items as ApiItem[]).filter(
    (i) =>
      i.isActive !== false &&
      i.status === 'available' &&
      Number(i.availableQty ?? i.quantity ?? 0) > 0 &&
      !isPlaceholderWeight(i),
  );

  const vatPercent = settingsVat(settings);
  const snapshot = {
    items: buildCatalog(visible, prices as ApiPrice[], vatPercent),
    categories: categories as ApiCategory[],
    vatPercent,
    fetchedAt: new Date().toISOString(),
  };

  // Persist today's prices so the admin dashboard can chart rate movement.
  const seen = new Set<string>();
  const rates = snapshot.items
    .filter((i) => i.pricePerGram != null)
    .map((i) => ({ metalType: i.metalType, carat: i.carat ?? null, pricePerGram: i.pricePerGram }))
    .filter((r) => {
      const key = `${r.metalType}:${r.carat ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  try {
    await recordRateSnapshot(rates);
  } catch {
    // non-fatal — rate history is best-effort
  }

  return snapshot;
}

export function getCatalog(force = false): Promise<CatalogSnapshot> {
  const now = Date.now();
  if (cache && !force && now - new Date(cache.fetchedAt).getTime() < CATALOG_TTL_MS) {
    return Promise.resolve(cache);
  }
  if (fetching) return fetching;

  fetching = load()
    .then((snap) => {
      cache = snap;
      lastError = null;
      return snap;
    })
    .catch((e: any) => {
      lastError = e?.message || String(e);
      throw e;
    })
    .finally(() => {
      fetching = null;
    });
  return fetching;
}

export function getCatalogError(): string | null {
  return lastError;
}

/** Single-item lookup used by cart/order validation at checkout time. */
export async function findCatalogItem(itemId: number): Promise<CatalogEntry | null> {
  const snap = await getCatalog(true);
  return snap.items.find((i) => i.id === itemId) ?? null;
}
