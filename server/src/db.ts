import Database from 'better-sqlite3';
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

export interface ShopOrderRow {
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
  itemsJson: string;
  metalSubtotal: number;
  craftsmanshipTotal: number;
  vatAmount: number;
  totalValue: number;
  downPayment: number;
  remainingDue: number;
  apiReservationIds: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

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

const db = new Database(config.shopDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    api_customer_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES shop_users(id) ON DELETE SET NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    company TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    invoice_no TEXT,
    invoice_id INTEGER,
    payment_method TEXT,
    items_json TEXT NOT NULL,
    metal_subtotal REAL NOT NULL DEFAULT 0,
    craftsmanship_total REAL NOT NULL DEFAULT 0,
    vat_amount REAL NOT NULL DEFAULT 0,
    total_value REAL NOT NULL DEFAULT 0,
    down_payment REAL NOT NULL DEFAULT 0,
    remaining_due REAL NOT NULL DEFAULT 0,
    api_reservation_ids TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shop_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'inapp',
    recipient TEXT,
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metal_type TEXT NOT NULL,
    carat TEXT,
    price_per_gram REAL NOT NULL,
    day TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user ON shop_orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_email ON shop_orders(email);
  CREATE INDEX IF NOT EXISTS idx_notifications_status ON shop_notifications(status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_history_day ON rate_history(day, metal_type, carat);
`);

// Lightweight migration for databases created before these columns existed.
(function migrate() {
  const userCols = (db.prepare(`PRAGMA table_info(shop_users)`).all() as any[]).map((c) => c.name);
  if (!userCols.includes('status')) {
    db.exec(`ALTER TABLE shop_users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
    db.exec(`UPDATE shop_users SET status = 'active'`); // pre-existing accounts stay active
  }
  const orderCols = (db.prepare(`PRAGMA table_info(shop_orders)`).all() as any[]).map((c) => c.name);
  for (const [name, ddl] of [
    ['reject_reason', `ALTER TABLE shop_orders ADD COLUMN reject_reason TEXT`],
    ['invoice_no', `ALTER TABLE shop_orders ADD COLUMN invoice_no TEXT`],
    ['invoice_id', `ALTER TABLE shop_orders ADD COLUMN invoice_id INTEGER`],
    ['payment_method', `ALTER TABLE shop_orders ADD COLUMN payment_method TEXT`],
  ] as const) {
    if (!orderCols.includes(name)) db.exec(ddl);
  }
})();

// ---- users ----
export function findUserByEmail(email: string): ShopUser | null {
  const row = db
    .prepare(`SELECT id, name, company, email, phone, password_hash AS passwordHash,
                     api_customer_id AS apiCustomerId, status, created_at AS createdAt
                FROM shop_users WHERE email = ?`)
    .get(email);
  return (row as ShopUser) ?? null;
}

export function findUserByPhone(phone: string): ShopUser | null {
  const row = db
    .prepare(`SELECT id, name, company, email, phone, password_hash AS passwordHash,
                     api_customer_id AS apiCustomerId, status, created_at AS createdAt
                FROM shop_users WHERE phone = ?`)
    .get(phone);
  return (row as ShopUser) ?? null;
}

export function findUserById(id: number): ShopUser | null {
  const row = db
    .prepare(`SELECT id, name, company, email, phone, password_hash AS passwordHash,
                     api_customer_id AS apiCustomerId, status, created_at AS createdAt
                FROM shop_users WHERE id = ?`)
    .get(id);
  return (row as ShopUser) ?? null;
}

