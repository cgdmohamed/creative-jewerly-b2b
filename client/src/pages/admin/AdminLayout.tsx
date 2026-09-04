import { Suspense, useEffect } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BarChart3, ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAdmin } from '@/stores/admin';
import { adminApi } from '@/lib/api';
import type { ShopNotification } from '@/lib/types';
import { cn } from '@/lib/cn';
import { PageSkeleton } from '@/components/ui';

const NAV = [
  { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'الطلبات', icon: ClipboardList },
  { to: '/admin/users', label: 'العملاء', icon: Users },
  { to: '/admin/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/admin/notifications', label: 'التنبيهات', icon: Bell },
];

export default function AdminLayout() {
  const { admin, token, logout } = useAdmin();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => adminApi<{ notifications: ShopNotification[] }>('/api/admin/notifications?limit=8'),
    refetchInterval: 30_000,
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }), 60_000);
    return () => clearInterval(t);
  }, [token, queryClient]);

  const unread = data?.notifications.filter((n) => n.status === 'unread').length ?? 0;

  if (!admin || !token) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 right-0 z-40 flex w-60 flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-extrabold text-slate-900">إدارة المتجر</span>
            <span className="block text-[11px] text-slate-500">{admin.fullName}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
              {n.to === '/admin/notifications' && unread > 0 && (
                <span className="mr-auto flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white">
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="size-4" />
            تسجيل الخروج
          </button>
          <Link
            to="/"
            className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            <ShieldCheck className="size-3.5" />
            عرض المتجر العام
          </Link>
        </div>
      </aside>

      <main className="mr-60 flex-1 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <div className="sr-only">{location.pathname}</div>
    </div>
  );
}
