import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import ScrollToTop from '@/components/ScrollToTop';
import { PageSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { CatalogResponse, ShopConfig } from '@/lib/types';

const Home = lazy(() => import('@/pages/Home'));
const Products = lazy(() => import('@/pages/Products'));
const Product = lazy(() => import('@/pages/Product'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderSuccess = lazy(() => import('@/pages/OrderSuccess'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Orders = lazy(() => import('@/pages/Orders'));
const OrderDetail = lazy(() => import('@/pages/OrderDetail'));
const Profile = lazy(() => import('@/pages/Profile'));
const Track = lazy(() => import('@/pages/Track'));
const Invoice = lazy(() => import('@/pages/Invoice'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 10 * 60_000,
    },
  },
});

export default function App() {
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['config'],
      queryFn: () => api<ShopConfig>('/api/config'),
      staleTime: 5 * 60_000,
    });
    queryClient.prefetchQuery({
      queryKey: ['catalog'],
      queryFn: () => api<CatalogResponse>('/api/catalog'),
      staleTime: 60_000,
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ScrollToTop />
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<Product />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/track" element={<Track />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/orders/:id/invoice" element={<Invoice />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </QueryClientProvider>
  );
}