export function createUser(u: {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  passwordHash: string;
  status?: UserStatus;
}): ShopUser {
  const info = db
    .prepare(`INSERT INTO shop_users (name, company, email, phone, password_hash, status)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(u.name, u.company ?? null, u.email ?? null, u.phone ?? null, u.passwordHash, u.status ?? 'pending');
  return findUserById(Number(info.lastInsertRowid))!;
}

export function setUserApiCustomerId(userId: number, apiCustomerId: number) {
  db.prepare(`UPDATE shop_users SET api_customer_id = ? WHERE id = ?`).run(apiCustomerId, userId);
}

export function updateUserStatus(userId: number, status: UserStatus) {
  db.prepare(`UPDATE shop_users SET status = ? WHERE id = ?`).run(status, userId);
}

export function updateUserProfile(
  userId: number,
  fields: { name: string; company?: string | null; email?: string | null; phone?: string | null },
) {
  db.prepare(`UPDATE shop_users SET name = ?, company = ?, email = ?, phone = ? WHERE id = ?`).run(
    fields.name,
    fields.company ?? null,
    fields.email ?? null,
    fields.phone ?? null,
    userId,
  );
}

export function setUserPassword(userId: number, passwordHash: string) {
  db.prepare(`UPDATE shop_users SET password_hash = ? WHERE id = ?`).run(passwordHash, userId);
}

export function listUsers(): ShopUser[] {
  return (db.prepare(`SELECT u.id, u.name, u.company, u.email, u.phone,
                             u.password_hash AS passwordHash,
                             u.api_customer_id AS apiCustomerId, u.status,
                             u.created_at AS createdAt,
                             (SELECT COUNT(*) FROM shop_orders o WHERE o.user_id = u.id) AS orderCount
                        FROM shop_users u ORDER BY u.created_at DESC`).all() as any[]);
}

// ---- notifications ----
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

export function addNotification(n: {
  type: string;
  channel?: string;
  recipient?: string | null;
  subject: string;
  body: string;
}): number {
  const info = db
    .prepare(`INSERT INTO shop_notifications (type, channel, recipient, subject, body)
              VALUES (?, ?, ?, ?, ?)`)
    .run(n.type, n.channel ?? 'inapp', n.recipient ?? null, n.subject, n.body);
  return Number(info.lastInsertRowid);
}

export function listNotifications(limit = 50): ShopNotification[] {
  return (db.prepare(`SELECT id, type, channel, recipient, subject, body, status,
                             created_at AS createdAt
                        FROM shop_notifications ORDER BY id DESC LIMIT ?`).all(limit) as any[]);
}

export function markNotificationsRead(ids: number[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE shop_notifications SET status = 'read' WHERE id IN (${placeholders})`).run(...ids);
}

export function countUnreadNotifications(): number {
  return Number((db.prepare(`SELECT COUNT(*) AS n FROM shop_notifications WHERE status = 'new'`).get() as any).n);
}

