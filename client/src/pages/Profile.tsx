import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, Save, UserRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { ShopUser } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { Button, Field, Input } from '@/components/ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    company: user?.company ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return <Navigate to="/login?next=/profile" replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = useMutation({
    mutationFn: () =>
      api<{ user: ShopUser }>('/api/auth/me', {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          company: form.company.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      setUser(res.user);
      setProfileMsg({ ok: true, text: 'تم حفظ البيانات' });
    },
    onError: (e) => {
      const map: Record<string, string> = {
        'email.duplicate': 'البريد الإلكتروني مستخدم مسبقًا',
        'phone.duplicate': 'رقم الهاتف مستخدم مسبقًا',
        'missing.email.or.phone': 'أدخل البريد أو الهاتف',
      };
      setProfileMsg({ ok: false, text: map[(e as ApiError).message] ?? 'تعذر الحفظ' });
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api('/api/auth/me/password', { method: 'POST', body: pw }),
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '' });
      setPwMsg({ ok: true, text: 'تم تغيير كلمة المرور' });
    },
    onError: (e) => {
      const map: Record<string, string> = {
        'bad.currentPassword': 'كلمة المرور الحالية غير صحيحة',
        'bad.password': 'كلمة المرور الجديدة 4 أحرف على الأقل',
      };
      setPwMsg({ ok: false, text: map[(e as ApiError).message] ?? 'تعذر التغيير' });
    },
  });

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setProfileMsg({ ok: false, text: 'أدخل الاسم' });
    if (!form.email.trim() && !form.phone.trim()) return setProfileMsg({ ok: false, text: 'أدخل البريد أو الهاتف' });
    saveProfile.mutate();
  };

  const submitPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword.length < 4) return setPwMsg({ ok: false, text: 'كلمة المرور الجديدة 4 أحرف على الأقل' });
    changePassword.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">حسابي</h1>

      <form onSubmit={submitProfile} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">بياناتي</h2>
            <p className="text-xs text-slate-500">تظهر هذه البيانات في طلباتك ويتم التواصل عبر الهاتف أو البريد</p>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="الاسم *">
            <Input value={form.name} onChange={set('name')} autoFocus />
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
          {profileMsg && (
            <p className={`rounded-lg border p-3 text-sm font-bold ${profileMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {profileMsg.text}
            </p>
          )}
          <Button type="submit" loading={saveProfile.isPending}>
            <Save className="size-4" />
            حفظ البيانات
          </Button>
        </div>
      </form>

      <form onSubmit={submitPw} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">تغيير كلمة المرور</h2>
            <p className="text-xs text-slate-500">4 أحرف على الأقل</p>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="كلمة المرور الحالية">
            <Input type="password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label="كلمة المرور الجديدة">
            <Input type="password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} placeholder="••••••••" />
          </Field>
          {pwMsg && (
            <p className={`rounded-lg border p-3 text-sm font-bold ${pwMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" loading={changePassword.isPending}>
            <KeyRound className="size-4" />
            تغيير كلمة المرور
          </Button>
        </div>
      </form>
    </div>
  );
}
