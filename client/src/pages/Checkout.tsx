import { useState } from 'react';
import PrefetchLink from '@/components/PrefetchLink';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock, UserRound } from 'lucide-react';
import { useCart, cartCount } from '@/stores/cart';
import { useAuth } from '@/stores/auth';
import { api, ApiError } from '@/lib/api';
import type { Order, ShopConfig } from '@/lib/types';
import { money } from '@/lib/format';
import { itemMinQty, itemMaxQty } from '@/lib/qty';
import { Button, Field, Input, Textarea } from '@/components/ui';

export default function Checkout() {
  const { lines, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ShopConfig>('/api/config'),
    staleTime: 5 * 60_000,
  });

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [company, setCompany] = useState(user?.company ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h1 className="text-lg font-extrabold">لا توجد عناصر للطلب</h1>
        <PrefetchLink to="/products" className="mt-3 inline-block text-sm font-bold text-brand-700">
          العودة إلى المتجر
        </PrefetchLink>
      </div>
    );
  }

  const needLogin = !user && !config?.guestOrderingEnabled;
  if (needLogin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Lock className="mx-auto mb-3 size-10 text-brand-500" />
        <h1 className="text-lg font-extrabold">تسجيل الدخول مطلوب للطلب</h1>
        <p className="mt-2 text-sm text-slate-500">
          الطلبات في المتجر متاحة لعملاء الجملة المسجلين حاليًا. سجّل دخولك أو أنشئ حسابًا.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <PrefetchLink to="/login?next=/checkout">
            <Button>دخول</Button>
          </PrefetchLink>
          <PrefetchLink to="/register?next=/checkout">
            <Button variant="outline">إنشاء حساب</Button>
          </PrefetchLink>
        </div>
      </div>
    );
  }

  const vatPercent = lines[0]?.item.vatPercent ?? 0;
  const metalSubtotal = lines.reduce((s, l) => s + l.item.unitMetal * l.quantity, 0);
  const craftTotal = lines.reduce((s, l) => s + l.item.unitCraft * l.quantity, 0);
  const vatAmount = ((metalSubtotal + craftTotal) * vatPercent) / 100;
  const total = metalSubtotal + craftTotal + vatAmount;
  const downPayment = (total * (config?.downPaymentPercent ?? 0)) / 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError('يرجى إدخال الاسم ووسيلة تواصل (هاتف أو بريد)');
      return;
    }
    const below = lines.find((l) => l.quantity < itemMinQty(l.item));
    if (below) {
      setError(`الحد الأدنى لطلب "${below.item.name || below.item.code}" هو ${itemMinQty(below.item)} قطعة — عدّل الكمية من السلة.`);
      return;
    }
    const above = lines.find((l) => l.quantity > itemMaxQty(l.item));
    if (above) {
      setError(`الكمية المطلوبة من "${above.item.name || above.item.code}" تتجاوز المتاح (${itemMaxQty(above.item)} قطعة) — عدّل الكمية من السلة.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: {
          items: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
          customer: { name, phone, email, company },
          notes,
        },
      });
      clear();
      navigate('/order-success', { state: { order: res.order } });
    } catch (err) {
      const e = err as ApiError;
      const map: Record<string, string> = {
        'account.pending': 'حسابك قيد المراجعة ولم يتم تفعيله بعد. سنتواصل معك فور الموافقة.',
        'account.disabled': 'تم إيقاف حسابك. تواصل مع المتجر لمعرفة التفاصيل.',
      };
      if (e.message.startsWith('items.below_min:')) {
        const [, , min] = e.message.split(':');
        setError(`الحد الأدنى للطلب من هذه القطعة هو ${min} قطعة.`);
      } else if (e.message.startsWith('items.not_available:')) {
        setError('الكمية المطلوبة أكبر من المتاح حاليًا — راجع سلتك أو تواصل معنا.');
      } else {
        setError(map[e.message] ?? (e.message || 'حدث خطأ أثناء تقديم الطلب'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          {user ? <UserRound className="size-5 text-brand-500" /> : <Lock className="size-5 text-slate-400" />}
          <h1 className="text-xl font-extrabold text-slate-900">
            {user ? `طلب باسم ${user.name}` : 'معلومات المشتري'}
          </h1>
        </div>
        {!user && config?.guestOrderingEnabled && (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            يمكنك الطلب كزائر الآن، أو{' '}
            <PrefetchLink to="/register" className="font-bold text-brand-700 hover:underline">
              إنشاء حساب
            </PrefetchLink>{' '}
            لتتبع طلباتك بسهولة.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم / اسم الجهة" />
          </Field>
          <Field label="الشركة / النشاط">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="اسم الشركة (اختياري)" />
          </Field>
          <Field label="الهاتف *" hint="مطلوب للتواصل وتأكيد الطلب">
            <Input dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input dir="ltr" className="text-right" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي تفاصيل إضافية للطلب (اختياري)" />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          تأكيد الطلب — {money(total, config?.currency)}
        </Button>
        <p className="text-center text-xs text-slate-400">
          بتأكيدك الطلب، يحجز المتجر القطع باسمك. التفاصيل النهائية للتحصيل تتم من فريق المتجر.
        </p>
      </form>

      <div className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-extrabold text-slate-900">الطلب ({cartCount(lines)} قطعة)</h2>
        <ul className="space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.item.id} className="flex justify-between gap-2">
              <span className="truncate text-slate-600">
                {l.item.name || l.item.code} × {l.quantity}
              </span>
              <span className="shrink-0 font-bold">
                {money(l.item.unitPrice * l.quantity, config?.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>قيمة المعدن</span>
            <span>{money(metalSubtotal, config?.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>المصنعية</span>
            <span>{money(craftTotal, config?.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>الضريبة ({vatPercent}%)</span>
            <span>{money(vatAmount, config?.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold">
            <span>الإجمالي</span>
            <span>{money(total, config?.currency)}</span>
          </div>
          {(config?.downPaymentPercent ?? 0) > 0 && (
            <div className="rounded-lg bg-brand-50 p-2.5 text-xs text-brand-800">
              عربون مطلوب عند الطلب: {money(downPayment, config?.currency)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