// ---- orders ----
function rowToOrder(row: any): ShopOrder {
  const items = JSON.parse(row.items_json || '[]') as ShopOrderItem[];
  const apiIds = row.api_reservation_ids ? (JSON.parse(row.api_reservation_ids) as number[]) : [];
  return {
    id: row.id,
    orderNo: row.order_no,
    userId: row.user_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    company: row.company,
    email: row.email,
    status: row.status,
    rejectReason: row.reject_reason,
    invoiceNo: row.invoice_no,
    invoiceId: row.invoice_id,
    paymentMethod: row.payment_method,
    items,
    metalSubtotal: row.metal_subtotal,
    craftsmanshipTotal: row.craftsmanship_total,
    vatAmount: row.vat_amount,
    totalValue: row.total_value,
    downPayment: row.down_payment,
    remainingDue: row.remaining_due,
    apiReservationIds: apiIds,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrder(o: {
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
}): ShopOrder {
  const info = db
    .prepare(`INSERT INTO shop_orders
      (order_no, user_id, customer_id, customer_name, customer_phone, company, email,
       items_json, metal_subtotal, craftsmanship_total, vat_amount, total_value,
       down_payment, remaining_due, api_reservation_ids, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
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
    );
  return getOrderById(Number(info.lastInsertRowid))!;
}

export function getOrderById(id: number): ShopOrder | null {
  const row = db.prepare(`SELECT * FROM shop_orders WHERE id = ?`).get(id);
  return row ? rowToOrder(row) : null;
}

export function getOrderByNo(orderNo: string): ShopOrder | null {
  const row = db.prepare(`SELECT * FROM shop_orders WHERE order_no = ?`).get(orderNo);
  return row ? rowToOrder(row) : null;
}

export function listOrdersByUser(userId: number): ShopOrder[] {
  return (db.prepare(`SELECT * FROM shop_orders WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as any[]).map(rowToOrder);
}

export function listOrdersByEmail(email: string): ShopOrder[] {
  return (db.prepare(`SELECT * FROM shop_orders WHERE email = ? ORDER BY created_at DESC`).all(email) as any[]).map(rowToOrder);
}

export function updateOrderStatus(id: number, status: OrderStatus) {
  db.prepare(`UPDATE shop_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
}

export function setOrderRejectReason(id: number, reason: string) {
  db.prepare(`UPDATE shop_orders SET reject_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(reason, id);
}

export function setOrderInvoice(id: number, invoiceNo: string, invoiceId: number) {
  db.prepare(`UPDATE shop_orders SET invoice_no = ?, invoice_id = ?, updated_at = datetime('now') WHERE id = ?`).run(invoiceNo, invoiceId, id);
}

export function setOrderPaymentMethod(id: number, method: string) {
  db.prepare(`UPDATE shop_orders SET payment_method = ?, updated_at = datetime('now') WHERE id = ?`).run(method, id);
}

export function updateOrderContents(
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
) {
  db.prepare(
    `UPDATE shop_orders SET items_json = ?, metal_subtotal = ?, craftsmanship_total = ?,
       vat_amount = ?, total_value = ?, down_payment = ?, remaining_due = ?,
       api_reservation_ids = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    JSON.stringify(fields.items),
    fields.metalSubtotal,
    fields.craftsmanshipTotal,
    fields.vatAmount,
    fields.totalValue,
    fields.downPayment,
    fields.remainingDue,
    JSON.stringify(fields.apiReservationIds),
    id,
  );
}

export function listAllOrders(status?: OrderStatus): ShopOrder[] {
  const rows = status
    ? db.prepare(`SELECT * FROM shop_orders WHERE status = ? ORDER BY id DESC`).all(status)
    : db.prepare(`SELECT * FROM shop_orders ORDER BY id DESC`).all();
  return (rows as any[]).map(rowToOrder);
}

export function nextOrderNo(dateStr: string): string {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM shop_orders WHERE order_no LIKE ?`)
    .get(`ORD-${dateStr}-%`) as { n: number };
  return `ORD-${dateStr}-${String(row.n + 1).padStart(4, '0')}`;
}

// ---- rate history ----
export interface RateSnapshotRow {
  id: number;
  metalType: string;
  carat: string | null;
  pricePerGram: number;
  day: string;
}

export function recordRateSnapshot(rates: { metalType: string; carat: string | null; pricePerGram: number | null }[]) {
  const day = new Date().toISOString().slice(0, 10);
  const upsert = db.prepare(
    `INSERT INTO rate_history (metal_type, carat, price_per_gram, day) VALUES (?, ?, ?, ?)
     ON CONFLICT(day, metal_type, carat) DO UPDATE SET price_per_gram = excluded.price_per_gram`,
  );
  const tx = db.transaction(() => {
    for (const r of rates) {
      if (r.pricePerGram == null) continue;
      upsert.run(r.metalType, r.carat ?? null, r.pricePerGram, day);
    }
  });
  tx();
}

export function getRateHistory(days = 30): RateSnapshotRow[] {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return (db
    .prepare(
      `SELECT id, metal_type AS metalType, carat, price_per_gram AS pricePerGram, day
         FROM rate_history WHERE day >= ? ORDER BY day ASC, metal_type ASC, carat ASC`,
    )
    .all(cutoff) as any[]);
}

export function listOrdersByUserId(userId: number): ShopOrder[] {
  return listOrdersByUser(userId);
}

export function getCompletedOrdersSince(cutoff: string): ShopOrder[] {
  const rows = db
    .prepare(`SELECT * FROM shop_orders WHERE status = 'completed' AND created_at >= ? ORDER BY created_at ASC`)
    .all(cutoff);
  return (rows as any[]).map(rowToOrder);
}
