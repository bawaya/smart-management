import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

test.use({ storageState: storageStatePath('owner') });

test.describe('PWA — Manifest + Service Worker', () => {
  test('manifest.json loads + valid', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);

    const text = await page.locator('body').textContent();
    if (!text) throw new Error('Empty manifest');

    const manifest = JSON.parse(text);
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('service worker registration status', async ({ page }) => {
    await page.goto('/');
    const hasSW = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    console.log(`Service Worker registered: ${hasSW}`);
    // Don't fail — SW is optional for PWA
  });

  test('manifest linked in <head>', async ({ page }) => {
    await page.goto('/');
    const manifestLink = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifestLink).toBeTruthy();
  });

  test('app icon accessible', async ({ page }) => {
    await page.goto('/manifest.json');
    const text = await page.locator('body').textContent();
    const manifest = JSON.parse(text!);
    const firstIcon = manifest.icons[0];
    test.skip(!firstIcon?.src, 'No icon in manifest');

    const iconResponse = await page.goto(firstIcon.src);
    expect(
      iconResponse?.status(),
      `Icon 404: ${firstIcon.src}`,
    ).toBe(200);
  });

  test('theme-color meta tag', async ({ page }) => {
    await page.goto('/');
    const themeColor = await page
      .locator('meta[name="theme-color"]')
      .getAttribute('content')
      .catch(() => null);
    console.log(`theme-color: ${themeColor ?? 'not set'}`);
    // Don't assert — informational only
  });
});
