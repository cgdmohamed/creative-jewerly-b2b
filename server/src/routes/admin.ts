import { Router } from 'express';
import { config } from '../config.js';
import { mainApi } from '../apiClient.js';
import { getCatalog } from '../catalogCache.js';
import { signAdminToken, requireAdmin, type ShopAdmin } from '../middleware/auth.js';
import {
  listAllOrders, getOrderById, updateOrderStatus, setOrderRejectReason,
  setOrderInvoice, setOrderPaymentMethod, listUsers, updateUserStatus,
  listNotifications, markNotificationsRead, countUnreadNotifications,
  listOrdersByUserId, listOrdersByEmail, getRateHistory, getCompletedOrdersSince,
  type ShopOrder, type OrderStatus,
} from '../db.js';
import { notify } from '../notifications.js';
import { computeOrderTotals, round2 } from '../pricing.js';

export const adminRouter = Router();

const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'wallet'];

const ORDER_STEPS: Record<string, string[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['completed', 'rejected', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
};

function httpError(status: number, message: string): never {
  const e: any = new Error(message);
  e.status = status;
  throw e;
}

function requireStep(order: ShopOrder, target: OrderStatus) {
  const allowed = ORDER_STEPS[order.status] ?? [];
  if (!allowed.includes(target)) {
    httpError(409, `status.transition:${order.status}->${target}`);
  }
}

function buyerChannel(order: ShopOrder) {
  return {
    recipient: order.email || order.customerPhone,
    whatsapp: !!order.customerPhone && !order.email,
  };
}

async function notifyBuyer(order: ShopOrder, subject: string, body: string) {
  await notify({ type: 'order.updated', ...buyerChannel(order), subject, body }).catch(() => null);
}

// ---- POST /api/admin/login — staff login via the main system ----
adminRouter.post('/login', async (req, res) => {
  const { identifier, pin } = req.body ?? {};
  if (!identifier || !pin) return res.status(400).json({ error: 'auth.missing' });
  const result = await mainApi.loginEmployee(String(identifier), String(pin));
  if (!result) return res.status(401).json({ error: 'auth.invalid' });

  const perms = result.employee.permissions;
  const canManage = ['invoice.create', 'reservation.manage', 'customers.manage'].some((p) => perms.includes(p));
  if (!canManage) return res.status(403).json({ error: 'forbidden' });

  const admin: ShopAdmin = {
    employeeId: result.employee.id,
    fullName: result.employee.fullName,
    roleCode: result.employee.roleCode,
  };
  res.json({ token: signAdminToken(admin), admin });
});

adminRouter.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: (req as any).admin });
});

// Wholesale weight orders and balances remain authoritative in POS. The shop
// admin only proxies the same records so web and walk-in business stay unified.
adminRouter.get('/wholesale', requireAdmin, async (_req, res) => {
  const [summary, traders, orders] = await Promise.all([
    mainApi.fetchWholesaleDashboard(),
    mainApi.fetchWholesaleTraders(),
    mainApi.fetchWholesaleOrders(),
  ]);
  res.json({ summary, traders, orders });
});

adminRouter.get('/wholesale/traders/:id/statement', requireAdmin, async (req, res) => {
  res.json(await mainApi.fetchWholesaleStatement(Number(req.params.id)));
});

// ---- orders ----
adminRouter.get('/orders', requireAdmin, async (req, res) => {
  const status = (req.query.status as string) || undefined;
  const valid: OrderStatus[] = ['pending', 'confirmed', 'rejected', 'completed', 'cancelled'];
  const filtered = valid.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  res.json({ orders: await listAllOrders(filtered), unread: await countUnreadNotifications() });
});

adminRouter.get('/orders/:id', requireAdmin, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });

  // Estimate today's price for this order, so staff can see if rates moved
  // since the order was placed before completing.
  try {
    const snap = await getCatalog(true);
    const lines = order.items.map((it) => {
      const entry = snap.items.find((e) => e.id === it.itemId);
      return {
        quantity: it.quantity,
        unitMetal: entry?.unitMetal ?? 0,
        unitCraft: entry?.unitCraft ?? 0,
      };
    });
    const totals = computeOrderTotals(lines, snap.vatPercent);
    const estimate = {
      metalSubtotal: totals.metalSubtotal,
      craftsmanshipTotal: totals.craftsmanshipTotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      priceChanged: Math.abs(totals.total - order.totalValue) > 0.01,
    };
    res.json({ order, estimate });
  } catch {
    res.json({ order, estimate: null });
  }
});

adminRouter.post('/orders/:id/confirm', requireAdmin, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  requireStep(order, 'confirmed');
  await updateOrderStatus(order.id, 'confirmed');
  await notifyBuyer(
    order,
    `تم تأكيد طلب ${order.orderNo}`,
    `تم تأكيد طلبك ${order.orderNo}. سيتم التواصل معك لترتيب التحصيل أو الشحن.`,
  );
  res.json({ ok: true, order: await getOrderById(order.id) });
});

adminRouter.post('/orders/:id/reject', requireAdmin, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  const reason = String((req.body ?? {}).reason || '').trim() || 'لم يذكر سبب';
  requireStep(order, 'rejected');
  for (const rid of order.apiReservationIds) {
    await mainApi.cancelReservation(rid).catch(() => null);
  }
  await setOrderRejectReason(order.id, reason);
  await updateOrderStatus(order.id, 'rejected');
  await notifyBuyer(
    order,
    `تم رفض طلب ${order.orderNo}`,
    `نعتذر، لم نتمكن من تنفيذ طلبك ${order.orderNo}.\nالسبب: ${reason}\nيمكنك التواصل معنا لأي استفسار.`,
  );
  res.json({ ok: true, order: await getOrderById(order.id) });
});

