import { expect, test } from '@playwright/test'
import { completeChatOnboarding, signInViaAPI, signUpViaAPI } from '../helpers/auth'

test.describe('Vibe Chat browser session management', () => {
  test.setTimeout(90_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('lists sessions, revokes another Matrix device, and clears local data on sign-out', async ({ browser }) => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const email = `e2e-session-ui-${suffix}@example.com`
    const password = 'VibeChat-e2e-password-2026!'
    const firstContext = await browser.newContext()
    const secondContext = await browser.newContext()

    try {
      const firstPage = await firstContext.newPage()
      const secondPage = await secondContext.newPage()
      const signUp = await signUpViaAPI(firstPage, {
        name: 'Session UI E2E',
        email,
        password,
      })
      expect(signUp.ok(), await signUp.text()).toBeTruthy()
      await completeChatOnboarding(firstPage)
      const firstBootstrapResponse = await firstPage.request.get('/v1/session/bootstrap')
      expect(firstBootstrapResponse.ok(), await firstBootstrapResponse.text()).toBeTruthy()
      const firstBootstrap = await firstBootstrapResponse.json()

      const signIn = await signInViaAPI(secondPage, { email, password })
      expect(signIn.ok(), await signIn.text()).toBeTruthy()
      const secondBootstrapResponse = await secondPage.request.get('/v1/session/bootstrap')
      expect(secondBootstrapResponse.ok(), await secondBootstrapResponse.text()).toBeTruthy()
      const secondBootstrap = await secondBootstrapResponse.json()
      expect(secondBootstrap.matrix.deviceId).not.toBe(firstBootstrap.matrix.deviceId)

      await firstPage.goto('/me')
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await firstPage.getByTestId('manage-sessions').click()
      await expect(firstPage.getByTestId('browser-session')).toHaveCount(2)
      await expect(
        firstPage.locator('[data-testid="browser-session"][data-current]'),
      ).toHaveCount(1)

      await firstPage.getByRole('button', { name: '撤销其他设备' }).click()
      await expect(firstPage.getByTestId('browser-session')).toHaveCount(1)
      await expect.poll(async () => (
        await secondPage.request.get('/v1/session/bootstrap')
      ).status()).toBe(401)
      const secondWhoami = await secondPage.request.get(
        'http://localhost:8008/_matrix/client/v3/account/whoami',
        { headers: { authorization: `Bearer ${secondBootstrap.matrix.accessToken}` } },
      )
      expect(secondWhoami.status()).toBe(401)

      await firstPage.evaluate(() => {
        window.localStorage.setItem('vibechat-chat-ui-v1', JSON.stringify({ marker: 'clear-on-signout' }))
      })
      const syncDatabaseName = `matrix-js-sdk:vibechat-sync-${firstBootstrap.matrix.deviceId}`
      await expect.poll(async () => firstPage.evaluate(async (name) => (
        await window.indexedDB.databases()
      ).some((database) => database.name === name), syncDatabaseName)).toBe(true)

      await firstPage.getByTestId('chat-sign-out').click()
      await expect(firstPage).toHaveURL('/signin')
      const firstBootstrapAfterSignOut = await firstPage.request.get('/v1/session/bootstrap')
      expect(firstBootstrapAfterSignOut.status()).toBe(401)
      const firstWhoami = await firstPage.request.get(
        'http://localhost:8008/_matrix/client/v3/account/whoami',
        { headers: { authorization: `Bearer ${firstBootstrap.matrix.accessToken}` } },
      )
      expect(firstWhoami.status()).toBe(401)
      await expect.poll(async () => firstPage.evaluate(async (name) => (
        await window.indexedDB.databases()
      ).some((database) => database.name === name), syncDatabaseName)).toBe(false)
      await expect(firstPage.evaluate(() => (
        window.localStorage.getItem('vibechat-chat-ui-v1')
      ))).resolves.toBeNull()
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })
})
