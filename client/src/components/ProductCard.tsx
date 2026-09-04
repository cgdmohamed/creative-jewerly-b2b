import { useEffect, useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { CatalogItem } from '@/lib/types';
import { metalColor, metalLabel, money, weight } from '@/lib/format';
import { itemRangeLabel } from '@/lib/qty';
import { useCart } from '@/stores/cart';
import { cn } from '@/lib/cn';
import PrefetchLink from '@/components/PrefetchLink';

export function ProductImage({ item, className, priority }: { item: CatalogItem; className?: string; priority?: boolean }) {
  const common = {
    decoding: 'async' as const,
    loading: ('lazy' as const),
    fetchPriority: (priority ? ('high' as const) : ('auto' as const)),
  };
  if (!item.photoUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-brand-50', className)}>
        <span className="text-4xl font-extrabold text-brand-300">{item.metalType === 'gold' ? 'Au' : 'Ag'}</span>
      </div>
    );
  }
  return (
    <img
      src={item.photoUrl}
      alt={item.name || item.code}
      className={cn('object-cover', className)}
      {...common}
    />
  );
}

export default function ProductCard({ item }: { item: CatalogItem }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const handleAdd = () => {
    add(item);
    setAdded(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <PrefetchLink to={`/products/${item.id}`} className="relative block aspect-square overflow-hidden">
        <ProductImage item={item} className="h-full w-full transition duration-300 group-hover:scale-105" />
        <span
          className={cn(
            'absolute top-2 right-2 rounded-full border px-2.5 py-0.5 text-xs font-bold',
            metalColor(item.metalType),
          )}
        >
          {metalLabel(item.metalType)}
        </span>
        {item.carat && (
          <span className="absolute top-2 left-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            {item.carat}
          </span>
        )}
      </PrefetchLink>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <PrefetchLink to={`/products/${item.id}`} className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-slate-800">
              {item.name || item.code}
            </h3>
            <p className="text-xs text-slate-500">
              {item.categoryName && `${item.categoryName} · `}
              {weight(item.weightG)}
            </p>
          </PrefetchLink>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div>
            <p className="text-base font-extrabold text-brand-700">
              {item.priceable ? money(item.unitPrice) : '—'}
            </p>
            <p className="text-[11px] text-slate-500">للقطعة شاملة الضريبة</p>
          </div>
          <button
            onClick={handleAdd}
            disabled={!item.priceable || (item.availableQty ?? 0) <= 0}
            className={cn(
              'flex size-9 items-center justify-center rounded-lg text-white transition disabled:bg-slate-300',
              added ? 'bg-emerald-600' : 'bg-brand-600 hover:bg-brand-700',
            )}
            title="أضف إلى السلة"
          >
            {added ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          {item.priceable
            ? itemRangeLabel(item) ?? `متاح: ${item.availableQty ?? 0} قطعة`
            : item.priceable === false && item.pricePerGram === null
              ? 'لا يتوفر سعر اليوم'
              : 'غير متاح'}
        </p>
      </div>
    </div>
  );
}
