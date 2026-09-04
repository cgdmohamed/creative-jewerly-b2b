import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} — set it in server/.env (see server/.env.example)`);
  return v;
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

export const config = {
  port: num('PORT', 4100),
  shopJwtSecret: required('SHOP_JWT_SECRET'),
  apiBaseUrl: (process.env.API_BASE_URL || 'http://localhost:4001').replace(/\/$/, ''),
  b2bUsername: process.env.B2B_USERNAME || 'b2b',
  b2bPin: process.env.B2B_PIN || '1234',
  shopDb: {
    host: process.env.SHOP_PGHOST || '127.0.0.1',
    port: num('SHOP_PGPORT', 5432),
    user: process.env.SHOP_PGUSER || 'b2b_shop',
    password: required('SHOP_PGPASSWORD'),
    database: process.env.SHOP_PGDATABASE || 'b2b_shop',
  },
  storeName: process.env.STORE_NAME || 'متجر الجملة',
  currency: process.env.CURRENCY || 'ج.م',
  guestOrderingEnabled: bool('GUEST_ORDERING_ENABLED', true),
  downPaymentPercent: num('DOWN_PAYMENT_PERCENT', 0),
  publicPrices: bool('PUBLIC_PRICES', true),
  requireAccountApproval: bool('ACCOUNT_APPROVAL_ENABLED', true),
  defaultPaymentMethod: process.env.DEFAULT_PAYMENT_METHOD || 'transfer',
};
