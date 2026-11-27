import { test, expect } from '@playwright/test';
import { anonApi, apiAs, freeLocations, uniquePallet } from './support/api';
import { creds } from './support/env';
import { loginAs, loginUi, openNavIfCollapsed } from './support/ui';

test.describe('authentication and role gating (UI)', () => {
  test('invalid credentials show login error', async ({ page }) => {
    await loginUi(page, 'nobody_e2e', 'definitely-wrong-pass');
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin sees every nav link and the load button', async ({ page }) => {
    await loginAs(page, 'admin');
    await openNavIfCollapsed(page);
    for (const id of ['nav-map', 'nav-pallets', 'nav-shuttle', 'nav-dashboard', 'nav-users']) {
      await expect(page.getByTestId(id).first()).toBeVisible();
    }
    await expect(page.getByTestId('load-button')).toBeVisible();
  });

  test('auditor: dashboard link, no users link, no load button, /users forbidden', async ({ page }) => {
    await loginAs(page, 'auditor');
    await expect(page.getByTestId('nav-dashboard').first()).toBeVisible();
    await expect(page.getByTestId('nav-users')).toHaveCount(0);
    await expect(page.getByTestId('load-button')).toHaveCount(0);
    await page.goto('/users');
    await expect(page.getByTestId('forbidden')).toBeVisible();
  });

  test('technician: no dashboard/users links, load button present, /dashboard forbidden', async ({ page }) => {
    await loginAs(page, 'technician');
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
    await expect(page.getByTestId('nav-users')).toHaveCount(0);
    await expect(page.getByTestId('load-button')).toBeVisible();
    await page.goto('/dashboard');
    await expect(page.getByTestId('forbidden')).toBeVisible();
  });

  test('logout returns to login and protected route redirects', async ({ page }) => {
    await loginAs(page, 'technician');
    await openNavIfCollapsed(page);
    await page.getByTestId('logout-button').first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/overview/);
    await page.goto('/pallets');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('backend enforces permissions', () => {
  test('auditor POST load -> 403 and nothing stored', async () => {
    const auditor = await apiAs('auditor');
    const free = await freeLocations(auditor);
    test.skip(free.length === 0, 'warehouse is full');
    const res = await auditor.post('/api/operations/load/', { data: { ...uniquePallet(), location: free[0] } });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('permission_denied');
    const after = await auditor.get(`/api/locations/${free[0]}/`);
    expect((await after.json()).state).toBe('free');
    await auditor.dispose();
  });

  test('technician GET /api/users/ and /api/dashboard/ -> 403', async () => {
    const tech = await apiAs('technician');
    expect((await tech.get('/api/users/')).status()).toBe(403);
    expect((await tech.get('/api/dashboard/')).status()).toBe(403);
    await tech.dispose();
  });

  test('unauthenticated requests -> 401; /health/ is public', async () => {
    const anon = await anonApi();
    expect((await anon.get('/api/locations/')).status()).toBe(401);
    expect((await anon.post('/api/operations/load/', { data: {} })).status()).toBe(401);
    expect((await anon.get('/api/users/')).status()).toBe(401);
    expect((await anon.get('/health/')).status()).toBe(200);
    await anon.dispose();
  });

  test('API login response carries the role', async () => {
    const anon = await anonApi();
    const { username, password } = creds('auditor');
    const res = await anon.post('/api/auth/login/', { data: { username, password } });
    expect(res.status()).toBe(200);
    expect((await res.json()).user.role).toBe('auditor');
    await anon.dispose();
  });
});
