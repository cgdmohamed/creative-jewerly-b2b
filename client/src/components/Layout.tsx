import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gem, ShoppingBag, User, LogOut, Package, Truck, Settings } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useCart } from '@/stores/cart';
import { api } from '@/lib/api';
import type { ShopConfig } from '@/lib/types';
import { cn } from '@/lib/cn';
import PrefetchLink from '@/components/PrefetchLink';
import { PageSkeleton } from '@/components/ui';

const NAV = [
  { to: '/', label: 'الرئيسية' },
  { to: '/products', label: 'المتجر' },
  { to: '/orders', label: 'طلباتي' },
  { to: '/track', label: 'تتبع طلب' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const count = useCart((s) => s.count());
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ShopConfig>('/api/config'),
    staleTime: 5 * 60_000,
  });
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <PrefetchLink to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Gem className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold text-brand-800">
                {config?.storeName ?? 'متجر الجملة'}
              </span>
              <span className="block text-[11px] text-slate-500">ذهب وفضة — بيع بالجملة</span>
            </span>
          </PrefetchLink>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <PrefetchLink
                key={n.to}
                to={n.to}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                  location.pathname === n.to
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {n.label}
              </PrefetchLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <PrefetchLink
              to="/cart"
              className="relative flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">السلة</span>
              {count > 0 && (
                <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-extrabold text-white">
                  {count}
                </span>
              )}
            </PrefetchLink>
            {user ? (
              <div className="relative flex items-center gap-2">
                <PrefetchLink
                  to="/orders"
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700"
                >
                  <User className="size-4" />
                  <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
                </PrefetchLink>
                <PrefetchLink
                  to="/profile"
                  title="حسابي"
                  className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  <Settings className="size-4" />
                </PrefetchLink>
                <button
                  onClick={logout}
                  title="تسجيل الخروج"
                  className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            ) : (
              <PrefetchLink
                to="/login"
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700"
              >
                <User className="size-4" />
                دخول
              </PrefetchLink>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-1.5 md:hidden">
          {NAV.map((n) => (
            <PrefetchLink
              key={n.to}
              to={n.to}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold',
                location.pathname === n.to ? 'bg-brand-50 text-brand-700' : 'text-slate-600',
              )}
            >
              {n.label}
            </PrefetchLink>
          ))}
        </nav>
      </header>

      {user?.status === 'pending' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-bold text-amber-800">
          حسابك قيد المراجعة — بمجرد موافقة فريق المتجر سيتمكن من وضع الطلبات.
        </div>
      )}
      {user?.status === 'disabled' && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm font-bold text-rose-700">
          تم إيقاف حسابك. تواصل مع المتجر لمعرفة التفاصيل.
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gem className="size-4 text-brand-500" />
            <span>{config?.storeName ?? 'متجر الجملة'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Package className="size-4" />
              حجز فوري للمخزون
            </span>
            <span className="flex items-center gap-1">
              <Truck className="size-4" />
              تأكيد من فريق المتجر
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
