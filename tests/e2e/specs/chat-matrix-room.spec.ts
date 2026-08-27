import { expect, test, type Page } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

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
      spaceVersionId: 'tplv-space-campfire-0-1-2',
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
      templateVersionId: 'tplv-space-campfire-0-1-2',
      version: '0.1.2',
      integrity: expect.stringMatching(/^template:space-campfire@0\.1\.2\+sha256\./),
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

    const runtimeUrl = `/v1/spaces/instances/${encodeURIComponent(created.matrixRoomId)}`
    const beforeRestoreResponse = await page.request.get(runtimeUrl)
    expect(beforeRestoreResponse.ok(), await beforeRestoreResponse.text()).toBeTruthy()
    const beforeRestore = await beforeRestoreResponse.json()
    expect(beforeRestore.project).toMatchObject({
      draftId: expect.stringMatching(/^[a-f0-9]{16}$/),
      template: { id: 'space-campfire' },
    })

    const publishedReleaseId = beforeRestore.project.releaseId

    await page.getByRole('button', { name: 'Space 菜单' }).click()
    await page.getByTestId('restore-default-chat').click()
    const recoveryDialog = page.getByTestId('restore-default-chat-dialog')
    await expect(recoveryDialog).toBeVisible()
    await expect(recoveryDialog).toContainText(beforeRestore.project.draftId.slice(0, 7))
    await page.getByTestId('confirm-restore-default-chat').click()

    await expect.poll(async () => {
      const response = await page.request.get(runtimeUrl)
      if (!response.ok()) return null
      const snapshot = await response.json()
      return {
        draftChanged: snapshot.project.draftId !== beforeRestore.project.draftId,
        releaseId: snapshot.project.releaseId,
        templateId: snapshot.project.template?.id,
        previewState: snapshot.devPreview.state,
      }
    }, { timeout: 20_000 }).toEqual({
      draftChanged: true,
      releaseId: publishedReleaseId,
      templateId: 'space-default',
      previewState: 'ready',
    })

    await expect(page.getByTestId('space-kernel-bar').locator('code')).not.toContainText(
      beforeRestore.project.draftId.slice(0, 7),
    )
    const restoredChat = await openAppChat(page)
    await expect(restoredChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    const restoredReplyEntry = restoredChat.getByTestId('chat-message-entry').filter({
      has: restoredChat.getByTestId('message-body').filter({ hasText: replyText }),
    })
    await expect(restoredReplyEntry.getByText(messageText, { exact: true })).toBeVisible()
    const restoredMessageEntry = restoredChat.getByTestId('chat-message-entry').filter({
      has: restoredChat.getByTestId('message-body').filter({ hasText: messageText }),
    })
    await expect(restoredMessageEntry).toHaveCount(1)
    await expect(restoredMessageEntry.getByRole('button', { name: /🌙/ })).toHaveCount(1)
    await expect(restoredChat.getByText('已恢复 Default Chat App。')).toHaveCount(0)

    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage))
    expect(localStorageDump).not.toContain(bootstrap.matrix.accessToken)
  })

  test('keeps Default Chat actions stable across refresh and responsive layouts', async ({ page }) => {
    const email = `e2e-default-actions-${Date.now()}@example.com`
    const signUp = await signUpViaAPI(page, {
      name: 'Default Actions E2E',
      email,
      password: 'VibeChat-e2e-password-2026!',
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page)
    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    await expect(bootstrapResponse.json()).resolves.toMatchObject({
      matrix: { status: 'ready' },
    })

    const createdResponse = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-default',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `default-actions-${crypto.randomUUID()}`,
        name: 'Default Actions E2E',
      },
    })
    expect(createdResponse.status(), await createdResponse.text()).toBe(201)
    const created = await createdResponse.json()

    await page.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`)
    await expect(page.getByTestId('chat-app-shell'))
      .toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
    const chat = await openAppChat(page)
    const messageText = `Default action menu ${Date.now()}`
    await chat.getByTestId('message-input').fill(messageText)
    await chat.getByTestId('send-message').click()
    const messageEntry = chat.getByTestId('chat-message-entry').filter({
      has: chat.getByTestId('message-body').filter({ hasText: messageText }),
    })
    await expect(messageEntry).toHaveCount(1)
    await expect(messageEntry.getByTestId('message-body')).toContainText(messageText)

    const moreActions = messageEntry.getByTestId('message-actions-more')
    const actionsMenu = messageEntry.getByTestId('message-actions-menu')
    await moreActions.click()
    await expect(actionsMenu).toBeVisible()
    await expect.poll(() => actionsMenu.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        top: rect.top >= 0,
        right: rect.right <= window.innerWidth,
        bottom: rect.bottom <= window.innerHeight,
        left: rect.left >= 0,
      }
    })).toEqual({ top: true, right: true, bottom: true, left: true })
    await page.waitForTimeout(4_500)
    await expect(actionsMenu).toBeVisible()

    await actionsMenu.getByRole('button', { name: '删除', exact: true }).click()
    await expect(actionsMenu.getByRole('button', { name: '确认删除', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(actionsMenu).toBeHidden()
    await expect(moreActions).toBeFocused()

    await page.setViewportSize({ width: 390, height: 844 })
    await moreActions.click()
    await expect(actionsMenu).toBeVisible()
    await expect(actionsMenu.getByRole('button', { name: '删除', exact: true })).toBeVisible()
    await expect(actionsMenu.getByRole('button', { name: '确认删除', exact: true })).toHaveCount(0)
    await expect(messageEntry.locator('[part="backdrop"]')).toBeVisible()
    await expect.poll(() => actionsMenu.evaluate((element) => ({
      position: getComputedStyle(element).position,
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right),
      viewport: window.innerWidth,
    }))).toEqual({ position: 'fixed', left: 12, right: 378, viewport: 390 })
    await messageEntry.locator('[part="backdrop"]').click({ position: { x: 2, y: 2 } })
    await expect(actionsMenu).toBeHidden()
    await expect(moreActions).toBeFocused()
  })
})
