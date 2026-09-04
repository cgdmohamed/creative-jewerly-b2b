import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Clock } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/orders';
  const [registered, setRegistered] = useState(false);

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('أدخل اسمك');
    if (!form.email.trim() && !form.phone.trim()) return setError('أدخل البريد أو الهاتف');
    if (form.password.length < 4) return setError('كلمة المرور 4 أحرف على الأقل');
    setLoading(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      if (useAuth.getState().user?.status === 'pending') {
        setRegistered(true);
      } else {
        navigate(next);
      }
    } catch (err) {
      const map: Record<string, string> = {
        'email.duplicate': 'البريد الإلكتروني مستخدم مسبقًا',
        'phone.duplicate': 'رقم الهاتف مستخدم مسبقًا',
        'missing.name.or.password': 'أدخل الاسم وكلمة المرور',
        'missing.email.or.phone': 'أدخل البريد أو الهاتف',
      };
      setError(map[(err as ApiError).message] ?? 'تعذر إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      {registered ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <Clock className="size-6" />
          </span>
          <h1 className="text-lg font-extrabold text-slate-900">تم استلام طلب الحساب</h1>
          <p className="mt-2 text-sm text-slate-600">
            حسابك قيد المراجعة من فريق المتجر. بمجرد الموافقة عليه ستتمكن من وضع الطلبات.
            سنتواصل معك لتأكيد التفعيل.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">
            العودة إلى المتجر
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <UserPlus className="size-5" />
              </span>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">حساب عميل جملة</h1>
                <p className="text-xs text-slate-500">سجّل لتضع الطلبات وتتبعها</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <Field label="الاسم *">
                <Input value={form.name} onChange={set('name')} placeholder="الاسم الكامل" autoFocus />
              </Field>
              <Field label="الشركة / النشاط">
                <Input value={form.company} onChange={set('company')} placeholder="اسم الشركة (اختياري)" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="البريد الإلكتروني">
                  <Input dir="ltr" className="text-right" type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" />
                </Field>
                <Field label="الهاتف">
                  <Input dir="ltr" className="text-right" value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" />
                </Field>
              </div>
              <Field label="كلمة المرور *" hint="4 أحرف على الأقل">
                <Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
              </Field>
              {error && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                  {error}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full">
                إنشاء الحساب
              </Button>
            </form>
          </div>
          <p className="text-center text-sm text-slate-500">
            لديك حساب؟{' '}
            <Link to={`/login${next && next !== '/orders' ? `?next=${next}` : ''}`} className="font-bold text-brand-700 hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
