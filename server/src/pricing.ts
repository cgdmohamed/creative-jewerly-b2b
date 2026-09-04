import type { ApiItem, ApiPrice } from './apiClient.js';

export interface CatalogEntry extends ApiItem {
  unitMetal: number;
  unitCraft: number;
  unitPrice: number;
  vatPercent: number;
  pricePerGram: number | null;
  priceable: boolean;
}

export interface OrderLineTotals {
  metalSubtotal: number;
  craftsmanshipTotal: number;
  vatAmount: number;
  total: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Look up today's price per gram for an item, mirroring the main system's
 * invoice pricing rule: price_history row for (metal_type, carat) with
 * effective_date = today and end_date IS NULL.
 */
export function findPricePerGram(item: ApiItem, prices: ApiPrice[]): number | null {
  const carat = item.carat || '';
  const row = prices.find(
    (p) => p.metalType === item.metalType && (p.carat || '') === carat,
  );
  return row ? Number(row.pricePerGram) : null;
}

/** Unit pricing identical to the server's buildInvoice() logic. */
export function computeUnitPrices(
  item: ApiItem,
  pricePerGram: number,
): { unitMetal: number; unitCraft: number; unitPrice: number } {
  const weight = Number(item.weightG);
  const unitMetal = round2(weight * pricePerGram);
  const craft =
    item.craftsmanshipType === 'percent'
      ? round2((unitMetal * Number(item.craftsmanshipValue)) / 100)
      : Number(item.craftsmanshipValue);
  return { unitMetal, unitCraft: craft, unitPrice: round2(unitMetal + craft) };
}

export function buildCatalog(
  items: ApiItem[],
  prices: ApiPrice[],
  vatPercent: number,
): CatalogEntry[] {
  return items.map((item) => {
    const pricePerGram = findPricePerGram(item, prices);
    const priceable = pricePerGram != null && Number(item.weightG) > 0;
    let pricing = { unitMetal: 0, unitCraft: 0, unitPrice: 0 };
    if (pricePerGram != null) pricing = computeUnitPrices(item, pricePerGram);
    return {
      ...item,
      ...pricing,
      vatPercent,
      pricePerGram,
      priceable,
    };
  });
}

export function computeOrderTotals(
  lines: { quantity: number; unitMetal: number; unitCraft: number }[],
  vatPercent: number,
): OrderLineTotals {
  const metalSubtotal = round2(lines.reduce((s, l) => s + l.unitMetal * l.quantity, 0));
  const craftsmanshipTotal = round2(lines.reduce((s, l) => s + l.unitCraft * l.quantity, 0));
  const vatAmount =
    vatPercent > 0 ? round2(((metalSubtotal + craftsmanshipTotal) * vatPercent) / 100) : 0;
  return { metalSubtotal, craftsmanshipTotal, vatAmount, total: round2(metalSubtotal + craftsmanshipTotal + vatAmount) };
}

export function formatMoney(n: number, currency = 'ج.م'): string {
  return `${n.toLocaleString('en-EG', { maximumFractionDigits: 2 })} ${currency}`;
}
