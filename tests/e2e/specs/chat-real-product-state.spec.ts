import { expect, test } from '@playwright/test'
import { completeChatOnboarding, signInViaAPI, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'

test.describe('Vibe Chat protected product routes', () => {
  test('routes password sign-up into required product onboarding', async ({ page }) => {
    const suffix = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`
    await page.goto('/signup')
    await expect(page.getByTestId('password-signup-form')).toHaveAttribute('data-ready', 'true')
    await page.getByLabel('姓名', { exact: true }).fill('真实注册用户')
    await page.getByLabel('邮箱', { exact: true }).fill(`e2e-ui-signup-${suffix}@example.com`)
    await page.getByLabel('密码', { exact: true }).fill(password)
    await page.getByRole('button', { name: '创建账户', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByTestId('onboarding-page')).toBeVisible()
  })

  for (const path of ['messages', 'contacts', 'discover', 'me', 'rooms/not-a-room']) {
    test(`redirects unauthenticated /${path} without rendering product data`, async ({ page }) => {
      await page.goto(`/${path}`)
      await expect(page).toHaveURL(/\/signin$/)
      await expect(page.getByTestId('chat-app-shell')).toHaveCount(0)
      await expect(page.getByText(/River|林林/)).toHaveCount(0)
    })
  }

  test('protects product-state and atmosphere directory APIs', async ({ request }) => {
    for (const path of ['/v1/product-state', '/v1/spaces?locale=zh-CN']) {
      const response = await request.get(path)
      expect(response.status()).toBe(401)
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'AUTH_SESSION_REQUIRED' },
      })
    }
  })
})

test.describe('Vibe Chat real persisted product state', () => {
  test.setTimeout(120_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('fails closed when the authenticated Matrix bootstrap is unavailable', async ({ page }) => {
    const suffix = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 5)}`
    const signUp = await signUpViaAPI(page, {
      name: 'Unavailable Matrix User',
      email: `e2e-state-unavailable-${suffix}@example.com`,
      password,
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page, {
      displayName: 'Unavailable Matrix User',
      username: `unavailable_${suffix}`.slice(0, 30),
    })
    const readyBootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(readyBootstrapResponse.ok(), await readyBootstrapResponse.text()).toBeTruthy()
    const readyBootstrap = await readyBootstrapResponse.json()

    await page.route('**/v1/session/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...readyBootstrap,
          matrix: { status: 'unavailable', reason: 'SYNAPSE_NOT_CONFIGURED' },
        }),
      })
    })
    await page.goto('/messages')

    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'false')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-sync-state', 'UNAVAILABLE')
    await expect(page.getByTestId('chat-service-state')).toContainText('消息服务尚未配置')
    await expect(page.getByTestId('message-input')).toHaveCount(0)
    await expect(page.getByText(/River|林林/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  })

  test('uses account-scoped server state for empty UI, preferences, favorites, and rooms', async ({ browser }) => {
    const suffix = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 5)}`
    const firstContext = await browser.newContext()
    const secondSessionContext = await browser.newContext()
    const otherUserContext = await browser.newContext()
    const firstPage = await firstContext.newPage()
    const secondSessionPage = await secondSessionContext.newPage()
    const otherUserPage = await otherUserContext.newPage()
    const email = `e2e-state-a-${suffix}@example.com`
    const otherEmail = `e2e-state-b-${suffix}@example.com`

    try {
      const signUp = await signUpViaAPI(firstPage, { name: 'State Alice', email, password })
      expect(signUp.ok(), await signUp.text()).toBeTruthy()
      await completeChatOnboarding(firstPage, {
        displayName: 'State Alice',
        username: `state_a_${suffix}`.slice(0, 30),
      })

      await firstPage.goto('/messages')
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await expect(firstPage.getByTestId('conversation-row')).toHaveCount(0)
      await expect(firstPage.getByText(/River|林林/)).toHaveCount(0)

      const directoryResponse = await firstPage.request.get('/v1/spaces?locale=zh-CN')
      expect(directoryResponse.ok(), await directoryResponse.text()).toBeTruthy()
      const directory = await directoryResponse.json()
      expect(directory.spaces).toHaveLength(4)
      expect(directory.spaces[0]).toMatchObject({
        id: 'space-campfire',
        versionId: 'builtin-space-campfire-v1',
        source: 'builtin',
        official: true,
      })

      await firstPage.goto('/discover/spaces/space-campfire')
      await expect(firstPage.getByTestId('space-detail')).toBeVisible()
      await firstPage.getByRole('button', { name: '收藏' }).click()
      await expect(firstPage.getByRole('button', { name: '已收藏' })).toBeVisible()

      const preferencesResponse = await firstPage.request.patch('/v1/product-state', {
        data: { notificationsEnabled: false, theme: 'dark', locale: 'zh-CN' },
      })
      expect(preferencesResponse.ok(), await preferencesResponse.text()).toBeTruthy()

      const roomResponse = await firstPage.request.post('/v1/rooms', {
        data: {
          spaceId: 'space-campfire',
          participantUserIds: [],
          instanceConfig: {},
          clientRequestId: `state-room-${crypto.randomUUID()}`,
          name: '持久化状态房间',
        },
      })
      expect(roomResponse.status(), await roomResponse.text()).toBe(201)
      const room = await roomResponse.json()
      const roomPreferenceResponse = await firstPage.request.put(
        `/v1/rooms/${encodeURIComponent(room.matrixRoomId)}/preferences`,
        { data: { pinned: true, muted: true } },
      )
      expect(roomPreferenceResponse.ok(), await roomPreferenceResponse.text()).toBeTruthy()

      const signInSecondSession = await signInViaAPI(secondSessionPage, { email, password })
      expect(signInSecondSession.ok(), await signInSecondSession.text()).toBeTruthy()
      const persisted = await secondSessionPage.request.get('/v1/product-state')
      expect(persisted.ok(), await persisted.text()).toBeTruthy()
      await expect(persisted.json()).resolves.toMatchObject({
        preferences: { notificationsEnabled: false, theme: 'dark', locale: 'zh-CN' },
        favoriteSpaceIds: ['space-campfire'],
        roomPreferences: [{
          matrixRoomId: room.matrixRoomId,
          pinned: true,
          muted: true,
        }],
      })
      await secondSessionPage.goto('/messages')
      await expect(secondSessionPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await expect(secondSessionPage.getByTestId('conversation-row')).toContainText('持久化状态房间')
      await expect(secondSessionPage.getByTestId('conversation-row').locator('[aria-label="已静音"]')).toBeVisible()

      const otherSignUp = await signUpViaAPI(otherUserPage, {
        name: 'State Bob',
        email: otherEmail,
        password,
      })
      expect(otherSignUp.ok(), await otherSignUp.text()).toBeTruthy()
      await completeChatOnboarding(otherUserPage, {
        displayName: 'State Bob',
        username: `state_b_${suffix}`.slice(0, 30),
      })
      const otherState = await otherUserPage.request.get('/v1/product-state')
      await expect(otherState.json()).resolves.toEqual({
        preferences: { notificationsEnabled: true, theme: 'system', locale: 'en' },
        roomPreferences: [],
        favoriteSpaceIds: [],
      })
      const forbiddenRoomPreference = await otherUserPage.request.put(
        `/v1/rooms/${encodeURIComponent(room.matrixRoomId)}/preferences`,
        { data: { pinned: true, muted: true } },
      )
      expect(forbiddenRoomPreference.status()).toBe(404)
      const invalidFavorite = await otherUserPage.request.put('/v1/spaces/not-published/favorite', {
        data: { favorite: true },
      })
      expect(invalidFavorite.status()).toBe(404)

      const bootstrap = await firstPage.request.get('/v1/session/bootstrap').then((response) => response.json())
      const localStorageDump = await firstPage.evaluate(() => JSON.stringify(window.localStorage))
      expect(localStorageDump).not.toContain(email)
      expect(localStorageDump).not.toContain('space-campfire')
      expect(localStorageDump).not.toContain(bootstrap.matrix.accessToken)
    } finally {
      await firstContext.close()
      await secondSessionContext.close()
      await otherUserContext.close()
    }
  })
})
