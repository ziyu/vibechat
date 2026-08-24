import { expect, test, type Page } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

function chatFrame(page: Page) {
  return page.frameLocator('[data-testid="space-app-surface"] iframe')
}

async function openAppChat(page: Page) {
  const frame = chatFrame(page)
  await frame.getByTestId('message-input').waitFor({ state: 'attached' })
  const launcher = frame.getByRole('button', { name: 'Open Space Chat' })
  if (await launcher.isVisible()) await launcher.click()
  await expect(frame.getByTestId('message-input')).toBeVisible()
  return frame
}

test.describe('Vibe Chat real Matrix room and timeline', () => {
  test.setTimeout(90_000)

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
      spaceVersionId: 'tplv-space-campfire-0-1-0',
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
      templateId: 'space-campfire',
      templateVersionId: 'tplv-space-campfire-0-1-0',
      version: '0.1.0',
      integrity: expect.stringMatching(/^template:space-campfire@0\.1\.0\+sha256\./),
      publisher: {
        id: 'publisher-vibechat',
        verification: 'official',
      },
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
    const readyAppResponse = page.waitForResponse((response) =>
      response.request().resourceType() === 'document'
      && response.url().includes('/v1/spaces/instances/')
      && response.url().includes('/app?channel=dev'),
    )
    await page.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`)
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    await expect(page.getByTestId('space-canvas')).toBeVisible()
    const appResponse = await readyAppResponse
    expect(appResponse.headers()['x-vibechat-space-recovery']).toBeUndefined()
    const chat = await openAppChat(page)

    const messageText = `真实 Matrix 消息 ${Date.now()}`
    await chat.getByTestId('message-input').fill(messageText)
    await chat.getByTestId('send-message').click()
    await expect.poll(
      () => delayedSend,
      { message: `Matrix send requests: ${matrixSendRequests.join(', ')}` },
    ).toBe(true)
    const ownMessage = chat.getByTestId('message-body')
      .filter({ hasText: messageText })
      .locator('xpath=ancestor::article')
    await expect(ownMessage).toContainText('发送中…')
    await expect(ownMessage).toContainText('已发送')
    expect(delayedSend).toBe(true)

    await ownMessage.getByRole('button', { name: '回复' }).click()
    await expect(chat.getByTestId('chat-context')).toContainText(messageText)
    const replyText = `标准 Matrix 回复 ${Date.now()}`
    await chat.getByTestId('message-input').fill(replyText)
    await chat.getByTestId('send-message').click()
    const replyMessage = chat.getByTestId('message-body')
      .filter({ hasText: replyText })
      .locator('xpath=ancestor::article')
    await expect(replyMessage).toContainText(messageText)
    await expect(replyMessage).toContainText('已发送')

    // Resolve fresh locators after the message round-trip so this assertion is
    // independent from App-owned drawer rendering updates.
    const readyChat = await openAppChat(page)
    const readyOwnMessage = readyChat.getByTestId('message-body')
      .filter({ hasText: messageText })
      .locator('xpath=ancestor::article')
    await readyOwnMessage.getByRole('button', { name: '🌙', exact: true }).click()
    await expect(readyOwnMessage.locator('.vcc-reactions')).toContainText('🌙')
    await readyOwnMessage.locator('.vcc-reactions').getByRole('button', { name: '🌙 1' }).click()
    await expect(readyOwnMessage.locator('.vcc-reactions')).toHaveCount(0)
    await readyOwnMessage.getByRole('button', { name: '🌙', exact: true }).click()
    await expect(readyOwnMessage.locator('.vcc-reactions')).toContainText('🌙')

    await page.reload()
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    const reloadedChat = await openAppChat(page)
    await expect(reloadedChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('message-body').filter({ hasText: replyText }).locator('xpath=ancestor::article'),
    ).toContainText(messageText)
    await expect(
      reloadedChat.getByTestId('message-body').filter({ hasText: 'Transaction retry should appear once' }),
    ).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('message-body')
        .filter({ hasText: messageText })
        .locator('xpath=ancestor::article')
        .locator('.vcc-reactions'),
    ).toContainText('🌙')

    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage))
    expect(localStorageDump).not.toContain(bootstrap.matrix.accessToken)
  })
})
