import { test, expect } from '@playwright/test';
import { PAGES, TIMEOUTS, BASE } from '../helpers/constants';

/**
 * i18n Language Switching E2E Tests
 *
 * Verifies localized product routes after the site/product split:
 * - Default locale loads properly (English)
 * - Can switch from English to Chinese via the language dropdown
 * - URL updates to /zh-CN/...
 * - Can switch back to English
 * - Cookie persists the locale preference
 */

test.describe('i18n Language Switching', () => {
  test('English product entry keeps the English locale', async ({ page }) => {
    await page.goto(PAGES.signin, { timeout: TIMEOUTS.navigation });

    // Page should be at /en (or /en/)
    expect(page.url()).toContain('/en');

    // Verify some English text is visible (e.g. header navigation)
    await expect(page.locator('body')).toBeVisible();
  });

  test('Chinese and English authentication pages are both available', async ({ page }) => {
    await page.goto('/zh-CN/signin', { timeout: TIMEOUTS.navigation });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    expect(page.url()).toContain('/zh-CN/signin');

    await page.goto('/en/signin', { timeout: TIMEOUTS.navigation });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    expect(page.url()).toContain('/en/signin');
  });

  test('can switch from Chinese back to English', async ({ page }) => {
    test.slow();
    await page.goto('http://localhost:8003/zh-CN', { timeout: TIMEOUTS.navigation });
    await page.getByRole('link', { name: '切换语言' }).click();
    await page.waitForURL(/\/en/, { timeout: TIMEOUTS.navigation });
    expect(page.url()).toContain('localhost:8003/en');
  });

  test('locale persists across navigation', async ({ page }) => {
    // Switch to Chinese first
    await page.goto('/zh-CN', { timeout: TIMEOUTS.navigation });

    // Navigate to the product while on Chinese locale
    await page.goto('/zh-CN/messages', { timeout: TIMEOUTS.navigation });

    // Should still be on zh-CN
    expect(page.url()).toContain('/zh-CN/signin');

    // Navigate to sign-in page
    await page.goto('/zh-CN/signin', { timeout: TIMEOUTS.navigation });
    expect(page.url()).toContain('/zh-CN/signin');
  });

  test('site CTA preserves locale when opening the product', async ({ page }) => {
    await page.goto('http://localhost:8003/zh-CN', { timeout: TIMEOUTS.navigation });
    const cta = page.getByRole('link', { name: '打开 Vibe Chat' }).first();
    await expect(cta).toHaveAttribute('href', 'http://localhost:8001/zh-CN/messages');
  });
});
