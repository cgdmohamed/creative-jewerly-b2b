import pg from 'pg';
import { config } from './config.js';

export type UserStatus = 'pending' | 'active' | 'disabled';

export interface ShopUser {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  apiCustomerId: number | null;
  status: UserStatus;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled';

export interface ShopOrder {
  id: number;
  orderNo: string;
  userId: number | null;
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  company: string | null;
  email: string | null;
  status: OrderStatus;
  rejectReason: string | null;
  invoiceNo: string | null;
  invoiceId: number | null;
  paymentMethod: string | null;
  items: ShopOrderItem[];
  metalSubtotal: number;
  craftsmanshipTotal: number;
  vatAmount: number;
  totalValue: number;
  downPayment: number;
  remainingDue: number;
  apiReservationIds: number[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrderItem {
  itemId: number;
  code: string;
  name: string | null;
  metalType: string;
  carat: string | null;
  weightG: number;
  quantity: number;
  metalPricePerGram: number;
  metalTotal: number;
  craftsmanship: number;
  lineTotal: number;
  photoUrl?: string | null;
}

const { Pool } = pg;

export const pool = new Pool(config.shopDb);

export async function initShopDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      api_customer_id BIGINT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'disabled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_users_email
      ON shop_users (email)
      WHERE email IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_users_phone
      ON shop_users (phone)
      WHERE phone IS NOT NULL;

    CREATE TABLE IF NOT EXISTS shop_orders (
      id BIGSERIAL PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      user_id BIGINT REFERENCES shop_users(id) ON DELETE SET NULL,
      customer_id BIGINT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      company TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed', 'cancelled')),
      reject_reason TEXT,
      invoice_no TEXT,
      invoice_id BIGINT,
      payment_method TEXT,
      items_json JSONB NOT NULL,
      metal_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
      craftsmanship_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
      vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
      down_payment NUMERIC(14, 2) NOT NULL DEFAULT 0,
      remaining_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
      api_reservation_ids JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shop_notifications (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'inapp',
      recipient TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS rate_history (
      id BIGSERIAL PRIMARY KEY,
      metal_type TEXT NOT NULL,
      carat TEXT,
      price_per_gram NUMERIC(14, 4) NOT NULL,
      day DATE NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user ON shop_orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_email ON shop_orders(email);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON shop_notifications(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_history_day
      ON rate_history(day, metal_type, (COALESCE(carat, '')));
  `);
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function nullableNum(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

function rowToUser(row: any): ShopUser {
  return {
    id: Number(row.id),
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    apiCustomerId: nullableNum(row.api_customer_id),
    status: row.status,
    createdAt: iso(row.created_at),
  };
}

function rowToOrder(row: any): ShopOrder {
  return {
    id: Number(row.id),
    orderNo: row.order_no,
    userId: nullableNum(row.user_id),
    customerId: nullableNum(row.customer_id),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    company: row.company,
    email: row.email,
    status: row.status,
    rejectReason: row.reject_reason,
    invoiceNo: row.invoice_no,
    invoiceId: nullableNum(row.invoice_id),
    paymentMethod: row.payment_method,
    items: parseJson<ShopOrderItem[]>(row.items_json, []),
    metalSubtotal: num(row.metal_subtotal),
    craftsmanshipTotal: num(row.craftsmanship_total),
    vatAmount: num(row.vat_amount),
    totalValue: num(row.total_value),
    downPayment: num(row.down_payment),
    remainingDue: num(row.remaining_due),
    apiReservationIds: parseJson<number[]>(row.api_reservation_ids, []),
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await pool.query(sql, params);
  return (result.rows[0] as T | undefined) ?? null;
}

export async function findUserByEmail(email: string): Promise<ShopUser | null> {
  const row = await one<any>(`SELECT * FROM shop_users WHERE email = $1`, [email]);
  return row ? rowToUser(row) : null;
}

export async function findUserByPhone(phone: string): Promise<ShopUser | null> {
  const row = await one<any>(`SELECT * FROM shop_users WHERE phone = $1`, [phone]);
  return row ? rowToUser(row) : null;
}

export async function findUserById(id: number): Promise<ShopUser | null> {
  const row = await one<any>(`SELECT * FROM shop_users WHERE id = $1`, [id]);
  return row ? rowToUser(row) : null;
}

export async function createUser(u: {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  passwordHash: string;
  status?: UserStatus;
}): Promise<ShopUser> {
  const row = await one<any>(
    `INSERT INTO shop_users (name, company, email, phone, password_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [u.name, u.company ?? null, u.email ?? null, u.phone ?? null, u.passwordHash, u.status ?? 'pending'],
  );
  if (!row) throw new Error('user.create.failed');
  return rowToUser(row);
}

export async function setUserApiCustomerId(userId: number, apiCustomerId: number): Promise<void> {
  await pool.query(`UPDATE shop_users SET api_customer_id = $1 WHERE id = $2`, [apiCustomerId, userId]);
}

export async function updateUserStatus(userId: number, status: UserStatus): Promise<void> {
  await pool.query(`UPDATE shop_users SET status = $1 WHERE id = $2`, [status, userId]);
}

export async function updateUserProfile(
  userId: number,
  fields: { name: string; company?: string | null; email?: string | null; phone?: string | null },
): Promise<void> {
  await pool.query(`UPDATE shop_users SET name = $1, company = $2, email = $3, phone = $4 WHERE id = $5`, [
    fields.name,
    fields.company ?? null,
    fields.email ?? null,
    fields.phone ?? null,
    userId,
  ]);
}

export async function setUserPassword(userId: number, passwordHash: string): Promise<void> {
  await pool.query(`UPDATE shop_users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
}

export async function listUsers(): Promise<(ShopUser & { orderCount: number })[]> {
  const result = await pool.query(`
    SELECT u.*,
           (SELECT COUNT(*) FROM shop_orders o WHERE o.user_id = u.id) AS order_count
      FROM shop_users u
     ORDER BY u.created_at DESC
  `);
  return result.rows.map((row) => ({ ...rowToUser(row), orderCount: Number(row.order_count) }));
}

export interface ShopNotification {
  id: number;
  type: string;
  channel: string;
  recipient: string | null;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}

function rowToNotification(row: any): ShopNotification {
  return {
    id: Number(row.id),
    type: row.type,
    channel: row.channel,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: iso(row.created_at),
  };
}

export async function addNotification(n: {
  type: string;
  channel?: string;
  recipient?: string | null;
  subject: string;
  body: string;
}): Promise<number> {
  const row = await one<{ id: string }>(
    `INSERT INTO shop_notifications (type, channel, recipient, subject, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [n.type, n.channel ?? 'inapp', n.recipient ?? null, n.subject, n.body],
  );
  return Number(row?.id);
}

export async function listNotifications(limit = 50): Promise<ShopNotification[]> {
  const result = await pool.query(`SELECT * FROM shop_notifications ORDER BY id DESC LIMIT $1`, [limit]);
  return result.rows.map(rowToNotification);
}

export async function markNotificationsRead(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(`UPDATE shop_notifications SET status = 'read' WHERE id = ANY($1::bigint[])`, [ids]);
}

export async function countUnreadNotifications(): Promise<number> {
  const row = await one<{ n: string }>(`SELECT COUNT(*) AS n FROM shop_notifications WHERE status = 'new'`);
  return Number(row?.n ?? 0);
}

export async function createOrder(o: {
  orderNo: string;
  userId?: number | null;
  customerId?: number | null;
  customerName: string;
  customerPhone?: string | null;
  company?: string | null;
  email?: string | null;
  items: ShopOrderItem[];
  metalSubtotal: number;
  craftsmanshipTotal: number;
  vatAmount: number;
  totalValue: number;
  downPayment: number;
  remainingDue: number;
  apiReservationIds?: number[];
  paymentMethod?: string | null;
  notes?: string | null;
}): Promise<ShopOrder> {
  const row = await one<any>(
    `INSERT INTO shop_orders
      (order_no, user_id, customer_id, customer_name, customer_phone, company, email,
       items_json, metal_subtotal, craftsmanship_total, vat_amount, total_value,
       down_payment, remaining_due, api_reservation_ids, payment_method, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
      RETURNING *`,
    [
      o.orderNo,
      o.userId ?? null,
      o.customerId ?? null,
      o.customerName,
      o.customerPhone ?? null,
      o.company ?? null,
      o.email ?? null,
      JSON.stringify(o.items),
      o.metalSubtotal,
      o.craftsmanshipTotal,
      o.vatAmount,
      o.totalValue,
      o.downPayment,
      o.remainingDue,
      JSON.stringify(o.apiReservationIds ?? []),
      o.paymentMethod ?? null,
      o.notes ?? null,
    ],
  );
  if (!row) throw new Error('order.create.failed');
  return rowToOrder(row);
}

export async function getOrderById(id: number): Promise<ShopOrder | null> {
  const row = await one<any>(`SELECT * FROM shop_orders WHERE id = $1`, [id]);
  return row ? rowToOrder(row) : null;
}

export async function getOrderByNo(orderNo: string): Promise<ShopOrder | null> {
  const row = await one<any>(`SELECT * FROM shop_orders WHERE order_no = $1`, [orderNo]);
  return row ? rowToOrder(row) : null;
}

export async function listOrdersByUser(userId: number): Promise<ShopOrder[]> {
  const result = await pool.query(`SELECT * FROM shop_orders WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return result.rows.map(rowToOrder);
}

export async function listOrdersByEmail(email: string): Promise<ShopOrder[]> {
  const result = await pool.query(`SELECT * FROM shop_orders WHERE email = $1 ORDER BY created_at DESC`, [email]);
  return result.rows.map(rowToOrder);
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
  await pool.query(`UPDATE shop_orders SET status = $1, updated_at = now() WHERE id = $2`, [status, id]);
}

export async function setOrderRejectReason(id: number, reason: string): Promise<void> {
  await pool.query(`UPDATE shop_orders SET reject_reason = $1, updated_at = now() WHERE id = $2`, [reason, id]);
}

export async function setOrderInvoice(id: number, invoiceNo: string, invoiceId: number): Promise<void> {
  await pool.query(`UPDATE shop_orders SET invoice_no = $1, invoice_id = $2, updated_at = now() WHERE id = $3`, [
    invoiceNo,
    invoiceId,
    id,
  ]);
}

export async function setOrderPaymentMethod(id: number, method: string): Promise<void> {
  await pool.query(`UPDATE shop_orders SET payment_method = $1, updated_at = now() WHERE id = $2`, [method, id]);
}

export async function updateOrderContents(
  id: number,
  fields: {
    items: ShopOrderItem[];
    metalSubtotal: number;
    craftsmanshipTotal: number;
    vatAmount: number;
    totalValue: number;
    downPayment: number;
    remainingDue: number;
    apiReservationIds: number[];
  },
): Promise<void> {
  await pool.query(
    `UPDATE shop_orders SET items_json = $1::jsonb, metal_subtotal = $2, craftsmanship_total = $3,
       vat_amount = $4, total_value = $5, down_payment = $6, remaining_due = $7,
       api_reservation_ids = $8::jsonb, updated_at = now()
     WHERE id = $9`,
    [
      JSON.stringify(fields.items),
      fields.metalSubtotal,
      fields.craftsmanshipTotal,
      fields.vatAmount,
      fields.totalValue,
      fields.downPayment,
      fields.remainingDue,
      JSON.stringify(fields.apiReservationIds),
      id,
    ],
  );
}

export async function listAllOrders(status?: OrderStatus): Promise<ShopOrder[]> {
  const result = status
    ? await pool.query(`SELECT * FROM shop_orders WHERE status = $1 ORDER BY id DESC`, [status])
    : await pool.query(`SELECT * FROM shop_orders ORDER BY id DESC`);
  return result.rows.map(rowToOrder);
}

export async function nextOrderNo(dateStr: string): Promise<string> {
  const row = await one<{ n: string }>(`SELECT COUNT(*) AS n FROM shop_orders WHERE order_no LIKE $1`, [
    `ORD-${dateStr}-%`,
  ]);
  return `ORD-${dateStr}-${String(Number(row?.n ?? 0) + 1).padStart(4, '0')}`;
}

export interface RateSnapshotRow {
  id: number;
  metalType: string;
  carat: string | null;
  pricePerGram: number;
  day: string;
}

export async function recordRateSnapshot(
  rates: { metalType: string; carat: string | null; pricePerGram: number | null }[],
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rates) {
      if (r.pricePerGram == null) continue;
      await client.query(
        `INSERT INTO rate_history (metal_type, carat, price_per_gram, day)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (day, metal_type, (COALESCE(carat, '')))
         DO UPDATE SET price_per_gram = EXCLUDED.price_per_gram`,
        [r.metalType, r.carat ?? null, r.pricePerGram, day],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getRateHistory(days = 30): Promise<RateSnapshotRow[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const result = await pool.query(
    `SELECT id, metal_type, carat, price_per_gram, day
       FROM rate_history
      WHERE day >= $1
      ORDER BY day ASC, metal_type ASC, carat ASC`,
    [cutoff],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    metalType: row.metal_type,
    carat: row.carat,
    pricePerGram: Number(row.price_per_gram),
    day: iso(row.day).slice(0, 10),
  }));
}

export async function listOrdersByUserId(userId: number): Promise<ShopOrder[]> {
  return listOrdersByUser(userId);
}

export async function getCompletedOrdersSince(cutoff: string): Promise<ShopOrder[]> {
  const result = await pool.query(
    `SELECT * FROM shop_orders WHERE status = 'completed' AND created_at >= $1 ORDER BY created_at ASC`,
    [cutoff],
  );
  return result.rows.map(rowToOrder);
}
