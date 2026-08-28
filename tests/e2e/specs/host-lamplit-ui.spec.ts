import { expect, test, type Locator, type Page } from '@playwright/test'
import { completeChatOnboarding, createAndSignIn, signUpViaAPI } from '../helpers/auth'
import { uniqueEmail } from '../helpers/constants'

const password = 'VibeChat-e2e-password-2026!'

async function expectKernelTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)
}

async function expectTrustedKernelBoundary(page: Page, expectedSurface: string) {
  const kernel = page.getByTestId('space-kernel-bar')
  const iframe = page.getByTestId('space-app-surface').locator('iframe')

  await expect(kernel).toBeVisible()
  await expect(page.locator('.vc-live-space > .vc-kernel-bar')).toHaveCount(1)
  await expect(page.locator('.vc-live-space > .vc-live-app-stage')).toHaveCount(1)
  await expect(page.getByTestId('space-app-surface')).toHaveCount(1)
  await expect(iframe).toHaveCount(1)
  await expect(iframe).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-forms allow-popups allow-downloads',
  )

  const kernelStyle = await kernel.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    }
  })
  expect(kernelStyle.backgroundColor).toBe(expectedSurface)
  expect(kernelStyle.backgroundImage).not.toBe('none')

  await expectKernelTarget(kernel.locator('a.vc-kernel-icon'))
  await expectKernelTarget(page.getByTestId('space-kernel-reload'))
  await expectKernelTarget(page.getByTestId('space-kernel-publish'))
  await expectKernelTarget(page.getByTestId('space-kernel-menu'))

  return iframe.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      filter: style.filter,
      opacity: style.opacity,
      mixBlendMode: style.mixBlendMode,
    }
  })
}

