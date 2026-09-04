import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { ApiError } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/orders';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate(next);
    } catch (err) {
      const map: Record<string, string> = {
        'auth.invalid': 'البيانات غير صحيحة',
        'auth.missing': 'أدخل البريد/الهاتف وكلمة المرور',
      };
      setError(map[(err as ApiError).message] ?? 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <UserRound className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">تسجيل الدخول</h1>
            <p className="text-xs text-slate-500">حساب عميل الجملة</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="البريد الإلكتروني أو الهاتف">
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@company.com أو 01xxxxxxxxx"
              autoFocus
            />
          </Field>
          <Field label="كلمة المرور">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
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
      </div>
      <p className="text-center text-sm text-slate-500">
        ليس لديك حساب؟{' '}
        <Link to={`/register${next && next !== '/orders' ? `?next=${next}` : ''}`} className="font-bold text-brand-700 hover:underline">
          سجّل كعميل جملة
        </Link>
      </p>
      <p className="text-center text-sm text-slate-500">
        <Link to="/admin/login" className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:underline">
          <ShieldCheck className="size-4" /> دخول فريق العمل
        </Link>
      </p>
    </div>
  );
}
