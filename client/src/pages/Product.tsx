import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Package, Ruler, Weight, Sparkles, Coins, ShieldCheck, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { CatalogItem } from '@/lib/types';
import { money, metalColor, metalLabel, weight } from '@/lib/format';
import { itemMinQty, itemMaxQty, itemRangeLabel } from '@/lib/qty';
import { ProductImage } from '@/components/ProductCard';
import { Button, ErrorBox, Badge, ProductSkeleton } from '@/components/ui';
import { useCart } from '@/stores/cart';
import { cn } from '@/lib/cn';
import PrefetchLink from '@/components/PrefetchLink';

export default function Product() {
  const { id } = useParams();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);

  const { data: item, isLoading, error, refetch } = useQuery({
    queryKey: ['item', id],
    queryFn: () => api<CatalogItem>(`/api/catalog/${id}`),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (item) setQty(itemMinQty(item));
  }, [item?.id]);

  if (isLoading) return <ProductSkeleton />;
  if (error) return <ErrorBox message={(error as Error).message} retry={refetch} />;
  if (!item) return <ErrorBox message="القطعة غير موجودة" />;

  const minQty = itemMinQty(item);
  const maxQty = itemMaxQty(item);

  const handleAdd = () => {
    add(item, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="space-y-6">
      <PrefetchLink
        to="/products"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-brand-700"
      >
        <ArrowRight className="size-4" />
        العودة إلى المتجر
      </PrefetchLink>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <ProductImage item={item} className="aspect-square w-full" priority />
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('border', metalColor(item.metalType))}>{metalLabel(item.metalType)}</Badge>
              {item.carat && <Badge className="border-slate-200 bg-white text-slate-700">{item.carat}</Badge>}
              {item.physicalStatus === 'new' && (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">جديد</Badge>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{item.name || item.code}</h1>
            <p className="text-sm text-slate-500">رمز القطعة: {item.code}</p>
          </div>

          {item.description && <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <Weight className="mb-1 size-4 text-brand-500" />
              <p className="text-[11px] text-slate-500">الوزن</p>
              <p className="text-sm font-extrabold text-slate-800">{weight(item.weightG)}</p>
            </div>
            {item.size && (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <Ruler className="mb-1 size-4 text-brand-500" />
                <p className="text-[11px] text-slate-500">المقاس</p>
                <p className="text-sm font-extrabold text-slate-800">{item.size}</p>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <Package className="mb-1 size-4 text-brand-500" />
              <p className="text-[11px] text-slate-500">القسم</p>
              <p className="text-sm font-extrabold text-slate-800">{item.categoryName ?? '—'}</p>
            </div>
          </div>

          {item.priceable ? (
            <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">سعر القطعة (شامل الضريبة)</p>
                  <p className="text-3xl font-extrabold text-brand-800">{money(item.unitPrice)}</p>
                </div>
                <div className="text-left text-[11px] leading-5 text-slate-500">
                  <p>معدن: {money(item.unitMetal)}</p>
                  <p>مصنعية: {money(item.unitCraft)}</p>
                  <p>ضريبة {item.vatPercent}%: {money(item.unitPrice - item.unitMetal - item.unitCraft)}</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Coins className="size-3.5" />
                سعر الجرام اليوم: {money(item.pricePerGram ?? 0)}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              لم يُحدَّد سعر اليوم لهذا المعدن بعد — تواصل معنا لمعرفة السعر.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-slate-300 bg-white">
              <button
                onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
                className="px-4 py-2.5 text-lg font-bold text-slate-600 hover:bg-slate-50"
              >
                +
              </button>
              <span className="w-10 text-center text-sm font-extrabold">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.max(minQty, q - 1))}
                className="px-4 py-2.5 text-lg font-bold text-slate-600 hover:bg-slate-50"
              >
                −
              </button>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!item.priceable || maxQty <= 0}
              className={cn('flex-1 sm:flex-none sm:px-8', added && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {added ? <Check className="size-4" /> : <Sparkles className="size-4" />}
              {added ? 'أُضيفت إلى السلة' : 'أضف إلى السلة'}
            </Button>
          </div>

          {item.priceable && maxQty > 0 && (
            <p className="text-xs font-bold text-slate-500">
              {itemRangeLabel(item)}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="size-4 text-emerald-600" />
            الطلب يُرسل كحجز رسمي بجزء من المبلغ، ويؤكده فريق المتجر خلال ساعات العمل.
          </div>
        </div>
      </div>
    </div>
  );
}
