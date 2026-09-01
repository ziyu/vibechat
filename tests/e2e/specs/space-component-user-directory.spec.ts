import { expect, test } from '@playwright/test'

const catalogUrl = `file://${process.cwd()}/packages/space-app-components/dist/catalog.html`

test.describe('Space component User and Member public layer', () => {
  test('keeps directory, presence and Mention identity accessible and keyboard-complete', async ({ page }) => {
    const browserErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        browserErrors.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => {
      browserErrors.push(`pageerror: ${error.stack ?? error.message}`)
    })
    await page.route('**/missing-*.png', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: 'invalid image fixture',
      })
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
    await page.goto(catalogUrl)

    const world = page.locator('.world').first()
    const memberList = world.locator('[data-catalog-members]')
    const options = memberList.getByRole('option')
    await expect(options).toHaveCount(3)
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(options.nth(0)).toHaveAttribute('tabindex', '0')
    await expect(options.nth(1)).toHaveAttribute('tabindex', '-1')
    await expect(options.nth(2)).toBeDisabled()
    await expect(options.nth(0)).toHaveAccessibleName(/Alice Chen.*@alice\.maps.*Online/)
    await expect(options.nth(0).locator('vc-space-user-presence').locator('[part="label"]'))
      .toHaveText('Online')
    await expect(world.locator('[data-catalog-empty]').getByRole('status'))
      .toHaveText('No members to show')

    await options.nth(0).focus()
    await page.keyboard.press('ArrowDown')
    await expect(options.nth(1)).toBeFocused()
    await expect(options.nth(1)).toHaveAttribute('tabindex', '0')
    await page.keyboard.press('End')
    await expect(options.nth(1)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(options.nth(0)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(options.nth(1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(world.locator('[data-catalog-log]')).toHaveText('member-select: morgan')
    await options.nth(0).focus()
    await page.keyboard.press('Space')
    await expect(world.locator('[data-catalog-log]')).toHaveText('member-select: alice')

    const mentionOptions = world.locator('[data-catalog-mentions]').getByRole('option')
    await expect(mentionOptions).toHaveCount(3)
    await expect(mentionOptions.nth(0).locator('vc-space-mention-target-item'))
      .toHaveAttribute('role', 'group')
    await expect(mentionOptions.nth(1)).toContainText('Agent')
    await expect(mentionOptions.nth(2)).toContainText('Unavailable')
    await expect(mentionOptions.nth(2)).toBeDisabled()
    await mentionOptions.nth(0).focus()
    await page.keyboard.press('ArrowDown')
    await expect(mentionOptions.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(mentionOptions.nth(1)).toBeFocused()

    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await expect.poll(() => page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))).toEqual({ clientWidth: 390, scrollWidth: 390 })
    await expect.poll(() => memberList.evaluate((element) => ({
      insideViewport: element.getBoundingClientRect().right <= window.innerWidth,
      animations: element.getAnimations({ subtree: true }).length,
      minimumTarget: Math.min(...Array.from(
        element.shadowRoot?.querySelectorAll('button') ?? [],
        (button) => button.getBoundingClientRect().height,
      )) >= 44,
      readableColumns: Array.from(
        element.shadowRoot?.querySelectorAll('vc-space-member-list-item') ?? [],
        (item) => item.shadowRoot?.querySelector('[part="identity"]')
          ?.getBoundingClientRect().width ?? 0,
      ).every((width) => width >= 120),
    }))).toEqual({
      insideViewport: true,
      animations: 0,
      minimumTarget: true,
      readableColumns: true,
    })
    expect(browserErrors).toEqual([])
  })
})
