import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAdmin } from '@/stores/admin';
import { ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function AdminLogin() {
  const { admin, token, login } = useAdmin();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', pin: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (admin && token) return <Navigate to="/admin" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.identifier.trim()) return setError('أدخل اسم المستخدم أو البريد');
    if (!form.pin.trim()) return setError('أدخل الرقم السري');
    setLoading(true);
    setError(null);
    try {
      await login(form.identifier.trim(), form.pin);
      navigate('/admin');
    } catch (err) {
      const map: Record<string, string> = {
        'invalid.credentials': 'بيانات الدخول غير صحيحة',
        'auth.invalid': 'بيانات الدخول غير صحيحة',
        'rate.limited': 'محاولات كثيرة، انتظر قليلاً ثم حاول مرة أخرى',
      };
      setError(map[(err as ApiError).message] ?? 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">لوحة إدارة المتجر</h1>
            <p className="text-xs text-slate-500">دخول فريق العمل فقط</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="اسم المستخدم أو البريد">
            <Input dir="ltr" className="text-right" value={form.identifier} onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))} placeholder="username / email" autoFocus />
          </Field>
          <Field label="الرقم السري (PIN)">
            <Input type="password" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} placeholder="••••••" />
          </Field>
          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            دخول
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link to="/" className="font-bold text-slate-500 hover:underline">
            العودة إلى المتجر
          </Link>
        </p>
      </div>
    </div>
  );
}
