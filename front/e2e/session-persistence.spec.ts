import { expect, test } from '@playwright/test';

const login = process.env.GAPAK_E2E_LOGIN;
const password = process.env.GAPAK_E2E_PASSWORD;

test('login survives profile navigation and a full browser reload', async ({ page }) => {
  test.skip(!login || !password, 'Requires GAPAK_E2E_LOGIN and GAPAK_E2E_PASSWORD for a dedicated test account.');

  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(login!);
  await page.locator('input[autocomplete="current-password"]').fill(password!);
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/posts(?:[/?#]|$)/);

  await page.goto('/users/me');
  await expect(page).toHaveURL(/\/users\/me(?:[/?#]|$)/);
  await expect(page.getByRole('button', { name: 'Account settings' })).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });

  await expect(page).toHaveURL(/\/users\/me(?:[/?#]|$)/);
  await expect(page).not.toHaveURL(/\/(?:login|register)(?:[/?#]|$)/);
  await expect(page.getByRole('button', { name: 'Account settings' })).toBeVisible();
});
