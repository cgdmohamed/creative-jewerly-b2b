import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCart, cartCount } from '@/stores/cart';
import { api } from '@/lib/api';
import type { CatalogResponse, ShopConfig } from '@/lib/types';
import { money } from '@/lib/format';
import { itemMinQty, itemMaxQty, itemRangeLabel } from '@/lib/qty';
import { ProductImage } from '@/components/ProductCard';
import { Button, EmptyState } from '@/components/ui';
import PrefetchLink from '@/components/PrefetchLink';

export default function Cart() {
  const { lines, setQuantity, remove, clear } = useCart();
  const navigate = useNavigate();
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ShopConfig>('/api/config'),
    staleTime: 5 * 60_000,
  });
  const { data: catalog } = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<CatalogResponse>('/api/catalog'),
    staleTime: 60_000,
  });

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-12 text-slate-300" />}
        title="سلتك فارغة"
        subtitle="تصفح المخزون المتاح وأضف القطع التي تحتاجها لطلب الجملة."
        action={
          <PrefetchLink to="/products">
            <Button>تصفح المتجر</Button>
          </PrefetchLink>
        }
      />
    );
  }

  const count = cartCount(lines);
  const vatPercent = lines[0]?.item.vatPercent ?? 0;
  const metalSubtotal = lines.reduce((s, l) => s + l.item.unitMetal * l.quantity, 0);
  const craftTotal = lines.reduce((s, l) => s + l.item.unitCraft * l.quantity, 0);
  const vatAmount = ((metalSubtotal + craftTotal) * vatPercent) / 100;
  const total = metalSubtotal + craftTotal + vatAmount;
  const downPayment = ((total * (config?.downPaymentPercent ?? 0)) / 100);

  const currentPrices = new Map((catalog?.items ?? []).map((it) => [it.id, it.unitPrice]));
  const changedLines = lines.filter((l) => {
    const cur = currentPrices.get(l.item.id);
    return cur != null && Math.abs(cur - l.item.unitPrice) > 0.01;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">سلة الطلب</h1>
        <button
          onClick={clear}
          className="text-sm font-bold text-rose-600 hover:text-rose-700"
        >
          إفراغ السلة
        </button>
      </div>

      {changedLines.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-bold">تغيّرت الأسعار</span> في {changedLines.length} قطعة منذ إضافتها
            للسلة. سعر الطلب يُحتسب بسعر المعدن وقت تأكيد فريق المتجر للطلب.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          {lines.map((l) => (
            <div
              key={l.item.id}
              className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:gap-4"
            >
              <PrefetchLink to={`/products/${l.item.id}`} className="shrink-0">
                <ProductImage item={l.item} className="size-20 rounded-xl" />
              </PrefetchLink>
              <div className="min-w-0 flex-1">
                <PrefetchLink to={`/products/${l.item.id}`}>
                  <h3 className="line-clamp-2 text-sm font-extrabold text-slate-800">
                    {l.item.name || l.item.code}
                  </h3>
                </PrefetchLink>
                <p className="break-words text-xs text-slate-500">
                  {l.item.code} · {l.item.carat ?? ''} · {money(l.item.unitPrice, config?.currency)}
                </p>
                <p className="mt-1 text-sm font-extrabold text-brand-700">
                  {money(l.item.unitPrice * l.quantity, config?.currency)}
                </p>
                <p className="text-[11px] text-slate-400">{itemRangeLabel(l.item)}</p>
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end sm:justify-start">
                <button
                  onClick={() => remove(l.item.id)}
                  className="text-slate-400 transition hover:text-rose-600"
                  title="حذف"
                >
                  <Trash2 className="size-4" />
                </button>
                <div className="flex items-center rounded-lg border border-slate-300">
                  <button
                    onClick={() => setQuantity(l.item.id, l.quantity + 1)}
                    disabled={l.quantity >= itemMaxQty(l.item)}
                    className="px-3 py-1 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    +
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
                  <button
                    onClick={() => setQuantity(l.item.id, l.quantity - 1)}
                    disabled={l.quantity <= itemMinQty(l.item)}
                    className="px-3 py-1 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    −
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold text-slate-900">ملخص الطلب</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">عدد القطع</dt>
              <dd className="font-bold">{count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">قيمة المعدن</dt>
              <dd className="font-bold">{money(metalSubtotal, config?.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">المصنعية</dt>
              <dd className="font-bold">{money(craftTotal, config?.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">الضريبة ({vatPercent}%)</dt>
              <dd className="font-bold">{money(vatAmount, config?.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-slate-900">
              <dt>الإجمالي</dt>
              <dd>{money(total, config?.currency)}</dd>
            </div>
            {(config?.downPaymentPercent ?? 0) > 0 && (
              <div className="rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
                مطلوب {config?.downPaymentPercent}% كعربون عند تقديم الطلب: {money(downPayment, config?.currency)}،
                والباقي عند التحصيل.
              </div>
            )}
          </dl>
          <Button className="w-full" onClick={() => navigate('/checkout')}>
            متابعة الطلب
          </Button>
          <PrefetchLink
            to="/products"
            className="flex items-center justify-center gap-1 text-sm font-bold text-slate-500 hover:text-brand-700"
          >
            <ArrowLeft className="size-4" />
            مواصلة التسوق
          </PrefetchLink>
        </div>
      </div>
    </div>
  );
}
