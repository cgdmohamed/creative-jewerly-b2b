import { config } from './config.js';

export interface ApiItem {
  id: number;
  code: string;
  barcode?: string | null;
  name?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  categoryId?: number | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  size?: string | null;
  metalType: 'gold' | 'silver';
  carat?: string | null;
  weightG: number | string;
  stoneWeightG?: number | string;
  craftsmanshipType: 'fixed' | 'percent';
  craftsmanshipValue: number | string;
  physicalStatus: 'new' | 'used';
  notes?: string | null;
  quantity?: number;
  reservedQty?: number;
  inTransitQty?: number;
  availableQty?: number;
  minQty?: number;
  maxQty?: number | null;
  status: string;
  isActive?: boolean;
  locationName?: string | null;
}

export interface ApiPrice {
  metalType: 'gold' | 'silver';
  carat: string | null;
  pricePerGram: number | string;
}

export interface ApiCategory {
  id: number;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  isActive: boolean;
}

export interface ApiCustomer {
  id: number;
  name: string;
  phone?: string | null;
}

export interface ApiReservation {
  id: number;
  status: string;
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PLACEHOLDER_MARKER = 'الوزن الافتراضي';

/**
 * Thin client for the main jewelry-system API. Authenticates once as the
 * dedicated `b2b` employee and refreshes the token automatically on 401.
 */
class MainApiClient {
  private token: string | null = null;
  private tokenPromise: Promise<string> | null = null;

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    if (!this.tokenPromise) {
      this.tokenPromise = this.login().finally(() => {
        this.tokenPromise = null;
      });
    }
    return this.tokenPromise;
  }

  private async login(): Promise<string> {
    const res = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: config.b2bUsername, pin: config.b2bPin }),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data?.token) {
      throw new ApiClientError(res.status, `B2B API login failed for "${config.b2bUsername}": ${data?.error || res.statusText}`);
    }
    this.token = data.token as string;
    return this.token;
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    let token = await this.getToken();
    const doFetch = (t: string) =>
      fetch(`${config.apiBaseUrl}${path}`, {
        ...options,
        headers: {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${t}`,
          ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        },
      });

    let res = await doFetch(token);
    if (res.status === 401) {
      this.token = null;
      token = await this.getToken();
      res = await doFetch(token);
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiClientError(res.status, (data as any)?.message || (data as any)?.error || `HTTP ${res.status}`);
    }
    return data as T;
  }

  private get<T = any>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }

  private post<T = any>(path: string, body: any) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  // ---- catalog ----
  async fetchItems(): Promise<ApiItem[]> {
    return this.get<ApiItem[]>('/api/items?status=available&includeInactive=false');
  }

  async fetchPrices(): Promise<ApiPrice[]> {
    return this.get<ApiPrice[]>('/api/prices/active');
  }

  async fetchCategories(): Promise<ApiCategory[]> {
    return this.get<ApiCategory[]>('/api/categories');
  }

  async fetchSettings(): Promise<Record<string, string>> {
    return this.get<Record<string, string>>('/api/settings');
  }

  // ---- writes ----
  async createCustomer(body: { name: string; phone?: string; email?: string; address?: string }): Promise<ApiCustomer> {
    return this.post<ApiCustomer>('/api/customers', body);
  }

  async updateCustomer(id: number, body: { name: string; phone?: string; email?: string }): Promise<ApiCustomer> {
    return this.request<ApiCustomer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async createReservation(body: {
    itemId: number;
    quantity: number;
    customerId?: number | null;
    customerName: string;
    customerPhone?: string | null;
    downPayment: number;
    totalValue: number;
    notes?: string;
  }): Promise<ApiReservation> {
    return this.post<ApiReservation>('/api/reservations', body);
  }

  async cancelReservation(id: number): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/api/reservations/${id}/cancel`, {});
  }

  async createInvoice(body: {
    items: { itemId: number; quantity: number }[];
    customerId?: number | null;
    paymentMethod?: string;
    paidAmount?: number;
    locationId?: number;
  }): Promise<any> {
    return this.post<any>('/api/invoices', body);
  }

  // ---- unified wholesale ledger (owned by the main POS) ----
  async fetchWholesaleDashboard(): Promise<any> {
    return this.get('/api/wholesale/dashboard');
  }

  async fetchWholesaleTraders(): Promise<any[]> {
    return this.get('/api/wholesale/traders');
  }

  async fetchWholesaleOrders(): Promise<any[]> {
    return this.get('/api/wholesale/orders');
  }

  async fetchWholesaleStatement(traderId: number): Promise<any> {
    return this.get(`/api/wholesale/traders/${traderId}/statement`);
  }

  async ensureWholesaleTrader(customerId: number, businessName?: string): Promise<void> {
    try {
      await this.post('/api/wholesale/traders', { customerId, businessName: businessName || null });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) return;
      throw error;
    }
  }

  // ---- staff admin auth (validated against the main system) ----
  async loginEmployee(identifier: string, pin: string): Promise<{
    token: string;
    employee: {
      id: number;
      fullName: string;
      role: string;
      roleCode: string;
      permissions: string[];
    };
  } | null> {
    const res = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, pin }),
    });
    const data: any = await res.json().catch(() => null);
    if (res.status === 401) return null;
    if (!res.ok) {
      throw new ApiClientError(res.status, data?.error || `HTTP ${res.status}`);
    }
    if (!data?.token || !data?.employee) return null;
    return {
      token: data.token,
      employee: {
        id: data.employee.id,
        fullName: data.employee.fullName ?? data.employee.full_name,
        role: data.employee.role,
        roleCode: data.employee.roleCode ?? data.employee.role_code,
        permissions: Array.isArray(data.employee.permissions) ? data.employee.permissions : [],
      },
    };
  }
}

export const mainApi = new MainApiClient();

export function isPlaceholderWeight(item: ApiItem): boolean {
  return typeof item.notes === 'string' && item.notes.includes(PLACEHOLDER_MARKER);
}
