import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiAs, cleanupPallets, freeLocations, loadViaApi, sweepStaleE2E, uniquePallet } from './support/api';
import { cell, digits, loginAs } from './support/ui';

let tech: APIRequestContext;
test.beforeAll(async () => {
  tech = await apiAs('technician');
  await sweepStaleE2E(tech);
});
test.afterEach(async () => {
  await cleanupPallets(tech);
});
test.afterAll(async () => {
  await cleanupPallets(tech);
  await tech.dispose();
});

async function pickFree(): Promise<string> {
  const free = await freeLocations(tech);
  test.skip(free.length === 0, 'no free storage location available');
  return free[0];
}

async function fillLoadDialog(page: Page, p: ReturnType<typeof uniquePallet>, code: string) {
  await page.getByTestId('load-button').click();
  await expect(page.getByTestId('load-dialog')).toBeVisible();
  await page.getByTestId('load-pallet-number').fill(p.pallet_number);
  await page.getByTestId('load-barcode').fill(p.barcode);
  await page.getByTestId('load-item-name').fill(p.item_name);
  await page.getByTestId('load-quantity').fill(String(p.quantity));
  await page.getByTestId('load-location').selectOption(code);
}

test('technician loads a pallet into a free cell -> occupied, toast, counts update', async ({ page }) => {
  const code = await pickFree();
  const p = uniquePallet();
  await loginAs(page, 'technician');
  await expect(cell(page, code)).toHaveAttribute('data-state', 'free');
  const occBefore = await digits(page, 'map-occupied-count');
  const freeBefore = await digits(page, 'map-free-count');

  await fillLoadDialog(page, p, code);
  await page.getByTestId('load-submit').click();

  await expect(page.locator('[data-testid="toast"][data-variant="success"]').first()).toBeVisible();
  await expect(page.getByTestId('load-dialog')).toBeHidden();
  await expect(cell(page, code)).toHaveAttribute('data-state', 'occupied');
  await expect(cell(page, code)).toContainText(/occupied/i);
  await expect(cell(page, code)).toHaveAttribute('aria-label', new RegExp(p.pallet_number));
  await expect.poll(() => digits(page, 'map-occupied-count')).toBe(occBefore + 1);
  await expect.poll(() => digits(page, 'map-free-count')).toBe(freeBefore - 1);
});

test('selecting an occupied cell shows pallet details (auditor, read-only)', async ({ page }) => {
  const code = await pickFree();
  const p = await loadViaApi(tech, code);
  await loginAs(page, 'auditor');
  await cell(page, code).click();
  await expect(page.getByTestId('location-detail')).toHaveAttribute('data-location', code);
  await expect(page.getByTestId('detail-pallet-number')).toHaveText(p.pallet_number);
  await expect(page.getByTestId('detail-barcode')).toHaveText(p.barcode);
  await expect(page.getByTestId('detail-item-name')).toHaveText(p.item_name);
  await expect(page.getByTestId('detail-quantity')).toContainText(String(p.quantity));
  await expect(page.getByTestId('detail-loaded-by')).not.toBeEmpty();
  await expect(page.getByTestId('unload-button')).toHaveCount(0);
});

test('load dialog: invalid barcode shows field error; A1 is not offered', async ({ page }) => {
  await pickFree();
  await loginAs(page, 'technician');
  await page.getByTestId('load-button').click();
  await expect(page.getByTestId('load-dialog')).toBeVisible();
  await expect(page.locator('[data-testid="load-location"] option[value="A1"]')).toHaveCount(0);
  const p = uniquePallet();
  await page.getByTestId('load-pallet-number').fill(p.pallet_number);
  await page.getByTestId('load-barcode').fill('12AB');
  await page.getByTestId('load-item-name').fill(p.item_name);
  await page.getByTestId('load-quantity').fill('5');
  await page.getByTestId('load-submit').click();
  await expect(page.getByTestId('field-error-barcode')).toHaveText('Barcode must be 8-14 digits.');
  await expect(page.getByTestId('load-dialog')).toBeVisible();
});

test('API rejects A1 and bad input with 400 field errors', async () => {
  const p = uniquePallet();
  const a1 = await tech.post('/api/operations/load/', { data: { ...p, location: 'A1' } });
  expect(a1.status()).toBe(400);
  expect(JSON.stringify((await a1.json()).errors)).toContain('A1 is the transfer point');
  const bad = await tech.post('/api/operations/load/', {
    data: { ...uniquePallet(), barcode: 'x', quantity: 0, location: 'B1' },
  });
  expect(bad.status()).toBe(400);
  const body = await bad.json();
  expect(body.code).toBe('validation_error');
  expect(Object.keys(body.errors)).toEqual(expect.arrayContaining(['barcode', 'quantity']));
});

test('duplicate active pallet number -> 409 (API) and form error in dialog', async ({ page }) => {
  const free = await freeLocations(tech);
  test.skip(free.length < 2, 'need two free locations');
  const p = await loadViaApi(tech, free[0]);
  const dup = await tech.post('/api/operations/load/', {
    data: { ...uniquePallet(), pallet_number: p.pallet_number, location: free[1] },
  });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).code).toBe('duplicate_pallet_number');

  await loginAs(page, 'technician');
  await fillLoadDialog(page, { ...uniquePallet(), pallet_number: p.pallet_number }, free[1]);
  await page.getByTestId('load-submit').click();
  await expect(page.getByTestId('load-error')).toContainText(p.pallet_number);
  await expect(cell(page, free[1])).toHaveAttribute('data-state', 'free');
});

test('unload with confirmation -> cell becomes free; repeat unload is 409', async ({ page }) => {
  const code = await pickFree();
  const p = await loadViaApi(tech, code);
  await loginAs(page, 'technician');
  await expect(cell(page, code)).toHaveAttribute('data-state', 'occupied');
  await cell(page, code).click();
  await page.getByTestId('unload-button').click();
  await expect(page.getByTestId('unload-confirm-dialog')).toContainText(p.pallet_number);
  await page.getByTestId('unload-confirm').click();
  await expect(cell(page, code)).toHaveAttribute('data-state', 'free');
  await expect(cell(page, code)).toContainText(/free/i);
  await expect(page.locator('[data-testid="toast"][data-variant="success"]').first()).toBeVisible();
  const again = await tech.post('/api/operations/unload/', { data: { location: code } });
  expect(again.status()).toBe(409);
  expect((await again.json()).code).toBe('location_empty');
});

test('change in one session appears in another within 5 s', async ({ browser }) => {
  const code = await pickFree();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await loginAs(a, 'technician');
    await loginAs(b, 'auditor');
    await expect(cell(b, code)).toHaveAttribute('data-state', 'free');

    await fillLoadDialog(a, uniquePallet(), code);
    await a.getByTestId('load-submit').click();
    await expect(cell(a, code)).toHaveAttribute('data-state', 'occupied');

    await expect(cell(b, code)).toHaveAttribute('data-state', 'occupied', { timeout: 5_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