adminRouter.post('/orders/:id/complete', requireAdmin, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  const paymentMethod = String((req.body ?? {}).paymentMethod || config.defaultPaymentMethod);
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: 'bad.paymentMethod' });
  }
  requireStep(order, 'completed');

  try {
    const invoice = await mainApi.createInvoice({
      items: order.items.map((it) => ({ itemId: it.itemId, quantity: it.quantity })),
      customerId: order.customerId,
      paymentMethod,
      paidAmount: order.downPayment,
    });
    if (!invoice?.id) throw new Error('invoice.failed');
    await setOrderInvoice(order.id, String(invoice.invoiceNo || invoice.invoice_no || ''), Number(invoice.id));
    await setOrderPaymentMethod(order.id, paymentMethod);
    await updateOrderStatus(order.id, 'completed');
    await notifyBuyer(
      order,
      `تم تنفيذ طلب ${order.orderNo}`,
      `تم تنفيذ طلبك ${order.orderNo} بقيمة ${order.totalValue} ${config.currency}.` +
        (order.downPayment > 0 ? ` المدفوع: ${order.downPayment} ${config.currency}.` : '') +
        ` فاتورة: ${invoice.invoiceNo || invoice.invoice_no || ''}`,
    );
    res.json({ ok: true, order: await getOrderById(order.id), invoiceNo: invoice.invoiceNo || invoice.invoice_no || null });
  } catch (e: any) {
    res.status(e?.status || 409).json({ error: e?.message || 'invoice.failed' });
  }
});

adminRouter.post('/orders/:id/cancel', requireAdmin, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  requireStep(order, 'cancelled');
  for (const rid of order.apiReservationIds) {
    await mainApi.cancelReservation(rid).catch(() => null);
  }
  await updateOrderStatus(order.id, 'cancelled');
  await notifyBuyer(
    order,
    `تم إلغاء طلب ${order.orderNo}`,
    `تم إلغاء طلبك ${order.orderNo} — تم تحرير الحجز على القطع.`,
  );
  res.json({ ok: true, order: await getOrderById(order.id) });
});

// ---- account approval ----
adminRouter.get('/users', requireAdmin, async (_req, res) => {
  res.json({ users: await listUsers() });
});

adminRouter.post('/users/:id/approve', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await updateUserStatus(id, 'active');
  res.json({ ok: true });
});

adminRouter.post('/users/:id/disable', requireAdmin, async (req, res) => {
  await updateUserStatus(Number(req.params.id), 'disabled');
  res.json({ ok: true });
});

adminRouter.post('/users/:id/enable', requireAdmin, async (req, res) => {
  await updateUserStatus(Number(req.params.id), 'active');
  res.json({ ok: true });
});

// ---- GET /api/admin/users/:id/orders — a customer's order history ----
adminRouter.get('/users/:id/orders', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const orders = await listOrdersByUserId(id);
  const byEmail = orders[0]?.email ? await listOrdersByEmail(orders[0].email) : [];
  const seen = new Set(orders.map((o) => o.id));
  for (const o of byEmail) if (!seen.has(o.id)) orders.push(o);
  res.json({ orders: orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

// ---- notifications ----
adminRouter.get('/notifications', requireAdmin, async (req, res) => {
  res.json({ notifications: await listNotifications(100), unread: await countUnreadNotifications() });
});

adminRouter.post('/notifications/read', requireAdmin, async (req, res) => {
  const ids = (req.body ?? {}).ids as number[] | undefined;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'bad.ids' });
  await markNotificationsRead(ids);
  res.json({ ok: true });
});

// ---- GET /api/admin/rates/history — daily metal prices for the chart ----
adminRouter.get('/rates/history', requireAdmin, async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const history = await getRateHistory(days);
  res.json({ history });
});

// ---- GET /api/admin/reports — sales overview for a window ----
adminRouter.get('/reports', requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const completed = await getCompletedOrdersSince(cutoff);

  const revenue = completed.reduce((s, o) => s + o.totalValue, 0);
  const downPayments = completed.reduce((s, o) => s + o.downPayment, 0);
  const summary = {
    orders: completed.length,
    revenue,
    downPayments,
    avgOrder: completed.length ? round2(revenue / completed.length) : 0,
  };

  const dailyMap = new Map<string, { day: string; count: number; revenue: number }>();
  for (const o of completed) {
    const day = o.createdAt.slice(0, 10);
    const e = dailyMap.get(day) ?? { day, count: 0, revenue: 0 };
    e.count += 1;
    e.revenue += o.totalValue;
    dailyMap.set(day, e);
  }
  const daily = [...dailyMap.values()].sort((a, b) => (a.day < b.day ? -1 : 1));

  const itemMap = new Map<string, { code: string; name: string; qty: number; revenue: number }>();
  for (const o of completed) {
    for (const it of o.items) {
      const e = itemMap.get(it.code) ?? { code: it.code, name: it.name ?? it.code, qty: 0, revenue: 0 };
      e.qty += it.quantity;
      e.revenue += it.lineTotal;
      itemMap.set(it.code, e);
    }
  }
  const topItems = [...itemMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15);

  const custMap = new Map<string, { customerName: string; orders: number; revenue: number }>();
  for (const o of completed) {
    const key = o.customerName || 'زائر';
    const e = custMap.get(key) ?? { customerName: key, orders: 0, revenue: 0 };
    e.orders += 1;
    e.revenue += o.totalValue;
    custMap.set(key, e);
  }
  const customers = [...custMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15);

  res.json({ days, summary, daily, topItems, customers });
});
