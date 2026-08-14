import { test, expect } from '@playwright/test';
import { PAGES, TIMEOUTS } from '../helpers/constants';

/**
 * Public Pages Smoke Tests
 *
 * Verify that all public pages load correctly without authentication.
 * These are the most basic sanity checks -- if any of these fail,
 * there is likely a build or routing issue.
 */

test.describe('Split application boundaries', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'VIBECHAT_LOCALE',
      value: 'en',
      url: 'http://localhost:8001',
    }])
  })

  test('site app renders the public brand shell', async ({ page }) => {
    await page.goto('http://localhost:8003/', { timeout: TIMEOUTS.navigation });

    // Page should load without errors
    await expect(page).not.toHaveTitle(/error|500|404/i);

    // The compact header, single intro section, and footer should be visible
    await expect(page.getByTestId('site-header')).toBeVisible();
    await expect(page.getByTestId('home-intro')).toBeVisible();
    await expect(page.getByTestId('site-footer')).toBeVisible();

    // The page has one concise content section and one primary heading
    await expect(page.locator('main section')).toHaveCount(1);
    await expect(page.locator('h1').first()).toBeVisible();

    // Template landing-page sections have been removed
    await expect(page.locator('main h2')).toHaveCount(0);
  });

  test('Sign in page loads and shows login form', async ({ page }) => {
    await page.goto(PAGES.signin, { timeout: TIMEOUTS.navigation });

    // Email OTP is the default; password auth remains available as an explicit mode.
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByTestId('signin-card')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Use password instead' }).click();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Should have a submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Sign up page loads and shows registration form', async ({ page }) => {
    await page.goto(PAGES.signup, { timeout: TIMEOUTS.navigation });

    // Should have name, email, and password inputs
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Should have a submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Forgot password page loads and shows form', async ({ page }) => {
    await page.goto(PAGES.forgotPassword, { timeout: TIMEOUTS.navigation });

    // Should have an email input
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Should have a button inside the form (the submit button may not have explicit type="submit")
    await expect(page.locator('form button').first()).toBeVisible();
  });

  test('web root is a product entry and backend health is same-origin', async ({ page }) => {
    await page.goto(PAGES.home, { timeout: TIMEOUTS.navigation });
    await expect(page).toHaveURL(/\/(messages|signin)$/);

    const health = await page.request.get('/api/health');
    expect(health.ok(), await health.text()).toBeTruthy();
    await expect(health.json()).resolves.toMatchObject({
      status: 'healthy',
      application: 'backend',
    });
  });
});
