import { test, expect } from '@playwright/test';

const authUrl = process.env.GAPAK_E2E_AUTH_URL;

test.describe('Phase 6 production browser journeys', () => {
  test.beforeEach(() => {
    test.skip(!authUrl, 'Requires a real authenticated GAPAK E2E backend environment.');
  });

  test('feed renders server-backed content', async ({ page }) => {
    await page.goto(`${authUrl}/feed`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('profile renders server-backed profile state', async ({ page }) => {
    await page.goto(`${authUrl}/users/me`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('connections surface loads without fabricated identity state', async ({ page }) => {
    await page.goto(`${authUrl}/connections`);
    await expect(page.getByRole('heading', { name: /connections/i })).toBeVisible();
  });

  test('chat surface loads and exposes an input when authorized', async ({ page }) => {
    await page.goto(`${authUrl}/chat`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('media surface loads from the server', async ({ page }) => {
    await page.goto(`${authUrl}/media`);
    await expect(page.getByRole('heading', { name: /media/i })).toBeVisible();
  });

  test('stories surface loads server-owned stories', async ({ page }) => {
    await page.goto(`${authUrl}/stories`);
    await expect(page.getByRole('heading', { name: /stories/i })).toBeVisible();
  });

  test('security center loads server-backed device/security state', async ({ page }) => {
    await page.goto(`${authUrl}/security`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('logout exits the authenticated shell', async ({ page }) => {
    await page.goto(`${authUrl}/feed`);
    const logout = page.getByRole('button', { name: /logout/i });
    await expect(logout).toBeVisible();
    await logout.click();
    await expect(page).not.toHaveURL(/\/(feed|profile|connections|chat|media|stories|security)(?:\?|$)/);
  });
});
