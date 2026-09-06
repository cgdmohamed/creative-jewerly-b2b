import { Router } from 'express';
import { authenticateShop, optionalShopAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { findCatalogItem } from '../catalogCache.js';
import { mainApi } from '../apiClient.js';
import { round2, computeOrderTotals } from '../pricing.js';
import {
  createOrder, getOrderById, getOrderByNo, listOrdersByUser, listOrdersByEmail,
  setUserApiCustomerId, updateOrderStatus, updateOrderContents, nextOrderNo,
  type ShopOrder, type ShopOrderItem, type OrderStatus,
} from '../db.js';
import { notify } from '../notifications.js';

export const ordersRouter = Router();

function httpError(status: number, message: string): never {
  const e: any = new Error(message);
  e.status = status;
  throw e;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertLineQty(item: { code: string; availableQty?: number; quantity?: number; minQty?: number }, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) httpError(400, 'bad.quantity');
  const min = Math.max(1, Number(item.minQty ?? 0));
  if (quantity < min) httpError(409, `items.below_min:${item.code}:${min}`);
  const available = Number(item.availableQty ?? item.quantity ?? 0);
  if (quantity > available) httpError(409, `items.not_available:${item.code}`);
}

async function ownOrders(user: any): Promise<ShopOrder[]> {
  const byUser = await listOrdersByUser(user.id);
  const byEmail = user.email ? await listOrdersByEmail(user.email) : [];
  const seen = new Set<number>();
  const all = [...byEmail, ...byUser].filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---- POST /api/orders — place a reservation-based order ----
ordersRouter.post('/', optionalShopAuth, async (req, res) => {
  if (req.body.authToken) return res.status(400).json({ error: 'bad.request' });
  const { items, customer, notes } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'missing:items' });

  const user = req.shopUser ?? null;
  if (!user && !config.guestOrderingEnabled) {
    return res.status(403).json({ error: 'guest.ordering.disabled' });
  }
  if (user && user.status !== 'active') {
    return res.status(403).json({
      error: user.status === 'pending' ? 'account.pending' : 'account.disabled',
    });
  }

  try {
    // 1) Validate lines against a fresh snapshot of the catalog.
    const lines: { item: any; quantity: number; unitMetal: number; unitCraft: number }[] = [];
    for (const li of items) {
      const quantity = Number(li.quantity ?? 1);
      const item = await findCatalogItem(Number(li.itemId));
      if (!item) httpError(404, `items.notfound:${li.itemId}`);
      if (!item.priceable || item.unitPrice <= 0) httpError(409, `items.not_priceable:${item.code}`);
      assertLineQty(item, quantity);
      lines.push({ item, quantity, unitMetal: item.unitMetal, unitCraft: item.unitCraft });
    }

    const vatPercent = lines[0].item.vatPercent;
    const totals = computeOrderTotals(lines, vatPercent);

    // 2) Resolve the buyer (account profile overrides form input).
    const name = user?.name ?? customer?.name;
    const phone = user?.phone ?? customer?.phone;
    const email = user?.email ?? customer?.email;
    const company = user?.company ?? customer?.company;
    if (!name?.trim()) httpError(400, 'missing:name');
    if (!phone?.trim() && !email?.trim()) httpError(400, 'missing:phone.or.email');

    // 3) Ensure the buyer exists as a customer in the main system.
    let customerId = user?.apiCustomerId ?? null;
    if (!customerId) {
      const apiCustomer = await mainApi.createCustomer({
        name: String(name).trim(),
        phone: phone?.trim() || undefined,
        email: email?.trim() || undefined,
        address: company?.trim() || undefined,
      });
      customerId = apiCustomer.id;
      if (user) await setUserApiCustomerId(user.id, customerId);
    }
    // A B2B buyer and a walk-in wholesale trader are the same customer in POS.
    // Creating the profile is idempotent and keeps future statements unified.
    await mainApi.ensureWholesaleTrader(customerId, company?.trim() || undefined);

    // 4) Hold the stock: one reservation per line in the main system.
    const downPaymentPercent = config.downPaymentPercent;
    const totalDown = round2((totals.total * downPaymentPercent) / 100);
    const reservationIds: number[] = [];
    let distributed = 0;
    try {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const lineTotalWithVat = round2((l.unitMetal + l.unitCraft) * l.quantity * (1 + vatPercent / 100));
        const isLast = i === lines.length - 1;
        const lineDown = isLast
          ? round2(totalDown - distributed)
          : round2(lineTotalWithVat * downPaymentPercent / 100);
        distributed = round2(distributed + lineDown);
        const reservation = await mainApi.createReservation({
          itemId: l.item.id,
          quantity: l.quantity,
          customerId,
          customerName: String(name).trim(),
          customerPhone: phone?.trim() || null,
          downPayment: lineDown,
          totalValue: lineTotalWithVat,
          notes: notes ? `B2B shop order — ${notes}` : 'B2B shop order',
        });
        reservationIds.push(reservation.id);
      }
    } catch (e: any) {
      // Roll back any reservations already created so stock is not held.
      await Promise.allSettled(reservationIds.map((rid) => mainApi.cancelReservation(rid).catch(() => null)));
      throw e;
    }

    // 5) Record the order locally.
    const itemsJson: ShopOrderItem[] = lines.map((l) => ({
      itemId: l.item.id,
      code: l.item.code,
      name: l.item.name ?? null,
      metalType: l.item.metalType,
      carat: l.item.carat ?? null,
      weightG: Number(l.item.weightG),
      quantity: l.quantity,
      metalPricePerGram: l.item.pricePerGram ?? 0,
      metalTotal: round2(l.unitMetal * l.quantity),
      craftsmanship: round2(l.unitCraft * l.quantity),
      lineTotal: round2((l.unitMetal + l.unitCraft) * l.quantity),
      photoUrl: l.item.photoUrl ?? null,
    }));

    const order = await createOrder({
      orderNo: await nextOrderNo(today()),
      userId: user?.id ?? null,
      customerId,
      customerName: String(name).trim(),
      customerPhone: phone?.trim() || null,
      company: company?.trim() || null,
      email: email?.trim() || null,
      items: itemsJson,
      metalSubtotal: totals.metalSubtotal,
      craftsmanshipTotal: totals.craftsmanshipTotal,
      vatAmount: totals.vatAmount,
      totalValue: totals.total,
      downPayment: totalDown,
      remainingDue: round2(totals.total - totalDown),
      apiReservationIds: reservationIds,
      notes: notes?.trim() || null,
    });

    res.status(201).json({ order });
    notify({
      type: 'order.placed',
      subject: `طلب جديد ${order.orderNo}`,
      body: `طلب جديد من ${order.customerName} بإجمالي ${order.totalValue} ${config.currency} (${order.items.length} بند) — مراجعة مطلوبة.`,
    }).catch(() => null);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'error' });
  }
});

