import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Coins, PackageOpen, TrendingUp } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { Order, RatePoint } from '@/lib/types';
import { money, statusLabel, formatDate, STATUS_META } from '@/lib/format';
import { Badge, Spinner, ErrorBox } from '@/components/ui';
import RateChart from '@/components/RateChart';
import { cn } from '@/lib/cn';

const DAYS = 30;

export default function AdminDashboard() {
  const [days, setDays] = useState(DAYS);

  const orders = useQuery({
    queryKey: ['admin-orders', 'all'],
    queryFn: () => adminApi<{ orders: Order[] }>('/api/admin/orders'),
  });

  const rates = useQuery({
    queryKey: ['admin-rates-history', days],
    queryFn: () => adminApi<{ history: RatePoint[] }>(`/api/admin/rates/history?days=${days}`),
  });

  const all = orders.data?.orders ?? [];
  const counts = {
    pending: all.filter((o) => o.status === 'pending').length,
    confirmed: all.filter((o) => o.status === 'confirmed').length,
    completed: all.filter((o) => o.status === 'completed').length,
    cancelled: all.filter((o) => o.status === 'cancelled').length,
  };
  const revenue = all.filter((o) => o.status === 'completed').reduce((s, o) => s + o.totalValue, 0);
  const pendingOrders = all.filter((o) => o.status === 'pending').slice(0, 6);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">لوحة التحكم</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="طلبات قيد المراجعة" value={counts.pending} cls="border-amber-200 bg-amber-50 text-amber-800" to="/admin/orders" />
        <StatCard label="مؤكد قيد التنفيذ" value={counts.confirmed} cls="border-sky-200 bg-sky-50 text-sky-800" to="/admin/orders" />
        <StatCard label="طلبات مكتملة" value={counts.completed} cls="border-emerald-200 bg-emerald-50 text-emerald-800" to="/admin/orders" />
        <StatCard label="إجمالي المبيعات (مكتمل)" value={money(revenue)} cls="border-brand-200 bg-brand-50 text-brand-800" to="/admin/orders" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-brand-600" />
            <h2 className="text-base font-extrabold text-slate-900">حركة أسعار المعدن</h2>
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-bold transition-colors',
                  days === d ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {d} يوم
              </button>
            ))}
          </div>
        </div>
        {rates.isLoading && <Spinner label="جارٍ تحميل الأسعار…" />}
        {rates.error && <ErrorBox message={(rates.error as Error).message} retry={() => rates.refetch()} />}
        {!rates.isLoading && !rates.error && (
          <RateChart points={rates.data?.history ?? []} days={days} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <PackageOpen className="size-4 text-brand-600" />
              أحدث الطلبات قيد المراجعة
            </h2>
            <Link to="/admin/orders" className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
              الكل
              <ArrowLeft className="size-3.5" />
            </Link>
          </div>
          {orders.isLoading && <Spinner label="جارٍ التحميل…" />}
          {orders.error && <ErrorBox message={(orders.error as Error).message} retry={() => orders.refetch()} />}
          {!orders.isLoading && !orders.error && pendingOrders.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">لا توجد طلبات بانتظار المراجعة</p>
          )}
          <div className="space-y-2">
            {pendingOrders.map((o) => (
              <Link
                key={o.id}
                to="/admin/orders"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 transition hover:border-brand-300"
              >
                <div>
                  <p className="text-sm font-extrabold text-slate-800">{o.orderNo}</p>
                  <p className="text-xs text-slate-500">
                    {o.customerName} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-brand-700">{money(o.totalValue)}</span>
                  <Badge className={cn('border', STATUS_META[o.status]?.cls)}>{statusLabel(o.status)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
            <Coins className="size-4 text-brand-600" />
            ملخص سريع
          </h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="إجمالي الطلبات" value={all.length} />
            <Row label="قيد المراجعة" value={counts.pending} />
            <Row label="مؤكدة" value={counts.confirmed} />
            <Row label="مرفوضة" value={all.filter((o) => o.status === 'rejected').length} />
            <Row label="ملغاة" value={counts.cancelled} />
            <Row label="قيمة المبيعات المكتملة" value={money(revenue)} strong />
          </dl>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <ClipboardList className="mb-1 size-4 text-brand-500" />
            عند تأكيد طلب تُحجز القطع من المخزون؛ عند التنفيذ تُنشأ الفاتورة بسعر اليوم ويُحصل المتبقي.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, cls, to }: { label: string; value: React.ReactNode; cls: string; to: string }) {
  return (
    <Link to={to} className={cn('rounded-2xl border p-4 transition hover:shadow-sm', cls)}>
      <p className="text-xs font-bold opacity-80">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </Link>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('font-bold', strong ? 'text-brand-700' : 'text-slate-800')}>{value}</dd>
    </div>
  );
}
