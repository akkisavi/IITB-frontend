import { expect, type Page } from '@playwright/test';
import { creds, type Role } from './env';

export async function loginUi(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

export async function loginAs(page: Page, role: Role) {
  const { username, password } = creds(role);
  await loginUi(page, username, password);
  await expect(page.getByTestId('current-user')).toHaveAttribute('data-role', role);
  await expect(page.getByTestId('warehouse-grid')).toBeVisible();
}

export const cell = (page: Page, code: string) => page.getByTestId(`location-cell-${code}`);

export async function digits(page: Page, testId: string): Promise<number> {
  const t = (await page.getByTestId(testId).innerText()).replace(/[^0-9]/g, '');
  return Number(t);
}

/** Nav links may live in a collapsed drawer on narrow screens; open it if needed. */
export async function openNavIfCollapsed(page: Page) {
  const toggle = page.getByTestId('nav-menu-toggle');
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
}
