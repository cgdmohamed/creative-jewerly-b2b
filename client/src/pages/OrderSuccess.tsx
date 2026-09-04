import PrefetchLink from '@/components/PrefetchLink';
import { Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui';
import OrderSummary from '@/components/OrderSummary';

export default function OrderSuccess() {
  const location = useLocation();
  const { user } = useAuth();
  const order = (location.state as { order?: Order } | null)?.order;

  if (!order) {
    return <Navigate to={user ? '/orders' : '/track'} replace />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-14 text-emerald-600" />
        <h1 className="text-2xl font-extrabold text-emerald-900">تم استلام طلبك!</h1>
        <p className="mt-2 text-sm text-emerald-700">
          رقم الطلب <span className="font-extrabold">{order.orderNo}</span> — القطع محجوزة باسمك.
        </p>
        <p className="mt-1 text-xs text-emerald-600">
          سيتواصل معك فريق المتجر لتأكيد الطلب وترتيب التحصيل أو الشحن.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <PrefetchLink to={user ? `/orders/${order.id}` : '/track'}>
            <Button className="bg-emerald-700 hover:bg-emerald-800">
              عرض تفاصيل الطلب
            </Button>
          </PrefetchLink>
          <PrefetchLink to="/products">
            <Button variant="outline">مواصلة التسوق</Button>
          </PrefetchLink>
        </div>
      </div>

      <OrderSummary order={order} showHeader={false} />
    </div>
  );
}
