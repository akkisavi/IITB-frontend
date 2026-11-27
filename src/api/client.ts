import type { AuthUser } from './types';

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
export const TOKEN_KEY = 'wms.token';
export const USER_KEY = 'wms.user';
const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  code: string;
  detail: string;
  errors: Record<string, string[]>;
  constructor(status: number, code: string, detail: string, errors: Record<string, string[]> = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function activeStore(): Storage | null {
  try {
    if (localStorage.getItem(TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
  } catch {
    return null;
  }
  return null;
}

export function isRemembered(): boolean {
  return activeStore() === localStorage;
}

export function getToken(): string | null {
  return activeStore()?.getItem(TOKEN_KEY) ?? null;
}
export function storeSession(token: string, user: AuthUser, remember = false) {
  try {
    clearSession();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage blocked */
  }
}
export function getStoredUsername(): string | null {
  return readCachedUser()?.username ?? null;
}
export function storeUser(user: AuthUser) {
  try {
    (activeStore() ?? sessionStorage).setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage blocked */
  }
}
export function clearSession() {
  try {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
    }
  } catch {
    /* storage blocked */
  }
}
export function readCachedUser(): AuthUser | null {
  try {
    const raw = activeStore()?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function normaliseErrors(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = Array.isArray(v) ? v.map(String) : [String(v)];
  }
  return out;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(API_BASE_URL + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token && opts.auth !== false) headers.Authorization = `Token ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Retrying...');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const obj = (data && typeof data === 'object' ? data : {}) as { detail?: string; code?: string; errors?: unknown };
    const err = new ApiError(
      res.status,
      obj.code ?? (res.status === 401 ? 'not_authenticated' : 'error'),
      obj.detail ?? `Request failed (${res.status}).`,
      normaliseErrors(obj.errors),
    );
    if (res.status === 401 && opts.auth !== false && onUnauthorized) onUnauthorized();
    throw err;
  }
  return data as T;
}
