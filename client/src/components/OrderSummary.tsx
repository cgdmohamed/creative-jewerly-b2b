import PrefetchLink from '@/components/PrefetchLink';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import type { Order } from '@/lib/types';
import { money, statusLabel, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ProductImage } from '@/components/ProductCard';

const STATUS_BADGE: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-sky-200 bg-sky-50 text-sky-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-600',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-slate-300 bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn('border', STATUS_BADGE[status] ?? 'border-slate-200 bg-slate-50 text-slate-600')}>{statusLabel(status)}</Badge>;
}

export default function OrderSummary({ order, showHeader = true }: { order: Order; showHeader?: boolean }) {
  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">طلب {order.orderNo}</h1>
            <p className="text-xs text-slate-500">
              تاريخ الطلب: {formatDate(order.createdAt)}
              {order.customerName ? ` — باسم ${order.customerName}` : ''}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {order.items.map((it) => (
            <li key={it.itemId} className="flex items-center gap-3 p-3">
              {it.photoUrl ? (
                <ProductImage
                  item={{ ...it, photoUrl: it.photoUrl, metalType: it.metalType as 'gold' | 'silver' } as any}
                  className="size-14 rounded-lg"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-lg bg-brand-50 text-sm font-extrabold text-brand-300">
                  {it.code.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-slate-800">{it.name || it.code}</p>
                <p className="text-xs text-slate-500">
                  {it.code} · {it.carat ?? ''} · {it.weightG} جم × {it.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-extrabold text-brand-700">
                {money(it.lineTotal)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="space-y-1.5 border-t border-slate-200 p-4 text-sm">
          <div className="flex justify-between text-slate-500">
            <dt>قيمة المعدن</dt>
            <dd>{money(order.metalSubtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-500">
            <dt>المصنعية</dt>
            <dd>{money(order.craftsmanshipTotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-500">
            <dt>الضريبة</dt>
            <dd>{money(order.vatAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold">
            <dt>إجمالي الطلب</dt>
            <dd>{money(order.totalValue)}</dd>
          </div>
          {order.downPayment > 0 && (
            <div className="flex justify-between text-brand-700">
              <dt>العربون المدفوع عند الطلب</dt>
              <dd className="font-bold">{money(order.downPayment)}</dd>
            </div>
          )}
          {order.remainingDue > 0 && (
            <div className="flex justify-between text-slate-700">
              <dt>المتبقي عند التحصيل</dt>
              <dd className="font-bold">{money(order.remainingDue)}</dd>
            </div>
          )}
        </dl>
      </div>

      {order.status === 'pending' && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>
            طلبك قيد المراجعة. القطع محجوزة من المخزون باسمك، وسيتواصل معك فريق المتجر
            لتأكيد الطلب وترتيب التحصيل أو الشحن.
          </p>
        </div>
      )}

      {order.status === 'rejected' && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <XCircle className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-bold">لم يتم تأكيد الطلب.</span>{' '}
            {order.rejectReason ? `السبب: ${order.rejectReason}` : 'تواصل مع المتجر لمعرفة التفاصيل.'}{' '}
            يمكنك تعديل الطلب أو اختيار قطع أخرى.
          </p>
        </div>
      )}

      {order.notes && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-bold">ملاحظاتك:</span> {order.notes}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {order.invoiceNo && (
          <PrefetchLink
            to={`/orders/${order.id}/invoice`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <FileText className="size-4" />
            عرض الفاتورة
          </PrefetchLink>
        )}
        <PrefetchLink to="/products" className="text-sm font-bold text-brand-700 hover:underline">
          مواصلة التسوق
        </PrefetchLink>
        {!showHeader && (
          <PrefetchLink to="/orders" className="text-sm font-bold text-slate-500 hover:underline">
            كل طلباتي
          </PrefetchLink>
        )}
      </div>
    </div>
  );
}
