export interface ShopConfig {
  storeName: string;
  currency: string;
  guestOrderingEnabled: boolean;
  publicPrices: boolean;
  downPaymentPercent: number;
  requireAccountApproval: boolean;
  defaultPaymentMethod: string;
  registrationEnabled: boolean;
  catalogStatus: string;
  rates: { metalType: string; carat: string | null; pricePerGram: number | null }[];
  ratesFetchedAt: string | null;
}

export interface CatalogItem {
  id: number;
  code: string;
  name?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  size?: string | null;
  metalType: 'gold' | 'silver';
  carat?: string | null;
  weightG: number | string;
  stoneWeightG?: number | string;
  craftsmanshipType: 'fixed' | 'percent';
  craftsmanshipValue: number | string;
  craftsmanship?: string;
  physicalStatus: 'new' | 'used';
  availableQty?: number;
  minQty?: number;
  maxQty?: number | null;
  unitMetal: number;
  unitCraft: number;
  unitPrice: number;
  vatPercent: number;
  pricePerGram: number | null;
  priceable: boolean;
}

export interface Category {
  id: number;
  code: string;
  nameAr: string;
  nameEn?: string | null;
}

export interface CatalogResponse {
  items: CatalogItem[];
  categories: Category[];
  vatPercent: number;
  pricesHidden: boolean;
  fetchedAt: string;
}

export type UserStatus = 'pending' | 'active' | 'disabled';

export interface ShopUser {
  id: number;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  status: UserStatus;
}

export type OrderStatus = 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled';

export interface OrderItem {
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

export interface Order {
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
  paymentMethod: string | null;
  items: OrderItem[];
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

export interface CartLine {
  item: CatalogItem;
  quantity: number;
}

// ---- admin / staff ----
export interface AdminEmployee {
  employeeId: number;
  fullName: string;
  roleCode: string;
}

export interface AdminUser {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  createdAt: string;
  orderCount?: number;
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

export interface RatePoint {
  metalType: string;
  carat: string | null;
  pricePerGram: number;
  day: string;
}

export interface SalesReport {
  days: number;
  summary: { orders: number; revenue: number; downPayments: number; avgOrder: number };
  daily: { day: string; count: number; revenue: number }[];
  topItems: { code: string; name: string; qty: number; revenue: number }[];
  customers: { customerName: string; orders: number; revenue: number }[];
}

export interface OrderEstimate {
  metalSubtotal: number;
  craftsmanshipTotal: number;
  vatAmount: number;
  total: number;
  priceChanged: boolean;
}