// ---- GET /api/orders — the authenticated buyer's orders ----
ordersRouter.get('/', authenticateShop, async (req, res) => {
  res.json({ orders: await ownOrders(req.shopUser!) });
});

// ---- POST /api/orders/track — guest lookup by order number + phone/email ----
ordersRouter.post('/track', async (req, res) => {
  const { orderNo, phone, email } = req.body ?? {};
  if (!orderNo) return res.status(400).json({ error: 'missing:orderNo' });
  const order = await getOrderByNo(String(orderNo).trim().toUpperCase());
  if (!order) return res.status(404).json({ error: 'order.notfound' });
  const identity = String(phone || email || '').trim();
  if (!identity) return res.status(400).json({ error: 'missing:phone.or.email' });
  const matches =
    (phone && order.customerPhone === String(phone).trim()) ||
    (email && order.email === String(email).trim().toLowerCase());
  if (!matches) return res.status(404).json({ error: 'order.notfound' });
  res.json({ order });
});

// ---- POST /api/orders/track/cancel — guest cancels an open order (identity via phone/email) ----
ordersRouter.post('/track/cancel', async (req, res) => {
  const { orderNo, phone, email } = req.body ?? {};
  if (!orderNo) return res.status(400).json({ error: 'missing:orderNo' });
  const order = await getOrderByNo(String(orderNo).trim().toUpperCase());
  if (!order) return res.status(404).json({ error: 'order.notfound' });
  const identity = String(phone || email || '').trim();
  if (!identity) return res.status(400).json({ error: 'missing:phone.or.email' });
  const matches =
    (phone && order.customerPhone === String(phone).trim()) ||
    (email && order.email === String(email).trim().toLowerCase());
  if (!matches) return res.status(403).json({ error: 'forbidden' });
  if (order.status !== 'pending' && order.status !== 'confirmed') {
    return res.status(409).json({ error: 'order.not_cancellable' });
  }
  for (const rid of order.apiReservationIds) {
    await mainApi.cancelReservation(rid).catch(() => null);
  }
  await updateOrderStatus(order.id, 'cancelled');
  notify({
    type: 'order.cancelled',
    recipient: order.email || order.customerPhone,
    whatsapp: !!order.customerPhone && !order.email,
    subject: `تم إلغاء طلب ${order.orderNo}`,
    body: `تم إلغاء طلب ${order.orderNo} — تم تحرير الحجز على القطع.`,
  }).catch(() => null);
  res.json({ ok: true, order: await getOrderById(order.id) });
});

// ---- GET /api/orders/:id — order detail (own orders only) ----
ordersRouter.get('/:id', authenticateShop, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  const mine = (await ownOrders(req.shopUser!)).some((o) => o.id === order.id);
  if (!mine) return res.status(403).json({ error: 'forbidden' });
  res.json({ order });
});

