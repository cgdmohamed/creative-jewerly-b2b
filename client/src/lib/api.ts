import type { ShopUser, AdminEmployee } from './types';

const TOKEN_KEY = 'b2b_token';
const USER_KEY = 'b2b_user';
const ADMIN_TOKEN_KEY = 'b2b_admin_token';
const ADMIN_KEY = 'b2b_admin';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: ShopUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCachedUser(): ShopUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShopUser;
  } catch {
    return null;
  }
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminSession(token: string, admin: AdminEmployee) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function getCachedAdmin(): AdminEmployee | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminEmployee;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: Omit<RequestInit, 'body'> & { body?: any }, token: string | null): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data as any)?.error || (data as any)?.detail || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function api<T = any>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: any } = {},
): Promise<T> {
  return request<T>(path, options, getToken());
}

/** Calls an endpoint using the staff (admin) token instead of the buyer token. */
export async function adminApi<T = any>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: any } = {},
): Promise<T> {
  return request<T>(path, options, getAdminToken());
}
