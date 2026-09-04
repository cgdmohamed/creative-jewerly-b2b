import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, CatalogItem } from '@/lib/types';
import { clampToRange } from '@/lib/qty';

interface CartState {
  lines: CartLine[];
  add: (item: CatalogItem, quantity?: number) => void;
  setQuantity: (itemId: number, quantity: number) => void;
  remove: (itemId: number) => void;
  clear: () => void;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (item, quantity = 1) => {
        const existing = get().lines.find((l) => l.item.id === item.id);
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.item.id === item.id ? { ...l, quantity: clampToRange(item, l.quantity + quantity) } : l,
            ),
          });
        } else {
          set({ lines: [...get().lines, { item, quantity: clampToRange(item, quantity) }] });
        }
      },
      setQuantity: (itemId, quantity) => {
        set({
          lines: get().lines.map((l) =>
            l.item.id === itemId ? { ...l, quantity: clampToRange(l.item, quantity) } : l,
          ),
        });
      },
      remove: (itemId) => set({ lines: get().lines.filter((l) => l.item.id !== itemId) }),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((s, l) => s + l.quantity, 0),
    }),
    { name: 'b2b_cart' },
  ),
);

export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce((s, l) => s + l.item.unitPrice * l.quantity, 0);

export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
