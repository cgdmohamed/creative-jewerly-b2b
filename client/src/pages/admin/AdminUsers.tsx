import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, UserCheck, UserX, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { AdminUser, Order } from '@/lib/types';
import { money, statusLabel, formatDate, STATUS_META } from '@/lib/format';
import { Badge, Button, EmptyState, ErrorBox, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const USER_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  active: { label: 'نشط', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  disabled: { label: 'موقوف', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export default function AdminUsers() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'disabled'>('all');
  const [openUser, setOpenUser] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi<{ users: AdminUser[] }>('/api/admin/users'),
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'approve' | 'disable' | 'enable' }) =>
      adminApi(`/api/admin/users/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const history = useQuery({
    queryKey: ['admin-user-orders', openUser],
    queryFn: () => adminApi<{ orders: Order[] }>(`/api/admin/users/${openUser}/orders`),
    enabled: openUser != null,
  });

  const users = (data?.users ?? []).filter((u) => filter === 'all' || u.status === filter);
  const counts = {
    all: data?.users.length ?? 0,
    pending: data?.users.filter((u) => u.status === 'pending').length ?? 0,
    active: data?.users.filter((u) => u.status === 'active').length ?? 0,
    disabled: data?.users.filter((u) => u.status === 'disabled').length ?? 0,
  };
  const userOrders = history.data?.orders ?? [];
  const openUserRecord = data?.users.find((u) => u.id === openUser);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900">عملاء الجملة</h1>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {(['all', 'pending', 'active', 'disabled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              filter === f ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {f === 'all' ? 'الكل' : USER_META[f].label}
            <span className={cn('rounded-full px-1.5 text-[10px]', filter === f ? 'bg-white/20' : 'bg-slate-100')}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBox message={(error as Error).message} retry={refetch} />}

      {!isLoading && !error && users.length === 0 && (
        <EmptyState
          icon={<Users className="size-12 text-slate-300" />}
          title="لا يوجد عملاء"
          subtitle="ستظهر حسابات العملاء عند تسجيلهم في المتجر."
        />
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-extrabold text-slate-900">{u.name}</p>
                  <Badge className={cn('border', USER_META[u.status]?.cls)}>{USER_META[u.status].label}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {u.company && <span>{u.company} · </span>}
                  {u.email || 'بدون بريد'} {u.phone ? ` · ${u.phone}` : ''}
                </p>
                <p className="text-xs text-slate-400">
                  سجّل {formatDate(u.createdAt)} {u.orderCount ? `· ${u.orderCount} طلب` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpenUser(openUser === u.id ? null : u.id)}
                  className="px-3 py-2 text-xs"
                >
                  <ClipboardList className="size-4" />
                  الطلبات
                  <ChevronDown className={cn('size-3.5 transition-transform', openUser === u.id && 'rotate-180')} />
                </Button>
                {u.status === 'pending' && (
                  <Button onClick={() => act.mutate({ id: u.id, action: 'approve' })} disabled={act.isPending} className="px-3 py-2 text-xs">
                    <UserCheck className="size-4" />
                    موافقة
                  </Button>
                )}
                {u.status === 'active' && (
                  <Button variant="danger" onClick={() => act.mutate({ id: u.id, action: 'disable' })} disabled={act.isPending} className="px-3 py-2 text-xs">
                    <UserX className="size-4" />
                    إيقاف
                  </Button>
                )}
                {u.status === 'disabled' && (
                  <Button variant="outline" onClick={() => act.mutate({ id: u.id, action: 'enable' })} disabled={act.isPending} className="px-3 py-2 text-xs">
                    تفعيل
                  </Button>
                )}
              </div>
            </div>

            {openUser === u.id && (
              <div className="border-t border-slate-100 p-4">
                <p className="mb-3 text-sm font-extrabold text-slate-800">
                  طلبات {openUserRecord?.name ?? u.name}
                  <span className="mr-2 text-xs font-bold text-slate-400">{userOrders.length} طلب</span>
                </p>
                {history.isLoading && <Spinner label="جارٍ تحميل الطلبات…" />}
                {history.error && <ErrorBox message={(history.error as Error).message} retry={() => history.refetch()} />}
                {!history.isLoading && !history.error && userOrders.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">لا توجد طلبات لهذا العميل</p>
                )}
                <div className="space-y-2">
                  {userOrders.map((o) => (
                    <Link
                      key={o.id}
                      to="/admin/orders"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 transition hover:border-brand-300"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-800">{o.orderNo}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} قطعة
                          {o.invoiceNo ? ` · فاتورة ${o.invoiceNo}` : ''}
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
