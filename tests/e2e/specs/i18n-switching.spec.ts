import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { TIMEOUTS } from '../helpers/constants'

const LOCALE_COOKIE = 'VIBECHAT_LOCALE'
const ORIGINS = {
  web: process.env.E2E_BASE_URL || 'http://localhost:8001',
  site: process.env.E2E_SITE_URL || 'http://localhost:8003',
  admin: process.env.E2E_ADMIN_URL || 'http://localhost:8005',
} as const

async function preferLocale(
  context: BrowserContext,
  locale: 'en' | 'zh-CN',
  origin = ORIGINS.web,
) {
  await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url: origin }])
}

async function expectLocalized404(
  page: Page,
  locale: 'en' | 'zh-CN',
  url: string,
) {
  const response = await page.goto(url, { timeout: TIMEOUTS.navigation })
  expect(response?.status()).toBe(404)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.getByRole('heading', {
    name: locale === 'en' ? "This page doesn't exist." : '没有找到这个页面。',
  })).toBeVisible()
}

test.describe('locale-neutral multi-app routing', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test('default locale renders without a URL prefix', async ({ page }) => {
    await page.goto(`${ORIGINS.web}/signin`, { timeout: TIMEOUTS.navigation })
    expect(new URL(page.url()).pathname).toBe('/signin')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('site language switching preserves pathname, search, and hash', async ({ page }) => {
    await page.goto(`${ORIGINS.site}/blog?page=1#posts`, {
      timeout: TIMEOUTS.navigation,
    })
    await page.waitForLoadState('networkidle')
    const original = new URL(page.url())

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.getByRole('button', { name: '切换语言' }).click(),
    ])

    const switched = new URL(page.url())
    expect(switched.pathname).toBe(original.pathname)
    expect(switched.search).toBe(original.search)
    expect(switched.hash).toBe(original.hash)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const localeCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === LOCALE_COOKIE,
    )
    expect(localeCookie?.value).toBe('en')
  })

  test('locale cookie is shared by Site, Web, and Admin on localhost', async ({ page, context }) => {
    await preferLocale(context, 'en', ORIGINS.site)

    for (const url of [
      `${ORIGINS.site}/`,
      `${ORIGINS.web}/signin`,
      `${ORIGINS.admin}/signin`,
    ]) {
      await page.goto(url, { timeout: TIMEOUTS.navigation })
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      expect(new URL(page.url()).pathname.startsWith('/en')).toBe(false)
    }
  })

  test('legacy locale-prefixed links become canonical URLs in every app', async ({ page }) => {
    const cases = [
      [`${ORIGINS.web}/en/signin?from=legacy`, '/signin', 'en'],
      [`${ORIGINS.site}/zh-CN/blog?page=1`, '/blog', 'zh-CN'],
      [`${ORIGINS.admin}/en/signin`, '/signin', 'en'],
    ] as const

    for (const [url, pathname, locale] of cases) {
      await page.context().clearCookies()
      await page.goto(url, { timeout: TIMEOUTS.navigation })
      const canonical = new URL(page.url())
      expect(canonical.pathname).toBe(pathname)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
    }
  })

  test('unknown locale-like prefixes render localized 404 pages', async ({ page, context }) => {
    for (const locale of ['en', 'zh-CN'] as const) {
      await context.clearCookies()
      await preferLocale(context, locale)
      await expectLocalized404(page, locale, `${ORIGINS.web}/fr/spaces`)
      await expectLocalized404(page, locale, `${ORIGINS.site}/fr/blog`)
      await expectLocalized404(page, locale, `${ORIGINS.admin}/fr/admin`)
    }
  })
})
