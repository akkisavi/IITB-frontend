import { request, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, creds, type Role } from './env';

export interface PalletDto {
  id: number; pallet_number: string; barcode: string; item_name: string; quantity: number;
  status: string; location: string | null;
}
export interface LocationDto {
  code: string; column: string; row: number; kind: 'transfer' | 'storage';
  state: 'transfer' | 'free' | 'occupied'; pallet: PalletDto | null;
}

export async function anonApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API_BASE_URL });
}

export async function loginToken(username: string, password: string): Promise<string> {
  const ctx = await anonApi();
  try {
    const res = await ctx.post('/api/auth/login/', { data: { username, password } });
    if (res.status() !== 200) throw new Error(`API login for ${username} failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).token as string;
  } finally {
    await ctx.dispose();
  }
}

/** Authenticated API client for a role (token auth). */
export async function apiAs(role: Role): Promise<APIRequestContext> {
  const { username, password } = creds(role);
  const token = await loginToken(username, password);
  return request.newContext({ baseURL: API_BASE_URL, extraHTTPHeaders: { Authorization: `Token ${token}` } });
}

export async function getLocations(api: APIRequestContext): Promise<LocationDto[]> {
  const res = await api.get('/api/locations/');
  if (!res.ok()) throw new Error(`GET locations failed: ${res.status()}`);
  return res.json();
}

export async function freeLocations(api: APIRequestContext): Promise<string[]> {
  return (await getLocations(api)).filter((l) => l.state === 'free').map((l) => l.code);
}

let seq = 0;
const runId = Date.now().toString(36).toUpperCase();
export function uniquePallet() {
  seq += 1;
  const n = `${Date.now()}${seq}`.slice(-13).padStart(13, '7');
  return {
    pallet_number: `E2E-${runId}-${seq}`,
    barcode: n,
    item_name: `E2E item ${seq}`,
    quantity: 10 + seq,
  };
}

export async function loadViaApi(api: APIRequestContext, location: string, p = uniquePallet()) {
  const res = await api.post('/api/operations/load/', { data: { ...p, location } });
  if (res.status() !== 201) throw new Error(`API load to ${location} failed: ${res.status()} ${await res.text()}`);
  return p;
}

/** Unload every active pallet whose number starts with E2E-<runId> (or the given numbers). Ignores already-empty. */
export async function cleanupPallets(api: APIRequestContext, numbers?: string[]) {
  const locs = await getLocations(api);
  for (const l of locs) {
    const pn = l.pallet?.pallet_number;
    if (!pn) continue;
    const mine = numbers ? numbers.includes(pn) : pn.startsWith(`E2E-${runId}-`);
    if (mine) await api.post('/api/operations/unload/', { data: { location: l.code } });
  }
}

/** Remove E2E pallets left behind by crashed earlier runs (suite runs with one worker against one DB). */
export async function sweepStaleE2E(api: APIRequestContext) {
  for (const l of await getLocations(api)) {
    if (l.pallet?.pallet_number.startsWith('E2E-')) {
      await api.post('/api/operations/unload/', { data: { location: l.code } });
    }
  }
}
