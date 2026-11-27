import { test, expect } from '@playwright/test';
import { apiAs, getLocations } from './support/api';
import { cell, digits, loginAs } from './support/ui';

test('shuttle page shows SH-01 with status and battery', async ({ page }) => {
  await loginAs(page, 'technician');
  await page.goto('/shuttle');
  await expect(page.getByTestId('shuttle-card')).toBeVisible();
  await expect(page.getByTestId('shuttle-identifier')).toHaveText('SH-01');
  await expect(page.getByTestId('shuttle-status')).not.toBeEmpty();
  await expect(page.getByTestId('shuttle-battery')).toContainText(/\d+%/);
});

test('dashboard stats match the map and history has 7 points', async ({ page }) => {
  const admin = await apiAs('admin');
  const locs = await getLocations(admin);
  const occupied = locs.filter((l) => l.state === 'occupied').length;
  const dash = await (await admin.get('/api/dashboard/')).json();
  expect(dash.capacity).toBe(24);
  expect(dash.occupied).toBe(occupied);
  expect(dash.free).toBe(24 - occupied);
  expect(dash.history).toHaveLength(7);
  expect(dash.history[6].occupied).toBe(occupied);
  await admin.dispose();

  await loginAs(page, 'auditor');
  const mapOcc = await digits(page, 'map-occupied-count');
  const mapFree = await digits(page, 'map-free-count');
  expect(mapOcc).toBe(await page.locator('[data-testid^="location-cell-"][data-state="occupied"]').count());
  expect(mapOcc + mapFree).toBe(24);

  await page.goto('/dashboard');
  await expect(page.getByTestId('stat-occupied')).toBeVisible();
  expect(await digits(page, 'stat-occupied')).toBe(mapOcc);
  expect(await digits(page, 'stat-free')).toBe(mapFree);
  expect(await digits(page, 'stat-capacity')).toBe(24);
  await expect(page.getByTestId('history-chart')).toHaveAttribute('data-points', '7');
  await expect(page.locator('[data-testid^="history-row-"]')).toHaveCount(7);
  await expect(page.getByTestId('history-definition')).not.toBeEmpty();
});

test('map has 25 cells, a legend and a distinct A1 transfer cell', async ({ page }) => {
  await loginAs(page, 'auditor');
  await expect(page.locator('[data-testid^="location-cell-"]')).toHaveCount(25);
  await expect(page.getByTestId('map-legend')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveAttribute('data-state', 'transfer');
  await expect(cell(page, 'A1')).toContainText(/transfer/i);
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('map is usable at 375x812 without horizontal scroll', async ({ page }) => {
    await loginAs(page, 'auditor');
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();
    const box = await cell(page, 'E5').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(376);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const occupied = page.locator('[data-testid^="location-cell-"][data-state="occupied"]');
    if ((await occupied.count()) > 0) {
      await occupied.first().tap();
      await expect(page.getByTestId('location-detail')).toBeVisible();
      await expect(page.getByTestId('detail-pallet-number')).not.toBeEmpty();
    }
  });
});
