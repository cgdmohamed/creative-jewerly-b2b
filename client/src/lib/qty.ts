import type { CatalogItem } from '@/lib/types';

export function itemMinQty(item: { minQty?: number }): number {
  return Math.max(1, Math.round(Number(item.minQty ?? 0)));
}

export function itemMaxQty(item: CatalogItem): number {
  const avail = Math.max(0, Number(item.availableQty ?? 0));
  const cap = item.maxQty != null && Number(item.maxQty) > 0 ? Math.max(0, Number(item.maxQty)) : avail;
  return Math.min(avail, cap);
}

export function clampToRange(item: CatalogItem, quantity: number): number {
  return Math.min(Math.max(quantity, itemMinQty(item)), itemMaxQty(item));
}

export function itemRangeLabel(item: CatalogItem): string | null {
  const min = itemMinQty(item);
  const max = itemMaxQty(item);
  if (max <= 0) return null;
  return min > 1 ? `الحد الأدنى ${min} · حتى ${max} قطعة` : `متاح حتى ${max} قطعة`;
}
