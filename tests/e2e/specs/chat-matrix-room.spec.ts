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
    await frame.getByRole('button', { name: /Open Space Chat|打开 Space 聊天/ }).click({ force: true })
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
      spaceVersionId: 'tplv-space-campfire-0-1-5',
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
      templateVersionId: 'tplv-space-campfire-0-1-5',
      version: '0.1.5',
      integrity: expect.stringMatching(/^template:space-campfire@0\.1\.5\+sha256\./),
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
    await expect(chat.getByRole('heading', { name: '夜航电台' })).toBeVisible()
    await expect(chat.locator('script[data-vibechat-components="0.7.4"]')).toHaveCount(1)
    await expect.poll(() => chat.locator('#vcc-shell').evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        transformed: styles.transform !== 'none',
        backdropFilter: styles.backdropFilter,
      }
    })).toEqual({ transformed: true, backdropFilter: 'blur(26px)' })

    const messageText = `真实 Matrix 消息 ${Date.now()}`
    await chat.getByTestId('message-input').fill(messageText)
    await chat.getByTestId('send-message').click()
    await expect.poll(
      () => delayedSend,
      { message: `Matrix send requests: ${matrixSendRequests.join(', ')}` },
    ).toBe(true)
    const sendButton = chat.getByTestId('send-message')
    await expect(sendButton).toBeDisabled()
    const ownMessage = chat.getByTestId('chat-message-entry').filter({
      has: chat.getByTestId('message-body').filter({ hasText: messageText }),
    })
    // The shared controller exposes command pending through the Composer and
    // only projects messages received from the Host-owned Matrix timeline.
    await expect(ownMessage).toContainText('已发送')
    await expect(sendButton).toHaveText('发送')
    expect(delayedSend).toBe(true)

    const ownActionsMenu = ownMessage.getByTestId('message-actions-menu')
    await ownMessage.getByTestId('message-actions-more').click()
    await expect(ownActionsMenu).toBeVisible()
    await expect.poll(() => ownActionsMenu.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        open: element.matches(':popover-open'),
        insideViewport: rect.top >= 0
          && rect.right <= window.innerWidth
          && rect.bottom <= window.innerHeight
          && rect.left >= 0,
      }
    })).toEqual({ open: true, insideViewport: true })
    await ownActionsMenu
      .getByRole('button', { name: '回复', exact: true })
      .click()
    await expect(chat.getByTestId('chat-context')).toContainText(messageText)
    const replyText = `标准 Matrix 回复 ${Date.now()}`
    await chat.getByTestId('message-input').fill(replyText)
    await chat.getByTestId('send-message').click()
    const replyMessage = chat.getByTestId('chat-message-entry').filter({
      has: chat.getByTestId('message-body').filter({ hasText: replyText }),
    })
    await expect(replyMessage).toContainText(messageText)
    await expect(replyMessage).toContainText('已发送')

    // Resolve fresh locators after the message round-trip so this assertion is
    // independent from App-owned drawer rendering updates.
    const readyChat = await openAppChat(page)
    const readyOwnMessage = readyChat.getByTestId('chat-message-entry').filter({
      has: readyChat.getByTestId('message-body').filter({ hasText: messageText }),
    })
    const readyMoreActions = readyOwnMessage.getByTestId('message-actions-more')
    const readyActionsMenu = readyOwnMessage.getByTestId('message-actions-menu')
    await readyMoreActions.click()
    await expect.poll(() => readyActionsMenu.evaluate(
      (element) => element.matches(':popover-open'),
    )).toBe(true)
    await readyActionsMenu.getByRole('button', { name: /🌙/ }).click()
    await expect(readyOwnMessage.getByRole('button', { name: /🌙/ })).toBeVisible()
    await readyOwnMessage.getByRole('button', { name: /🌙/ }).click()
    await expect(readyOwnMessage.getByRole('button', { name: /🌙/ })).toHaveCount(0)
    await readyMoreActions.click()
    await readyActionsMenu.getByRole('button', { name: /🌙/ }).click()
    await expect(readyOwnMessage.getByRole('button', { name: /🌙/ })).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    const reloadedChat = await openAppChat(page)
    await expect(reloadedChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('chat-message-entry').filter({
        has: reloadedChat.getByTestId('message-body').filter({ hasText: replyText }),
      }),
    ).toContainText(messageText)
    await expect(
      reloadedChat.getByTestId('message-body').filter({ hasText: 'Transaction retry should appear once' }),
    ).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('chat-message-entry').filter({
        has: reloadedChat.getByTestId('message-body').filter({ hasText: messageText }),
      }).getByRole('button', { name: /🌙/ }),
    ).toBeVisible()

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
    await expect.poll(() => actionsMenu.evaluate((element) => element.matches(':popover-open')))
      .toBe(true)
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
    await expect.poll(() => actionsMenu.evaluate((element) => ({
      open: element.matches(':popover-open'),
      backdrop: getComputedStyle(element, '::backdrop').backgroundColor,
    }))).toEqual({ open: true, backdrop: 'rgba(0, 0, 0, 0.42)' })
    await expect(actionsMenu.getByRole('button', { name: '删除', exact: true })).toBeVisible()
    await expect(actionsMenu.getByRole('button', { name: '确认删除', exact: true })).toHaveCount(0)
    await expect(messageEntry.locator('[part="backdrop"]')).toBeHidden()
    await expect.poll(() => actionsMenu.evaluate((element) => ({
      position: getComputedStyle(element).position,
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right),
      viewport: window.innerWidth,
    }))).toEqual({ position: 'fixed', left: 12, right: 378, viewport: 390 })
    const frameBox = await page.getByTestId('space-app-surface').locator('iframe').boundingBox()
    expect(frameBox).not.toBeNull()
    await page.mouse.click(frameBox!.x + 2, frameBox!.y + 2)
    await expect(actionsMenu).toBeHidden()
    await expect(moreActions).toBeFocused()
  })

  test('keeps Focus notes and docked Chat stable across refresh and responsive layouts', async ({ page }) => {
    const email = `e2e-focus-dock-${Date.now()}@example.com`
    const signUp = await signUpViaAPI(page, {
      name: 'Focus Dock E2E',
      email,
      password: 'VibeChat-e2e-password-2026!',
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page)

    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap.matrix.status).toBe('ready')

    const createdResponse = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-focus',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `focus-dock-${crypto.randomUUID()}`,
        name: 'Focus Dock E2E',
      },
    })
    expect(createdResponse.status(), await createdResponse.text()).toBe(201)
    const created = await createdResponse.json()
    expect(created).toMatchObject({
      spaceId: 'space-focus',
      spaceVersionId: 'tplv-space-focus-0-1-6',
      status: 'active',
    })

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`)
    await expect(page.getByTestId('chat-app-shell'))
      .toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
    const frame = chatFrame(page)
    const root = frame.locator('#vcc-root')
    await expect(frame.getByRole('heading', { name: '苔原共创室' }))
      .toBeVisible({ timeout: 20_000 })
    await expect(frame.locator('#note')).toBeVisible()
    await expect(root).toHaveAttribute('data-mode', 'dock')
    await expect(root).toHaveAttribute('data-open', 'false')

    const noteText = `迁移验收便签 ${Date.now()}`
    await frame.locator('#note').fill(noteText)
    await frame.getByRole('button', { name: '贴上桌面' }).click()
    await expect(frame.locator('#board')).toContainText(noteText)

    const chat = await openAppChat(page)
    const messageText = `Focus 组件消息 ${Date.now()}`
    await chat.getByTestId('message-input').fill(messageText)
    await chat.getByTestId('send-message').click()
    const messageEntry = chat.getByTestId('chat-message-entry').filter({
      has: chat.getByTestId('message-body').filter({ hasText: messageText }),
    })
    await expect(messageEntry).toHaveCount(1)
    await expect(messageEntry.getByTestId('message-body')).toContainText(messageText)
    const focusActionsMenu = messageEntry.getByTestId('message-actions-menu')
    await messageEntry.getByTestId('message-actions-more').click()
    await expect(focusActionsMenu).toBeVisible()
    await expect.poll(() => focusActionsMenu.evaluate(
      (element) => element.matches(':popover-open'),
    )).toBe(true)
    await focusActionsMenu
      .getByRole('button', { name: '回复', exact: true })
      .click()
    const replyText = `Focus 组件回复 ${Date.now()}`
    await chat.getByTestId('message-input').fill(replyText)
    await chat.getByTestId('send-message').click()
    const replyEntry = chat.getByTestId('chat-message-entry').filter({
      has: chat.getByTestId('message-body').filter({ hasText: replyText }),
    })
    await expect(replyEntry).toContainText(messageText)
    await messageEntry.getByTestId('message-actions-more').click()
    await messageEntry.getByRole('button', { name: /✨/ }).click()
    await expect(messageEntry.getByRole('button', { name: /✨/ })).toBeVisible()

    await chat.getByRole('button', { name: /Close Chat|关闭聊天/ }).click()
    await expect(root).toHaveAttribute('data-open', 'false')
    const unreadText = `Focus 抽屉未读 ${Date.now()}`
    const directSend = await page.request.put(
      `http://localhost:8008/_matrix/client/v3/rooms/${encodeURIComponent(created.matrixRoomId)}`
        + `/send/m.room.message/${encodeURIComponent(`focus-unread-${crypto.randomUUID()}`)}`,
      {
        data: { msgtype: 'm.text', body: unreadText },
        headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
      },
    )
    expect(directSend.ok(), await directSend.text()).toBeTruthy()
    await expect(frame.locator('#vcc-unread')).toHaveText('1')
    await frame.getByRole('button', { name: /Open Space Chat|打开 Space 聊天/ }).click()
    await expect(root).toHaveAttribute('data-open', 'true')
    await expect(frame.locator('#vcc-unread')).toHaveText('0')
    await expect(chat.getByTestId('message-body').filter({ hasText: unreadText })).toHaveCount(1)

    await page.reload()
    await expect(page.getByTestId('chat-app-shell'))
      .toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
    const reloadedFrame = chatFrame(page)
    await expect(reloadedFrame.locator('#board')).toContainText(noteText)
    const reloadedChat = await openAppChat(page)
    await expect(reloadedChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('chat-message-entry').filter({
        has: reloadedChat.getByTestId('message-body').filter({ hasText: replyText }),
      }),
    ).toContainText(messageText)
    await expect(
      reloadedChat.getByTestId('chat-message-entry').filter({
        has: reloadedChat.getByTestId('message-body').filter({ hasText: messageText }),
      }).getByRole('button', { name: /✨/ }),
    ).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => reloadedFrame.locator('#vcc-shell').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        fillsTop: Math.round(rect.top) === 0,
        fillsRight: Math.round(rect.right) === window.innerWidth,
        fillsBottom: Math.round(rect.bottom) === window.innerHeight,
        fillsLeft: Math.round(rect.left) === 0,
        viewportWidth: window.innerWidth,
      }
    })).toEqual({
      fillsTop: true,
      fillsRight: true,
      fillsBottom: true,
      fillsLeft: true,
      viewportWidth: 390,
    })
    await expect(reloadedChat.getByTestId('message-input')).toBeInViewport()
    await expect(reloadedFrame.getByRole('button', { name: /Close Chat|关闭聊天/ })).toBeInViewport()
  })
})
