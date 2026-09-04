import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { ShopNotification } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button, EmptyState, ErrorBox, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const TYPE_META: Record<string, string> = {
  order_placed: 'bg-brand-50 text-brand-700',
  order_confirmed: 'bg-sky-50 text-sky-700',
  order_rejected: 'bg-rose-50 text-rose-700',
  order_completed: 'bg-emerald-50 text-emerald-700',
  order_cancelled: 'bg-slate-100 text-slate-600',
};

export default function AdminNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => adminApi<{ notifications: ShopNotification[] }>('/api/admin/notifications?limit=50'),
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: async () => adminApi('/api/admin/notifications/read', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const notifications = data?.notifications ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">التنبيهات</h1>
        <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending} className="px-3 py-2 text-xs">
          <CheckCheck className="size-4" />
          تعليم الكل كمقروء
        </Button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBox message={(error as Error).message} retry={refetch} />}

      {!isLoading && !error && notifications.length === 0 && (
        <EmptyState
          icon={<Bell className="size-12 text-slate-300" />}
          title="لا توجد تنبيهات"
          subtitle="ستظهر هنا إشعارات الطلبات والعملاء الجدد."
        />
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={cn(
              'rounded-2xl border p-4',
              n.status === 'unread' ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200 bg-white',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={cn('rounded-lg px-2 py-0.5 text-[11px] font-bold', TYPE_META[n.type] ?? 'bg-slate-100 text-slate-600')}>
                  {n.type}
                </span>
                {n.status === 'unread' && (
                  <span className="size-2 rounded-full bg-brand-600" title="غير مقروء" />
                )}
              </div>
              <span className="text-xs text-slate-400">{formatDate(n.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm font-extrabold text-slate-800">{n.subject}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{n.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
