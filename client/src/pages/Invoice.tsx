import PrefetchLink from '@/components/PrefetchLink';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import type { Order, ShopConfig } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { money, formatDate } from '@/lib/format';
import { RowsSkeleton, ErrorBox } from '@/components/ui';

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'كاش',
  transfer: 'تحويل بنكي',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
};

export default function Invoice() {
  const { id } = useParams();
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<{ order: Order }>(`/api/orders/${id}`),
    staleTime: 15_000,
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ShopConfig>('/api/config'),
    staleTime: 5 * 60_000,
  });

  if (!user) return <Navigate to={`/login?next=/orders/${id}/invoice`} replace />;
  if (isLoading) return <RowsSkeleton rows={4} />;
  if (error) return <ErrorBox message={(error as Error).message} retry={refetch} />;
  if (!data) return null;

  const order = data.order;

  if (!order.invoiceNo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4">
        <p className="text-lg font-extrabold text-slate-700">لا توجد فاتورة لهذا الطلب بعد</p>
        <p className="text-sm text-slate-500">تُنشأ الفاتورة عند تنفيذ الطلب من فريق المتجر.</p>
        <PrefetchLink to={`/orders/${order.id}`} className="text-sm font-bold text-brand-700 hover:underline">
          العودة للطلب
        </PrefetchLink>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <PrefetchLink to={`/orders/${order.id}`} className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-brand-700">
          <ArrowRight className="size-4" />
          العودة للطلب
        </PrefetchLink>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          <Printer className="size-4" />
          طباعة
        </button>
      </div>

      <div className="invoice-sheet mx-auto max-w-3xl bg-white p-8 shadow-sm print:max-w-none print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{config?.storeName ?? 'متجر الجملة'}</h1>
            <p className="mt-1 text-sm text-slate-600">فاتورة بيع بالجملة — ذهب وفضة</p>
          </div>
          <div className="text-left">
            <p className="text-lg font-extrabold text-slate-900">{order.invoiceNo}</p>
            <p className="text-sm text-slate-600">تاريخ: {formatDate(order.createdAt)}</p>
            <p className="text-sm text-slate-600">حالة: مكتمل</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-extrabold text-slate-900">العميل</p>
            <p className="text-slate-700">{order.customerName}</p>
            {order.company && <p className="text-slate-600">{order.company}</p>}
            {order.customerPhone && <p className="text-slate-600" dir="ltr">{order.customerPhone}</p>}
            {order.email && <p className="text-slate-600" dir="ltr">{order.email}</p>}
          </div>
          <div className="text-right">
            <p className="font-extrabold text-slate-900">طريقة الدفع</p>
            <p className="text-slate-700">{PAYMENT_LABEL[order.paymentMethod ?? ''] ?? order.paymentMethod}</p>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900 text-right">
              <th className="py-2 pr-1 font-extrabold text-slate-900">الكود</th>
              <th className="py-2 font-extrabold text-slate-900">البيان</th>
              <th className="py-2 font-extrabold text-slate-900">الوزن</th>
              <th className="py-2 font-extrabold text-slate-900">الكمية</th>
              <th className="py-2 font-extrabold text-slate-900">السعر</th>
              <th className="py-2 pl-1 text-left font-extrabold text-slate-900">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.itemId} className="border-b border-slate-200">
                <td className="py-2 pr-1 font-bold text-slate-800" dir="ltr">{it.code}</td>
                <td className="py-2 text-slate-700">
                  {it.name || it.code}
                  {it.carat ? ` — ${it.carat}` : ''}
                </td>
                <td className="py-2 text-slate-700">{it.weightG} جم</td>
                <td className="py-2 text-slate-700">{it.quantity}</td>
                <td className="py-2 text-slate-700">{money((it.metalTotal + it.craftsmanship) / it.quantity)}</td>
                <td className="py-2 pl-1 text-left font-bold text-slate-900">{money(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 mr-auto w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>قيمة المعدن</dt>
            <dd>{money(order.metalSubtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>المصنعية</dt>
            <dd>{money(order.craftsmanshipTotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>الضريبة</dt>
            <dd>{money(order.vatAmount)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-extrabold text-slate-900">
            <dt>الإجمالي</dt>
            <dd>{money(order.totalValue)}</dd>
          </div>
          {order.downPayment > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>المدفوع</dt>
              <dd>{money(order.downPayment)}</dd>
            </div>
          )}
          {order.remainingDue > 0 && (
            <div className="flex justify-between font-bold text-slate-800">
              <dt>المتبقي</dt>
              <dd>{money(order.remainingDue)}</dd>
            </div>
          )}
        </dl>

        <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-xs text-slate-500">
          شكرًا لتعاملكم معنا — {config?.storeName ?? 'متجر الجملة'}
        </footer>
      </div>
    </div>
  );
}
