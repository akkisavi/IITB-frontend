import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { anonApi, apiAs } from './support/api';
import { loginAs, loginUi } from './support/ui';

test('admin creates a user, user logs in, admin deactivates, login then fails', async ({ browser }) => {
  const username = `e2e_${Date.now().toString(36)}`;
  const password = `E2e-${randomBytes(9).toString('hex')}`; // generated per run, never hardcoded

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, 'admin');
  await admin.goto('/users');
  await admin.getByTestId('add-user-button').click();
  await expect(admin.getByTestId('create-user-dialog')).toBeVisible();
  await admin.getByTestId('create-user-username').fill(username);
  await admin.getByTestId('create-user-password').fill(password);
  await admin.getByTestId('create-user-role').selectOption('auditor');
  await admin.getByTestId('create-user-submit').click();
  await expect(admin.getByTestId('create-user-dialog')).toHaveCount(0);
  // The table is paginated, so find the new row through search rather than assuming page 1.
  await admin.getByRole('searchbox', { name: 'Search users' }).fill(username);
  await expect(admin.getByTestId(`user-row-${username}`)).toBeVisible();
  await expect(admin.getByTestId(`user-status-${username}`)).toHaveText(/^\s*active\s*$/i);

  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await loginUi(user, username, password);
  await expect(user.getByTestId('current-user')).toHaveAttribute('data-role', 'auditor');
  await userCtx.close();

  await admin.getByTestId(`user-deactivate-${username}`).click();
  // Accept a confirmation dialog if the UI shows one.
  const confirm = admin.getByRole('dialog').getByRole('button', { name: /deactivate|confirm|yes/i });
  if (await confirm.first().isVisible({ timeout: 1000 }).catch(() => false)) await confirm.first().click();
  await expect(admin.getByTestId(`user-status-${username}`)).toHaveText(/inactive/i);
  await adminCtx.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await loginUi(p2, username, password);
  await expect(p2.getByTestId('login-error')).toBeVisible();
  await ctx2.close();

  const anon = await anonApi();
  const res = await anon.post('/api/auth/login/', { data: { username, password } });
  expect(res.status()).toBe(400);
  expect((await res.json()).code).toBe('invalid_credentials');
  await anon.dispose();
});

test('API rejects weak passwords and non-admin user creation', async () => {
  const admin = await apiAs('admin');
  const weak = await admin.post('/api/users/', {
    data: { username: `e2e_w_${Date.now().toString(36)}`, password: 'short pass', role: 'auditor' },
  });
  expect(weak.status()).toBe(400);
  await admin.dispose();

  const auditor = await apiAs('auditor');
  const forbidden = await auditor.post('/api/users/', {
    data: { username: `e2e_x_${Date.now().toString(36)}`, password: randomBytes(10).toString('hex'), role: 'admin' },
  });
  expect(forbidden.status()).toBe(403);
  await auditor.dispose();
});
