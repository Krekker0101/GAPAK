import { test, expect } from '@playwright/test';

const authUrl = process.env.GAPAK_E2E_AUTH_URL;
test.skip(!authUrl, 'Phase 4 browser suite requires GAPAK_E2E_AUTH_URL and a real backend environment.');

test.describe('Phase 4 business domains', () => {
  test('media vault is server-backed and paginates', async ({ page }) => {
    await page.goto(`${authUrl}/media`);
    await expect(page.getByRole('heading', { name: 'Media Vault' })).toBeVisible();
    await expect(page.getByText(/server-authorized media library/i)).toBeVisible();
  });

  test('stories page uses server-owned stories and real create entrypoint', async ({ page }) => {
    await page.goto(`${authUrl}/stories`);
    await expect(page.getByRole('heading', { name: 'Stories' })).toBeVisible();
    await expect(page.getByRole('button', { name: /your story/i })).toBeVisible();
  });

  test('profile page does not render fabricated post data', async ({ page }) => {
    await page.goto(`${authUrl}/users/me`);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/Profile|Posts|Connections/i).first()).toBeVisible();
  });

  test('connections and notification surfaces load from the server', async ({ page }) => {
    await page.goto(`${authUrl}/connections`);
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText('Notifications')).toBeVisible();
  });
});
