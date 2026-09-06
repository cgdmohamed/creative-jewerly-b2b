type LazyModule = () => Promise<{ default: React.ComponentType<any> }>;

const ROUTE_PREFETCH: Array<[RegExp, LazyModule]> = [
  [/^\/products\/\d+\//, () => import('@/pages/Product')],
  [/^\/products\/\d+$/, () => import('@/pages/Product')],
  [/^\/products/, () => import('@/pages/Products')],
  [/^\/orders\/\d+\/invoice/, () => import('@/pages/Invoice')],
  [/^\/orders\/\d+/, () => import('@/pages/OrderDetail')],
  [/^\/orders/, () => import('@/pages/Orders')],
  [/^\/checkout/, () => import('@/pages/Checkout')],
  [/^\/cart/, () => import('@/pages/Cart')],
  [/^\/login/, () => import('@/pages/Login')],
  [/^\/register/, () => import('@/pages/Register')],
  [/^\/profile/, () => import('@/pages/Profile')],
  [/^\/track/, () => import('@/pages/Track')],
  [/^\/admin\/login/, () => import('@/pages/admin/AdminLogin')],
  [/^\/admin\/notifications/, () => import('@/pages/admin/AdminNotifications')],
  [/^\/admin\/reports/, () => import('@/pages/admin/AdminReports')],
  [/^\/admin\/wholesale/, () => import('@/pages/admin/AdminWholesale')],
  [/^\/admin\/users/, () => import('@/pages/admin/AdminUsers')],
  [/^\/admin\/orders/, () => import('@/pages/admin/AdminOrders')],
  [/^\/admin/, () => import('@/pages/admin/AdminLayout')],
  [/^\/$/, () => import('@/pages/Home')],
];

const pending = new Map<string, Promise<unknown>>();

/**
 * Fire-and-forget fetch of a route's JS chunk so navigation feels instant.
 * Safe to call repeatedly — a single in-flight promise is shared.
 */
export function prefetchRoute(pathname: string): void {
  for (const [re, load] of ROUTE_PREFETCH) {
    if (re.test(pathname)) {
      const existing = pending.get(re.source);
      if (existing) return;
      const p = load().catch(() => null);
      pending.set(re.source, p);
      return;
    }
  }
}
