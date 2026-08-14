import { test, expect } from '@playwright/test'
import { PAGES, TIMEOUTS } from '../helpers/constants'

const LOCALE_COOKIE = 'VIBECHAT_LOCALE'
const APP_URL = process.env.E2E_BASE_URL || 'http://localhost:7001'

test.describe('locale-neutral product routing', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test('default locale renders without a URL prefix', async ({ page }) => {
    await page.goto(PAGES.home, { timeout: TIMEOUTS.navigation })

    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.locator('body')).toBeVisible()
  })

  test('language switching preserves pathname, search, and hash', async ({ page }) => {
    await page.goto('/pricing?tab=credits#plans', { timeout: TIMEOUTS.navigation })
    const originalUrl = new URL(page.url())
    await page.waitForFunction(
      () => typeof (window as Window & { $_TSR?: unknown }).$_TSR === 'undefined',
    )

    const languageButton = page.locator('[data-slot="dropdown-menu-trigger"]')
    await expect(languageButton).toHaveAttribute('aria-haspopup', 'menu')
    await languageButton.click()
    const englishOption = page.getByRole('menuitem', { name: /English/ })
    await expect(englishOption).toBeVisible()

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      englishOption.click(),
    ])

    const switchedUrl = new URL(page.url())
    expect(switchedUrl.pathname).toBe(originalUrl.pathname)
    expect(switchedUrl.search).toBe(originalUrl.search)
    expect(switchedUrl.hash).toBe(originalUrl.hash)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const localeCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === LOCALE_COOKIE,
    )
    expect(localeCookie?.value).toBe('en')
  })

  test('locale cookie persists across reload and navigation', async ({ page, context }) => {
    await context.addCookies([
      { name: LOCALE_COOKIE, value: 'en', url: APP_URL },
    ])

    await page.goto('/pricing', { timeout: TIMEOUTS.navigation })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.goto('/signin', { timeout: TIMEOUTS.navigation })

    expect(new URL(page.url()).pathname).toBe('/signin')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('legacy locale-prefixed links become canonical URLs', async ({ page, context }) => {
    for (const locale of ['en', 'zh-CN']) {
      await context.clearCookies()
      await page.goto(`/${locale}/pricing?tab=credits`, {
        timeout: TIMEOUTS.navigation,
      })

      const url = new URL(page.url())
      expect(url.pathname).toBe('/pricing')
      expect(url.search).toBe('?tab=credits')
      await expect(page.locator('html')).toHaveAttribute('lang', locale)

      const localeCookie = (await context.cookies()).find(
        (cookie) => cookie.name === LOCALE_COOKIE,
      )
      expect(localeCookie?.value).toBe(locale)
    }
  })

  test('unknown locale-like prefixes render a localized 404', async ({ page, context }) => {
    const consoleMessages: string[] = []
    page.on('console', (message) => consoleMessages.push(message.text()))

    for (const locale of ['en', 'zh-CN']) {
      await context.clearCookies()
      await context.addCookies([
        { name: LOCALE_COOKIE, value: locale, url: APP_URL },
      ])

      const response = await page.goto('/fr/pricing', {
        timeout: TIMEOUTS.navigation,
      })
      expect(response?.status()).toBe(404)
      expect(new URL(page.url()).pathname).toBe('/fr/pricing')
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await expect(page.getByRole('heading', {
        name: locale === 'en' ? "This page doesn't exist." : '没有找到这个页面。',
      })).toBeVisible()
      await expect(page.getByRole('link', {
        name: locale === 'en' ? 'Back to home' : '返回首页',
      })).toHaveAttribute('href', '/')
      await expect(page).toHaveTitle(
        locale === 'en' ? 'Vibe Chat - Page Not Found' : 'Vibe Chat - 页面不存在',
      )
    }

    expect(consoleMessages.some((message) => message.includes('notFoundComponent'))).toBe(false)
  })

  test('canonical sub-pages render in both supported locales', async ({ page, context }) => {
    for (const locale of ['en', 'zh-CN']) {
      await context.addCookies([
        { name: LOCALE_COOKIE, value: locale, url: APP_URL },
      ])
      await page.goto('/pricing', { timeout: TIMEOUTS.navigation })
      expect(new URL(page.url()).pathname).toBe('/pricing')
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await expect(page.locator('h1, h2').first()).toBeVisible({
        timeout: TIMEOUTS.navigation,
      })
    }
  })

  test('authentication redirects preserve a safe canonical return target', async ({ page }) => {
    await page.goto('/dashboard?tab=account', { timeout: TIMEOUTS.navigation })

    const url = new URL(page.url())
    expect(url.pathname).toBe('/signin')
    expect(url.searchParams.get('returnTo')).toBe('/dashboard?tab=account')
  })

  test('payment callbacks render directly on canonical routes', async ({ page }) => {
    await page.goto('/payment-success?provider=wechat&order_id=e2e-locale', {
      timeout: TIMEOUTS.navigation,
    })
    let url = new URL(page.url())
    expect(url.pathname).toBe('/payment-success')
    expect(url.searchParams.get('order_id')).toBe('e2e-locale')
    await expect(page.locator('h1')).toBeVisible()

    await page.goto('/payment-cancel?provider=stripe', {
      timeout: TIMEOUTS.navigation,
    })
    url = new URL(page.url())
    expect(url.pathname).toBe('/payment-cancel')
    expect(url.searchParams.get('provider')).toBe('stripe')
    await expect(page.locator('h1')).toBeVisible()
  })
})
