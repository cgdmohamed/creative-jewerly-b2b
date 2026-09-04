import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackageOpen } from 'lucide-react';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { money, formatDate } from '@/lib/format';
import { ErrorBox, EmptyState, RowsSkeleton } from '@/components/ui';
import { StatusBadge } from '@/components/OrderSummary';
import PrefetchLink from '@/components/PrefetchLink';

export default function Orders() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api<{ orders: Order[] }>('/api/orders'),
    staleTime: 15_000,
  });

  if (!user) return <Navigate to="/login?next=/orders" replace />;
  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">طلباتي</h1>

      {isLoading && <RowsSkeleton rows={3} />}
      {error && <ErrorBox message={(error as Error).message} retry={refetch} />}

      {!isLoading && !error && orders.length === 0 && (
        <EmptyState
          icon={<PackageOpen className="size-12 text-slate-300" />}
          title="لا توجد طلبات بعد"
          subtitle="ابدأ بتصفح المخزون ووضع أول طلب جملة."
          action={
            <PrefetchLink to="/products" className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
              تصفح المتجر
            </PrefetchLink>
          }
        />
      )}

      <div className="space-y-3">
        {orders.map((o) => (
          <PrefetchLink
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">{o.orderNo}</p>
              <p className="text-xs text-slate-500">
                {formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} قطعة
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-extrabold text-brand-700">{money(o.totalValue)}</span>
              <StatusBadge status={o.status} />
            </div>
          </PrefetchLink>
        ))}
      </div>
    </div>
  );
}
