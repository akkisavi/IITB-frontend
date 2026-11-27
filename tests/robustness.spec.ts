/**
 * Concurrency, idempotency, audit trail and optimistic UI.
 * These exercise the real API; only the optimistic-UI tests delay or stub one browser request
 * so the in-between state is observable.
 */
import { test, expect, type APIRequestContext, type Route } from '@playwright/test';
import { apiAs, cleanupPallets, freeLocations, loadViaApi, sweepStaleE2E, uniquePallet } from './support/api';
import { cell, loginAs } from './support/ui';

let tech: APIRequestContext;
let tech2: APIRequestContext;
test.beforeAll(async () => {
  tech = await apiAs('technician');
  tech2 = await apiAs('admin'); // a second operator session
  await sweepStaleE2E(tech);
});
test.afterEach(async () => {
  await cleanupPallets(tech);
});
test.afterAll(async () => {
  await cleanupPallets(tech);
  await tech.dispose();
  await tech2.dispose();
});

async function pickFree(n = 1): Promise<string[]> {
  const free = await freeLocations(tech);
  test.skip(free.length < n, `needs ${n} free storage locations`);
  return free.slice(0, n);
}

test('two sessions loading the same location at the same time: exactly one wins, the other gets 409', async () => {
  const [code] = await pickFree();
  const a = uniquePallet();
  const b = uniquePallet();
  const [ra, rb] = await Promise.all([
    tech.post('/api/operations/load/', { data: { ...a, location: code } }),
    tech2.post('/api/operations/load/', { data: { ...b, location: code } }),
  ]);
  const statuses = [ra.status(), rb.status()].sort();
  expect(statuses).toEqual([201, 409]);
  const loser = ra.status() === 409 ? ra : rb;
  expect((await loser.json()).code).toMatch(/location_occupied|conflict/);

  const loc = await (await tech.get(`/api/locations/${code}/`)).json();
  const winner = ra.status() === 201 ? a : b;
  expect(loc.pallet.pallet_number).toBe(winner.pallet_number); // one pallet, never two
});

test('a retried load with the same Idempotency-Key returns the original result and stores one pallet', async () => {
  const [code] = await pickFree();
  const p = uniquePallet();
  const headers = { 'Idempotency-Key': `e2e-${Date.now().toString(36)}-retry` };
  const first = await tech.post('/api/operations/load/', { data: { ...p, location: code }, headers });
  const retry = await tech.post('/api/operations/load/', { data: { ...p, location: code }, headers });
  expect(first.status()).toBe(201);
  expect(retry.status()).toBe(201);
  expect(retry.headers()['idempotent-replayed']).toBe('true');
  expect((await retry.json()).pallet.id).toBe((await first.json()).pallet.id);

  const list = await (await tech.get('/api/pallets/', { params: { status: 'all', search: p.pallet_number } })).json();
  expect(list.count).toBe(1);
});

test('unloaded pallets stay inspectable: history shows where they were and who moved them', async ({ page }) => {
  const [code] = await pickFree();
  const p = await loadViaApi(tech, code);
  expect((await tech2.post('/api/operations/unload/', { data: { location: code } })).status()).toBe(200);

  await loginAs(page, 'auditor');
  await page.goto('/pallets');
  await page.getByTestId('pallet-status-unloaded').click();
  await page.getByTestId('pallet-search').fill(p.pallet_number);
  const row = page.getByTestId(`pallet-row-${p.pallet_number}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText(code); // storage location kept after unload
  await expect(row).toContainText(/left via a1/i);
});

/** Delay a stock request in the browser, optionally replacing its response. Preflights pass through. */
function holdRequest(path: string, ms: number, fake?: { status: number; body: unknown }) {
  return async (route: Route) => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    if (!route.request().url().includes(path)) return route.continue();
    await new Promise((r) => setTimeout(r, ms));
    if (fake) {
      return route.fulfill({
        status: fake.status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(fake.body),
      });
    }
    return route.continue();
  };
}

async function openLoadDialog(page: import('@playwright/test').Page, code: string, p: ReturnType<typeof uniquePallet>) {
  await page.getByTestId('load-button').click();
  await page.getByTestId('load-pallet-number').fill(p.pallet_number);
  await page.getByTestId('load-barcode').fill(p.barcode);
  await page.getByTestId('load-item-name').fill(p.item_name);
  await page.getByTestId('load-quantity').fill(String(p.quantity));
  await page.getByTestId('load-location').selectOption(code);
}

test('optimistic load: the cell turns occupied before the server answers', async ({ page }) => {
  const [code] = await pickFree();
  const p = uniquePallet();
  await loginAs(page, 'technician');
  await page.route('**/api/operations/load/', holdRequest('/api/operations/load/', 2000));
  await openLoadDialog(page, code, p);
  await page.getByTestId('load-submit').click();
  // Request is still held for 2 s, so this can only pass if the map was patched optimistically.
  await expect(cell(page, code)).toHaveAttribute('data-state', 'occupied', { timeout: 1000 });
  await expect(page.locator('[data-testid="toast"][data-variant="success"]').first()).toBeVisible({ timeout: 5000 });
  await expect(cell(page, code)).toHaveAttribute('data-state', 'occupied');
});

test('optimistic load is rolled back when the server rejects it', async ({ page }) => {
  const [code] = await pickFree();
  const p = uniquePallet();
  await loginAs(page, 'technician');
  await page.route(
    '**/api/operations/load/',
    holdRequest('/api/operations/load/', 1200, {
      status: 409,
      body: { detail: `Location ${code} is already occupied by pallet OTHER-1.`, code: 'location_occupied' },
    }),
  );
  await openLoadDialog(page, code, p);
  await page.getByTestId('load-submit').click();
  await expect(cell(page, code)).toHaveAttribute('data-state', 'occupied', { timeout: 1000 }); // optimistic
  await expect(page.getByTestId('load-error')).toContainText(/already occupied/i); // server said no
  await expect(cell(page, code)).toHaveAttribute('data-state', 'free'); // rolled back
});
