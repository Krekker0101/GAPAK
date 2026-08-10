import { test, expect } from '@playwright/test';

test('critical production happy path', async ({ page }) => {
  test.skip(!process.env.GAPAK_E2E_AUTH_URL, 'Requires a real backend-authenticated test environment; current frontend has no production login screen.');

  await page.goto(process.env.GAPAK_E2E_AUTH_URL!);
  await expect(page).toHaveURL(/posts|feed/);
  await page.getByRole('link', { name: /profile/i }).click();
  await expect(page).toHaveURL(/@|users/);
  await page.getByRole('link', { name: /connections/i }).click();
  await page.getByRole('link', { name: /chat/i }).click();
  await page.getByRole('textbox').first().fill('production e2e message');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText('production e2e message')).toBeVisible();
  await page.getByRole('link', { name: /media/i }).click();
  await expect(page).toHaveURL(/media/);
  await page.getByRole('button', { name: /logout/i }).click();
});
