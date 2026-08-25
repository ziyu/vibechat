import { expect, test, type Page } from '@playwright/test'
import { completeChatOnboarding, signInViaAPI, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'

function chatFrame(page: Page) {
  return page.frameLocator('[data-testid="space-app-surface"] iframe')
}

async function openAppChat(page: Page) {
  const frame = chatFrame(page)
  const input = frame.getByTestId('message-input')
  const root = frame.locator('#vcc-root')
  await input.waitFor({ state: 'attached' })
  if (await root.getAttribute('data-open') !== 'true') {
    await frame.getByRole('button', { name: 'Open Space Chat' }).click({ force: true })
  }
  await expect(root).toHaveAttribute('data-open', 'true')
  await expect(input).toBeInViewport()
  return frame
}

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

  for (const path of ['spaces', 'contacts', 'discover', 'me', 'spaces/not-a-space']) {
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
    await page.goto('/spaces')

    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'false')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-sync-state', 'UNAVAILABLE')
    await expect(page.getByTestId('chat-service-state')).toContainText('Space 服务尚未连接')
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

      await firstPage.goto('/spaces')
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await expect(firstPage.getByTestId('space-row')).toHaveCount(0)
      await expect(firstPage.getByText(/River|林林/)).toHaveCount(0)

      const directoryResponse = await firstPage.request.get('/v1/spaces?locale=zh-CN')
      expect(directoryResponse.ok(), await directoryResponse.text()).toBeTruthy()
      const directory = await directoryResponse.json()
      expect(directory.spaces).toHaveLength(5)
      expect(directory.spaces.find((space: { id: string }) => space.id === 'space-campfire')).toMatchObject({
        id: 'space-campfire',
        versionId: 'tplv-space-campfire-0-1-2',
        semanticVersion: '0.1.2',
        artifact: {
          schemaVersion: 'vibechat.space-template-artifact/v1',
          id: expect.stringMatching(/^tpla-[a-f0-9]{64}$/),
          format: 'agentos-app-v1',
          sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
        projectFormat: 'agentos-app-v1',
        publisher: {
          id: 'publisher-vibechat',
          verification: 'official',
        },
        provenance: {
          origin: 'repository',
          publisherId: 'publisher-vibechat',
        },
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
      await secondSessionPage.goto('/spaces')
      await expect(secondSessionPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await expect(secondSessionPage.getByTestId('space-row')).toContainText('持久化状态房间')
      await expect(secondSessionPage.getByTestId('space-row').locator('[aria-label="已静音"]')).toBeVisible()
      await expect(secondSessionPage.getByTestId('spaces-overview')).toBeVisible()
      await expect(secondSessionPage.getByTestId('space-card')).toHaveCount(1)
      await expect(secondSessionPage.getByTestId('chat-primary-nav').getByRole('link', { name: '空间' })).toBeVisible()
      await expect(secondSessionPage.getByTestId('chat-primary-nav').getByRole('link', { name: '消息' })).toHaveCount(0)

      await secondSessionPage.goto('/messages')
      await expect(secondSessionPage).toHaveURL(/\/spaces$/)
      await secondSessionPage.goto(`/rooms/${encodeURIComponent(room.matrixRoomId)}`)
      await expect(secondSessionPage).toHaveURL(new RegExp(`/spaces/${encodeURIComponent(room.matrixRoomId)}`))
      await expect(secondSessionPage.getByTestId('space-canvas')).toBeVisible()
      let appChat = await openAppChat(secondSessionPage)
      await expect(appChat.getByTestId('message-input')).toBeVisible()

      await secondSessionPage.reload()
      await expect(secondSessionPage.getByTestId('space-app-surface')).toBeVisible()
      appChat = await openAppChat(secondSessionPage)
      await expect(appChat.getByTestId('message-input')).toBeVisible()

      await secondSessionPage.setViewportSize({ width: 390, height: 844 })
      await secondSessionPage.goto('/spaces')
      await expect(secondSessionPage.getByTestId('space-list')).toBeVisible()
      await expect(secondSessionPage.getByTestId('space-row')).toHaveCount(1)
      await expect(secondSessionPage.getByTestId('space-search')).toBeVisible()
      await expect(secondSessionPage.getByTestId('unread-filter')).toBeVisible()
      await expect(secondSessionPage.getByTestId('new-space-button')).toBeVisible()
      await expect(secondSessionPage.locator('.vc-mobile-nav').getByText('空间')).toBeVisible()

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
