import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, PackageOpen } from 'lucide-react';
import { adminApi, ApiError } from '@/lib/api';
import type { Order, OrderEstimate } from '@/lib/types';
import { money, statusLabel, formatDate, STATUS_META } from '@/lib/format';
import { Badge, Button, EmptyState, ErrorBox, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const STATUSES = ['all', 'pending', 'confirmed', 'rejected', 'completed', 'cancelled'] as const;
const PAYMENT_METHODS: Record<string, string> = {
  cash: 'كاش',
  transfer: 'تحويل بنكي',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
};

interface Detail {
  order: Order;
  estimate: OrderEstimate | null;
}

const CAN_MANAGE: Record<string, string[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
};

export default function AdminOrders() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [action, setAction] = useState<'reject' | 'complete' | null>(null);
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const qs = new URLSearchParams();
  if (status !== 'all') qs.set('status', status);
  if (search.trim()) qs.set('q', search.trim());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-orders', status, search.trim()],
    queryFn: () => adminApi<{ orders: Order[] }>(`/api/admin/orders?${qs.toString()}`),
  });

  const { data: detail } = useQuery({
    queryKey: ['admin-order', openId],
    queryFn: () => adminApi<Detail>(`/api/admin/orders/${openId}`),
    enabled: openId != null,
  });

  const act = useMutation({
    mutationFn: async (payload: { id: number; action: 'confirm' | 'reject' | 'complete' | 'cancel'; body?: object }) =>
      adminApi<{ order: Order }>(`/api/admin/orders/${payload.id}/${payload.action}`, {
        method: 'POST',
        body: payload.body ?? {},
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-order', openId] });
      setActionOrder(null);
      setAction(null);
      setReason('');
    },
  });

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionOrder) return;
    if (action === 'reject' && !reason.trim()) return setActionError('أدخل سبب الرفض');
    setActionError(null);
    await act.mutateAsync({
      id: actionOrder.id,
      action: action === 'reject' ? 'reject' : 'complete',
      body: action === 'reject' ? { reason: reason.trim() } : { paymentMethod },
    }).catch((err) => setActionError((err as ApiError).message || 'فشلت العملية'));
  };

  const open = detail?.order;
  const estimate = detail?.estimate;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">الطلبات</h1>
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                status === s ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {s === 'all' ? 'الكل' : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث برقم الطلب أو اسم العميل أو الهاتف…"
        className="max-w-md"
      />

      {isLoading && <Spinner />}
      {error && <ErrorBox message={(error as Error).message} retry={refetch} />}

      {!isLoading && !error && (data?.orders.length ?? 0) === 0 && (
        <EmptyState
          icon={<PackageOpen className="size-12 text-slate-300" />}
          title="لا توجد طلبات"
          subtitle="ستظهر الطلبات الجديدة هنا فور وضع العملاء لها."
        />
      )}

      <div className="space-y-2">
        {data?.orders.map((o) => (
          <div key={o.id} className="rounded-2xl border border-slate-200 bg-white">
            <button
              onClick={() => setOpenId(openId === o.id ? null : o.id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-right"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{o.orderNo}</p>
                <p className="truncate text-xs text-slate-500">
                  {o.customerName || 'زائر'} {o.company ? `· ${o.company}` : ''} · {formatDate(o.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-brand-700">{money(o.totalValue)}</span>
                <Badge className={cn('border', STATUS_META[o.status]?.cls)}>{statusLabel(o.status)}</Badge>
                <ChevronDown className={cn('size-4 text-slate-400 transition-transform', openId === o.id && 'rotate-180')} />
              </div>
            </button>

            {openId === o.id && open && (
              <div className="border-t border-slate-100 p-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-3 lg:col-span-2">
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {open.items.map((it) => (
                        <li key={it.itemId} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-extrabold text-slate-800">{it.name || it.code}</p>
                            <p className="text-xs text-slate-500">
                              {it.code} · {it.carat ?? ''} · {it.weightG} جم × {it.quantity}
                            </p>
                          </div>
                          <span className="shrink-0 font-bold text-brand-700">{money(it.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
                      <div className="flex justify-between text-slate-500">
                        <span>قيمة المعدن</span>
                        <span>{money(open.metalSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>المصنعية</span>
                        <span>{money(open.craftsmanshipTotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>الضريبة</span>
                        <span>{money(open.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-extrabold">
                        <span>الإجمالي</span>
                        <span>{money(open.totalValue)}</span>
                      </div>
                      {open.downPayment > 0 && (
                        <div className="flex justify-between text-brand-700">
                          <span>العربون المدفوع</span>
                          <span className="font-bold">{money(open.downPayment)}</span>
                        </div>
                      )}
                      {open.remainingDue > 0 && (
                        <div className="flex justify-between">
                          <span>المتبقي عند التحصيل</span>
                          <span className="font-bold">{money(open.remainingDue)}</span>
                        </div>
                      )}
                      {open.invoiceNo && (
                        <div className="flex justify-between text-emerald-700">
                          <span>الفاتورة</span>
                          <span className="font-bold">{open.invoiceNo}</span>
                        </div>
                      )}
                      {open.rejectReason && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">
                          <span className="font-bold">سبب الرفض: </span>
                          {open.rejectReason}
                        </div>
                      )}
                    </div>

                    {open.notes && (
                      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        <span className="font-bold">ملاحظات العميل:</span> {open.notes}
                      </p>
                    )}
                    {open.customerPhone && (
                      <p className="text-xs text-slate-500">
                        هاتف: <span dir="ltr">{open.customerPhone}</span>
                        {open.email ? ` · بريد: ${open.email}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {estimate?.priceChanged && open.status === 'confirmed' && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <p className="font-bold">تغيّرت الأسعار عن وقت الطلب</p>
                        <p className="mt-1 text-xs">
                          القيمة الحالية المقدرة: {money(estimate.total)} (بدلاً من {money(open.totalValue)}).
                          عند التنفيذ سيتم احتسابها بسعر اليوم.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {(CAN_MANAGE[open.status] ?? []).includes('confirmed') && (
                        <Button onClick={() => act.mutate({ id: open.id, action: 'confirm' })} disabled={act.isPending}>
                          تأكيد الطلب
                        </Button>
                      )}
                      {(CAN_MANAGE[open.status] ?? []).includes('rejected') && (
                        <Button variant="outline" onClick={() => { setActionOrder(open); setAction('reject'); }}>
                          رفض الطلب
                        </Button>
                      )}
                      {(CAN_MANAGE[open.status] ?? []).includes('completed') && (
                        <Button onClick={() => { setActionOrder(open); setAction('complete'); }}>
                          تنفيذ وتحصيل الفاتورة
                        </Button>
                      )}
                      {(CAN_MANAGE[open.status] ?? []).includes('cancelled') && (
                        <Button variant="ghost" onClick={() => act.mutate({ id: open.id, action: 'cancel' })} disabled={act.isPending}>
                          إلغاء الطلب
                        </Button>
                      )}
                      {open.status === 'pending' && (
                        <p className="text-xs text-slate-500">
                          <ClipboardList className="inline size-3.5" /> القطع محجوزة من المخزون لحين الرد.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {actionOrder && action === 'reject' && (
        <Modal onClose={() => setActionOrder(null)} title={`رفض طلب ${actionOrder.orderNo}`}>
          <form onSubmit={submitAction} className="space-y-3">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب الرفض (يظهر للعميل)"
              autoFocus
            />
            {actionError && <p className="text-sm font-bold text-rose-600">{actionError}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="danger" loading={act.isPending} className="flex-1">
                تأكيد الرفض
              </Button>
              <Button type="button" variant="ghost" onClick={() => setActionOrder(null)}>
                إلغاء
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {actionOrder && action === 'complete' && (
        <Modal onClose={() => setActionOrder(null)} title={`تنفيذ طلب ${actionOrder.orderNo}`}>
          <form onSubmit={submitAction} className="space-y-3">
            <p className="text-sm text-slate-600">
              سيتم إنشاء الفاتورة بالأسعار الحالية وتحصيل المتبقي ({money(actionOrder.remainingDue)}).
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPaymentMethod(k)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors',
                    paymentMethod === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            {actionError && <p className="text-sm font-bold text-rose-600">{actionError}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={act.isPending} className="flex-1">
                إنشاء الفاتورة وتنفيذ الطلب
              </Button>
              <Button type="button" variant="ghost" onClick={() => setActionOrder(null)}>
                إلغاء
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-base font-extrabold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
