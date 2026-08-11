import { expect, test } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

test.describe('Vibe Chat real Matrix room and timeline', () => {
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('rejects unauthenticated room creation with the product error contract', async ({ request }) => {
    const response = await request.post('/v1/rooms', {
      data: {
        spaceId: 'space-campfire',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `unauth-${crypto.randomUUID()}`,
        name: 'Unauthorized room',
      },
    })

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'AUTH_SESSION_REQUIRED',
        details: {},
        requestId: expect.any(String),
      },
    })
  })

  test('creates an indexed atmosphere room and sends a durable Matrix message', async ({ page }) => {
    const email = `e2e-matrix-room-${Date.now()}@example.com`
    const signUp = await signUpViaAPI(page, {
      name: 'Matrix Room E2E',
      email,
      password: 'VibeChat-e2e-password-2026!',
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page)

    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap.matrix.status).toBe('ready')

    const unknownSpace = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-does-not-exist',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `unknown-space-${crypto.randomUUID()}`,
        name: 'Unknown space',
      },
    })
    expect(unknownSpace.status()).toBe(404)
    await expect(unknownSpace.json()).resolves.toMatchObject({
      error: { code: 'ROOM_SPACE_NOT_FOUND' },
    })

    const missingParticipant = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-campfire',
        participantUserIds: ['missing-product-user'],
        instanceConfig: {},
        clientRequestId: `missing-participant-${crypto.randomUUID()}`,
        name: 'Missing participant',
      },
    })
    expect(missingParticipant.status()).toBe(409)
    await expect(missingParticipant.json()).resolves.toMatchObject({
      error: { code: 'SOCIAL_NOT_CONTACT' },
    })

    const clientRequestId = `e2e-room-${crypto.randomUUID()}`
    const createBody = {
      spaceId: 'space-campfire',
      participantUserIds: [],
      instanceConfig: { ambient: 'night' },
      clientRequestId,
      name: 'Matrix Room E2E',
    }
    const createdResponse = await page.request.post('/v1/rooms', { data: createBody })
    expect(createdResponse.status(), await createdResponse.text()).toBe(201)
    const created = await createdResponse.json()
    expect(created).toMatchObject({
      matrixRoomId: expect.stringMatching(/^!.*:localhost$/),
      spaceId: 'space-campfire',
      spaceVersionId: 'builtin-space-campfire-v1',
      status: 'active',
    })

    const repeatedResponse = await page.request.post('/v1/rooms', { data: createBody })
    expect(repeatedResponse.status(), await repeatedResponse.text()).toBe(201)
    await expect(repeatedResponse.json()).resolves.toEqual(created)

    const stateResponse = await page.request.get(
      `http://localhost:8008/_matrix/client/v3/rooms/${encodeURIComponent(created.matrixRoomId)}`
        + '/state/io.vibechat.space.instance.v1/',
      { headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` } },
    )
    expect(stateResponse.ok(), await stateResponse.text()).toBeTruthy()
    await expect(stateResponse.json()).resolves.toMatchObject({
      spaceId: 'space-campfire',
      version: '1.0.0',
      integrity: 'builtin:space-campfire@1.0.0',
      instanceConfig: { ambient: 'night' },
      createdBy: bootstrap.matrix.userId,
      permissions: expect.arrayContaining(['messages.read', 'messages.send']),
    })

    const idempotentTxnId = `e2e-txn-${crypto.randomUUID()}`
    const idempotentSendUrl =
      `http://localhost:8008/_matrix/client/v3/rooms/${encodeURIComponent(created.matrixRoomId)}`
      + `/send/m.room.message/${encodeURIComponent(idempotentTxnId)}`
    const idempotentSendBody = {
      msgtype: 'm.text',
      body: 'Transaction retry should appear once',
    }
    const firstIdempotentSend = await page.request.put(idempotentSendUrl, {
      data: idempotentSendBody,
      headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
    })
    const repeatedIdempotentSend = await page.request.put(idempotentSendUrl, {
      data: idempotentSendBody,
      headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
    })
    expect(firstIdempotentSend.ok(), await firstIdempotentSend.text()).toBeTruthy()
    expect(repeatedIdempotentSend.ok(), await repeatedIdempotentSend.text()).toBeTruthy()
    expect(await repeatedIdempotentSend.json()).toEqual(await firstIdempotentSend.json())

    let delayedSend = false
    const matrixSendRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/_matrix/') && request.url().includes('/send/')) {
        matrixSendRequests.push(request.url())
      }
    })
    await page.route(/\/_matrix\/client\/.*\/rooms\/.*\/send\//, async (route) => {
      delayedSend = true
      await new Promise((resolve) => setTimeout(resolve, 1_500))
      await route.continue()
    })
    await page.goto(`/zh-CN/rooms/${encodeURIComponent(created.matrixRoomId)}`)
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    await expect(page.getByTestId('atmosphere-canvas')).toBeVisible()

    const messageText = `真实 Matrix 消息 ${Date.now()}`
    await page.getByTestId('message-input').fill(messageText)
    await page.getByTestId('send-message').click()
    await expect.poll(
      () => delayedSend,
      { message: `Matrix send requests: ${matrixSendRequests.join(', ')}` },
    ).toBe(true)
    const ownMessage = page.getByTestId('message-body')
      .filter({ hasText: messageText })
      .locator('xpath=ancestor::article')
    await expect(ownMessage).toContainText('发送中…')
    await expect(ownMessage).toContainText('已发送')
    expect(delayedSend).toBe(true)

    await ownMessage.getByRole('button', { name: '回复' }).click()
    await expect(page.getByTestId('reply-preview')).toContainText(messageText)
    const replyText = `标准 Matrix 回复 ${Date.now()}`
    await page.getByTestId('message-input').fill(replyText)
    await page.getByTestId('send-message').click()
    const replyMessage = page.getByTestId('message-body')
      .filter({ hasText: replyText })
      .locator('xpath=ancestor::article')
    await expect(replyMessage).toContainText(messageText)
    await expect(replyMessage).toContainText('已发送')

    await ownMessage.getByRole('button', { name: '回应 🌙' }).click()
    await expect(ownMessage.locator('.vc-reactions')).toContainText('🌙')

    await page.reload()
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    await expect(page.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    await expect(
      page.getByTestId('message-body').filter({ hasText: replyText }).locator('xpath=ancestor::article'),
    ).toContainText(messageText)
    await expect(
      page.getByTestId('message-body').filter({ hasText: 'Transaction retry should appear once' }),
    ).toHaveCount(1)
    await expect(
      page.getByTestId('message-body')
        .filter({ hasText: messageText })
        .locator('xpath=ancestor::article')
        .locator('.vc-reactions'),
    ).toContainText('🌙')

    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage))
    expect(localStorageDump).not.toContain(bootstrap.matrix.accessToken)
  })
})