test.describe('Lamplit non-Space host surfaces', () => {
  test('uses the Lamplit product shell across desktop and mobile product routes', async ({ page }) => {
    await createAndSignIn(page, {
      name: 'Lamplit Product User',
      email: uniqueEmail('lamplit-product'),
      password,
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/account')

    const shell = page.getByTestId('product-app-shell')
    await expect(shell).toHaveClass(/theme-lamplit/)
    await expect(page.getByTestId('product-primary-nav').locator('.vc-primary-link')).toHaveCount(4)
    await expect(page.getByTestId('product-primary-nav').locator('.vc-product-avatar')).toBeVisible()
    await expect(page.locator('.vc-mobile-nav')).toBeHidden()
    await expect(page.getByTestId('account-overview')).toBeVisible()
    await expect(page.locator('.vc-account-index')).toBeVisible()
    await expect(page.locator('.vc-product-tabs')).toHaveCount(0)
    await expect(page.locator('.vc-account-summary-row')).toHaveCount(4)
    await expect(page.locator('.vc-metric-card')).toHaveCount(0)

    const accountTabs = page.locator('.vc-account-index [role="tab"]')
    await expect(accountTabs).toHaveCount(5)
    await accountTabs.first().focus()
    await page.keyboard.press('End')
    await expect(accountTabs.last()).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('account-security')).toBeVisible()
    await page.keyboard.press('Home')
    await expect(accountTabs.first()).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('account-overview')).toBeVisible()

    const lightTokens = await shell.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        canvas: style.getPropertyValue('--vc-color-canvas').trim(),
        surface: style.getPropertyValue('--vc-color-surface').trim(),
        accent: style.getPropertyValue('--vc-color-accent').trim(),
      }
    })
    expect(lightTokens).toEqual({
      canvas: '#e9ece6',
      surface: '#fbfcf8',
      accent: '#a95436',
    })

    await page.goto('/services')
    await expect(page.getByTestId('pricing-plans')).toBeVisible()
    const plans = page.locator('.vc-plan-entry')
    if (await plans.count()) {
      await expect(page.getByTestId('service-plan-detail')).toBeVisible()
      await expect(page.locator('.vc-plan-threshold footer button')).toHaveCount(1)
      await expect(page.locator('.vc-plan-grid')).toHaveCount(0)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('product-primary-nav')).toBeHidden()
    await expect(page.locator('.vc-mobile-nav')).toBeVisible()
    await expect(page.locator('.vc-mobile-nav .vc-mobile-link')).toHaveCount(5)

    await page.goto('/account')
    await expect(page.locator('.vc-account-index [role="tab"]')).toHaveCount(5)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('stops Lamplit at the trusted Kernel boundary while preserving responsive host navigation', async ({ page }) => {
    test.skip(
      process.env.E2E_MATRIX_EXPECT_READY !== '1',
      'Requires the local Synapse Matrix-ready profile',
    )

    const suffix = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 5)}`
    const signUp = await signUpViaAPI(page, {
      name: 'Lamplit Matrix User',
      email: `e2e-lamplit-matrix-${suffix}@example.com`,
      password,
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page, {
      displayName: 'Lamplit Matrix User',
      username: `lamplit_${suffix}`.slice(0, 30),
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/spaces')
    const shell = page.getByTestId('chat-app-shell')
    await expect(shell).toHaveAttribute('data-ready', 'true')

    const templatesResponse = await page.request.get('/v1/spaces?locale=en')
    expect(templatesResponse.ok(), await templatesResponse.text()).toBeTruthy()
    const templates = await templatesResponse.json() as { spaces: Array<{ id: string }> }
    const roomResponse = await page.request.post('/v1/rooms', {
      data: {
        spaceId: templates.spaces[0].id,
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `lamplit-room-${crypto.randomUUID()}`,
        name: 'Lamplit regression room',
      },
    })
    expect(roomResponse.status(), await roomResponse.text()).toBe(201)
    const room = await roomResponse.json() as { matrixRoomId: string }

    await page.goto('/spaces')
    await expect(shell).toHaveAttribute('data-ready', 'true')
    await expect(shell).toHaveClass(/theme-lamplit/)
    await expect(page.getByTestId('chat-primary-nav').locator('.vc-primary-link')).toHaveCount(4)
    await expect(page.locator('.vc-spaces-stats')).toHaveCount(0)
    await expect(page.getByTestId('space-card')).toHaveCount(1)
    const spacesHeading = page.locator('.vc-corridor-intro h1')
    await expect(spacesHeading).toHaveCSS('font-weight', '400')
    const headingType = await spacesHeading.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        family: style.fontFamily,
        size: Number.parseFloat(style.fontSize),
      }
    })
    expect(headingType.family).not.toContain('VCLamplitDisplay')
    expect(headingType.size).toBeLessThanOrEqual(56)
    const spaceCard = page.getByTestId('space-card')
    await expect(spaceCard).toHaveClass(/vc-space-cover-card/)
    await expect(page.getByTestId('space-cover')).toBeVisible()
    await expect(page.locator('.vc-room-light, .vc-room-floor, .vc-room-people, .vc-room-utterance')).toHaveCount(0)
    const desktopCardBox = await spaceCard.boundingBox()
    expect(desktopCardBox?.width).toBeLessThanOrEqual(321)
    await expect(page.locator('.vc-inbox-overview')).toHaveCount(0)

    const roomUrl = `/spaces/${encodeURIComponent(room.matrixRoomId)}`
    await page.goto(roomUrl)
    await expect(shell).toHaveAttribute('data-space-open', 'true')
    const lightIframeStyle = await expectTrustedKernelBoundary(page, 'rgb(251, 252, 248)')
    const appUrl = await page.getByTestId('space-app-surface').locator('iframe').getAttribute('src')
    expect(lightIframeStyle).toEqual({ filter: 'none', opacity: '1', mixBlendMode: 'normal' })

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileLightIframeStyle = await expectTrustedKernelBoundary(page, 'rgb(251, 252, 248)')
    const mobileIdentityBox = await page.getByTestId('space-kernel-identity').boundingBox()
    const mobileContextBox = await page.getByTestId('space-kernel-context').boundingBox()
    expect(mobileContextBox?.y).toBeGreaterThan(mobileIdentityBox?.y ?? 0)
    expect(mobileLightIframeStyle).toEqual(lightIframeStyle)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.goto('/me')
    await page.locator('.vc-settings-row select').first().selectOption('dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(shell).toHaveCSS('--vc-color-canvas', '#10110f')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/spaces')
    await expect(page.getByTestId('chat-primary-nav')).toBeHidden()
    await expect(page.locator('.vc-mobile-nav')).toBeVisible()
    await expect(page.getByTestId('space-cover')).toBeVisible()
    await expect(page.getByTestId('space-list')).toHaveCount(0)
    const finderTrigger = page.locator('.vc-corridor-finder-button')
    await finderTrigger.click()
    await expect(page.getByTestId('space-list')).toBeVisible()
    await expect(page.locator('.vc-space-finder-panel')).toBeVisible()
    await expect.poll(() => page.locator('.vc-space-finder-panel').evaluate((panel) => panel.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('.vc-space-finder-panel')).toHaveCount(0)
    await expect(finderTrigger).toBeFocused()

    await page.goto(roomUrl)
    await expect(shell).toHaveAttribute('data-space-open', 'true')
    await expect(page.getByTestId('space-canvas')).toBeVisible()
    await expect(page.getByTestId('chat-primary-nav')).toBeHidden()
    await expect(page.locator('.vc-mobile-nav')).toBeHidden()
    const mobileDarkIframeStyle = await expectTrustedKernelBoundary(page, 'rgb(25, 26, 23)')
    expect(mobileDarkIframeStyle).toEqual(lightIframeStyle)
    await expect(page.getByTestId('space-app-surface').locator('iframe')).toHaveAttribute('src', appUrl || '')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.setViewportSize({ width: 1440, height: 900 })
    const desktopDarkIframeStyle = await expectTrustedKernelBoundary(page, 'rgb(25, 26, 23)')
    expect(desktopDarkIframeStyle).toEqual(lightIframeStyle)
    const desktopIdentityBox = await page.getByTestId('space-kernel-identity').boundingBox()
    const desktopContextBox = await page.getByTestId('space-kernel-context').boundingBox()
    expect(Math.abs((desktopIdentityBox?.y ?? 0) - (desktopContextBox?.y ?? 0))).toBeLessThan(8)
  })
})