// ---- POST /api/orders/:id/edit — buyer edits a pending order (re-reserves) ----
ordersRouter.post('/:id/edit', authenticateShop, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  const mine = (await ownOrders(req.shopUser!)).some((o) => o.id === order.id);
  if (!mine) return res.status(403).json({ error: 'forbidden' });
  if (order.status !== 'pending') {
    return res.status(409).json({ error: 'order.not_editable' });
  }

  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'missing:items' });

  try {
    const lines: { item: any; quantity: number; unitMetal: number; unitCraft: number }[] = [];
    for (const li of items) {
      const quantity = Number(li.quantity ?? 1);
      const item = await findCatalogItem(Number(li.itemId));
      if (!item) httpError(404, `items.notfound:${li.itemId}`);
      if (!item.priceable || item.unitPrice <= 0) httpError(409, `items.not_priceable:${item.code}`);
      assertLineQty(item, quantity);
      lines.push({ item, quantity, unitMetal: item.unitMetal, unitCraft: item.unitCraft });
    }

    const vatPercent = lines[0].item.vatPercent;
    const totals = computeOrderTotals(lines, vatPercent);
    const downPaymentPercent = config.downPaymentPercent;
    const totalDown = round2((totals.total * downPaymentPercent) / 100);

    // Release the old reservations first so stock is available again.
    for (const rid of order.apiReservationIds) {
      await mainApi.cancelReservation(rid).catch(() => null);
    }

    const reservationIds: number[] = [];
    let distributed = 0;
    try {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const lineTotalWithVat = round2((l.unitMetal + l.unitCraft) * l.quantity * (1 + vatPercent / 100));
        const isLast = i === lines.length - 1;
        const lineDown = isLast
          ? round2(totalDown - distributed)
          : round2(lineTotalWithVat * downPaymentPercent / 100);
        distributed = round2(distributed + lineDown);
        const reservation = await mainApi.createReservation({
          itemId: l.item.id,
          quantity: l.quantity,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          downPayment: lineDown,
          totalValue: lineTotalWithVat,
          notes: order.notes ? `B2B shop order edit — ${order.notes}` : 'B2B shop order edit',
        });
        reservationIds.push(reservation.id);
      }
    } catch (e: any) {
      await Promise.allSettled(reservationIds.map((rid) => mainApi.cancelReservation(rid).catch(() => null)));
      throw e;
    }

    const itemsJson: ShopOrderItem[] = lines.map((l) => ({
      itemId: l.item.id,
      code: l.item.code,
      name: l.item.name ?? null,
      metalType: l.item.metalType,
      carat: l.item.carat ?? null,
      weightG: Number(l.item.weightG),
      quantity: l.quantity,
      metalPricePerGram: l.item.pricePerGram ?? 0,
      metalTotal: round2(l.unitMetal * l.quantity),
      craftsmanship: round2(l.unitCraft * l.quantity),
      lineTotal: round2((l.unitMetal + l.unitCraft) * l.quantity),
      photoUrl: l.item.photoUrl ?? null,
    }));

    await updateOrderContents(order.id, {
      items: itemsJson,
      metalSubtotal: totals.metalSubtotal,
      craftsmanshipTotal: totals.craftsmanshipTotal,
      vatAmount: totals.vatAmount,
      totalValue: totals.total,
      downPayment: totalDown,
      remainingDue: round2(totals.total - totalDown),
      apiReservationIds: reservationIds,
    });

    const updated = await getOrderById(order.id);
    if (!updated) return res.status(404).json({ error: 'notfound' });
    notify({
      type: 'order.updated',
      subject: `تعديل طلب ${order.orderNo}`,
      body: `قام ${updated.customerName} بتعديل الطلب ${order.orderNo} — القيمة الجديدة ${updated.totalValue} ${config.currency}.`,
    }).catch(() => null);

    res.json({ order: updated });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'error' });
  }
});

// ---- POST /api/orders/:id/cancel — buyer cancels an open order ----
ordersRouter.post('/:id/cancel', authenticateShop, async (req, res) => {
  const order = await getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'notfound' });
  const mine = (await ownOrders(req.shopUser!)).some((o) => o.id === order.id);
  if (!mine) return res.status(403).json({ error: 'forbidden' });
  if (order.status !== 'pending' && order.status !== 'confirmed') {
    return res.status(409).json({ error: 'order.not_cancellable' });
  }
  for (const rid of order.apiReservationIds) {
    await mainApi.cancelReservation(rid).catch(() => null);
  }
  await updateOrderStatus(order.id, 'cancelled');
  notify({
    type: 'order.cancelled',
    recipient: order.email || order.customerPhone,
    whatsapp: !!order.customerPhone && !order.email,
    subject: `تم إلغاء طلب ${order.orderNo}`,
    body: `تم إلغاء طلب ${order.orderNo} — تم تحرير الحجز على القطع.`,
  }).catch(() => null);
  res.json({ ok: true, order: await getOrderById(order.id) });
});
