import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, PackageSearch, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Order } from '@/lib/types';
import { Button, Field, Input, ErrorBox, RowsSkeleton } from '@/components/ui';
import OrderSummary from '@/components/OrderSummary';

export default function Track() {
  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['track', submitted],
    queryFn: () =>
      api<{ order: Order }>('/api/orders/track', {
        method: 'POST',
        body: { orderNo, phone },
      }),
    enabled: !!submitted,
    retry: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNo.trim()) return;
    setSubmitted(orderNo.trim());
  };

  const cancel = async () => {
    if (!data || !window.confirm('هل تريد إلغاء الطلب؟ سيتحرر الحجز على القطع فوراً.')) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api<{ order: Order }>('/api/orders/track/cancel', {
        method: 'POST',
        body: { orderNo, phone },
      });
      queryClient.invalidateQueries({ queryKey: ['track', submitted] });
    } catch (err) {
      setCancelError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="text-center">
        <PackageSearch className="mx-auto mb-3 size-10 text-brand-500" />
        <h1 className="text-2xl font-extrabold text-slate-900">تتبع طلب</h1>
        <p className="mt-1 text-sm text-slate-500">
          أدخل رقم الطلب ورقم الهاتف المسجّل به لتتبع حالته دون تسجيل الدخول.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم الطلب">
            <Input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="ORD-20260809-0001"
              dir="ltr"
              className="text-right"
            />
          </Field>
          <Field label="الهاتف المسجّل">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              dir="ltr"
              className="text-right"
            />
          </Field>
        </div>
        <Button type="submit" className="mt-4 w-full">
          <Search className="size-4" />
          تتبع
        </Button>
      </form>

      {isLoading && <RowsSkeleton rows={2} className="mt-4" />}
      {error && submitted && (
        <ErrorBox message={(error as ApiError).status === 404 ? 'لم يتم العثور على الطلب بالبيانات المدخلة' : (error as Error).message} />
      )}
      {data && (
        <>
          <OrderSummary order={data.order} />
          {data.order.status !== 'cancelled' && data.order.status !== 'completed' && (
            <div className="flex items-center gap-3">
              <Button variant="danger" onClick={cancel} disabled={cancelling}>
                <XCircle className="size-4" />
                {cancelling ? 'جارٍ الإلغاء…' : 'إلغاء الطلب'}
              </Button>
              {cancelError && <ErrorBox message={cancelError} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
