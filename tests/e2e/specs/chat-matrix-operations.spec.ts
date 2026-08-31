import {
  expect,
  test,
  type BrowserContext,
  type FrameLocator,
  type Page,
} from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'
import { closeBrowserContexts } from '../helpers/browser'

const password = 'VibeChat-e2e-password-2026!'
const matrixBaseUrl = process.env.MATRIX_PUBLIC_HOMESERVER_URL || 'http://localhost:8008'

interface ChatContractCase {
  spaceId: 'space-default' | 'space-campfire'
  label: string
}

function chatFrame(page: Page) {
  return page.frameLocator('[data-testid="space-app-surface"] iframe')
}

async function openAppChat(page: Page) {
  const frame = chatFrame(page)
  const input = frame.getByTestId('message-input')
  const root = frame.locator('#vcc-root')
  await input.waitFor({ state: 'attached', timeout: 90_000 })
  if (await root.getAttribute('data-open') !== 'true') {
    await frame.getByRole('button', { name: 'Open Space Chat' }).click({ force: true })
  }
  await expect(root).toHaveAttribute('data-open', 'true')
  await expect(input).toBeInViewport()
  return frame
}

async function createMatrixUser(context: BrowserContext, name: string, email: string) {
  const page = await context.newPage()
  const signUp = await signUpViaAPI(page, { name, email, password })
  expect(signUp.ok(), await signUp.text()).toBeTruthy()
  await completeChatOnboarding(page)
  const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
  expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
  const bootstrap = await bootstrapResponse.json()
  expect(bootstrap.matrix.status).toBe('ready')
  return { page, bootstrap }
}

type MatrixUser = Awaited<ReturnType<typeof createMatrixUser>>

async function createSpace(
  first: MatrixUser,
  second: MatrixUser,
  contract: ChatContractCase,
) {
  const roomResponse = await first.page.request.post('/v1/rooms', {
    data: {
      spaceId: contract.spaceId,
      participantUserIds: [second.bootstrap.user.id],
      instanceConfig: {},
      clientRequestId: `matrix-ops-${contract.spaceId}-${crypto.randomUUID()}`,
      name: `${contract.label} Matrix Operations E2E`,
    },
  })
  expect(roomResponse.status(), await roomResponse.text()).toBe(201)
  const room = await roomResponse.json() as { matrixRoomId: string }
  const joinResponse = await second.page.request.post(
    `${matrixBaseUrl}/_matrix/client/v3/join/${encodeURIComponent(room.matrixRoomId)}`,
    {
      data: {},
      headers: { authorization: `Bearer ${second.bootstrap.matrix.accessToken}` },
    },
  )
  expect(joinResponse.ok(), await joinResponse.text()).toBeTruthy()
  return room
}

function messageArticle(frame: FrameLocator, text: string) {
  return frame.getByTestId('message-body')
    .filter({ hasText: text })
    .locator('xpath=ancestor::article')
}

async function assertUniqueMessage(frame: FrameLocator, text: string) {
  await expect(frame.getByTestId('message-body').filter({ hasText: text })).toHaveCount(1)
}

async function invokeMarkRead(page: Page, frame: FrameLocator) {
  const receiptResponse = page.waitForResponse((response) =>
    response.url().includes('/receipt/m.read/')
    && response.request().method() === 'POST',
  )
  await frame.locator('body').evaluate(async () => {
    await (window as unknown as {
      spaceApp: { chat: { markRead(): Promise<unknown> } }
    }).spaceApp.chat.markRead()
  })
  expect((await receiptResponse).ok()).toBeTruthy()
}

async function exerciseChatCoreContract(input: {
  contract: ChatContractCase
  first: MatrixUser
  firstContext: BrowserContext
  roomId: string
  second: MatrixUser
  secondContext: BrowserContext
  suffix: string
}) {
  const {
    contract,
    first,
    firstContext,
    roomId,
    second,
    secondContext,
    suffix,
  } = input
  const prefix = `${contract.spaceId}-${suffix}`

  await Promise.all([
    first.page.goto(`/spaces/${encodeURIComponent(roomId)}`),
    second.page.goto(`/spaces/${encodeURIComponent(roomId)}`),
  ])
  for (const page of [first.page, second.page]) {
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
  }
  const [firstChat, secondChat] = await Promise.all([
    openAppChat(first.page),
    openAppChat(second.page),
  ])

  await firstChat.getByTestId('message-input').fill(`typing-${prefix}`)
  await expect(secondChat.getByTestId('typing-indicator')).toBeVisible()
  await firstChat.getByTestId('message-input').fill('')
  await expect(secondChat.getByTestId('typing-indicator')).toBeHidden()

  const relationText = `Relation target ${prefix}`
  await firstChat.getByTestId('message-input').fill(relationText)
  await firstChat.getByTestId('send-message').click()
  const firstRelation = messageArticle(firstChat, relationText)
  const secondRelation = messageArticle(secondChat, relationText)
  await expect(firstRelation).toContainText('已发送')
  await expect(secondRelation).toBeVisible()

  await secondRelation.locator('button[data-action="reply"]').click()
  await expect(secondChat.getByTestId('chat-context')).toContainText(relationText)
  const replyText = `Reply relation ${prefix}`
  await secondChat.getByTestId('message-input').fill(replyText)
  await secondChat.getByTestId('send-message').click()
  await expect(messageArticle(firstChat, replyText)).toContainText(relationText)
  await expect(messageArticle(secondChat, replyText)).toContainText('已发送')

  await secondRelation.locator('button[data-action="reaction"][data-emoji="🌙"]').click()
  await expect(secondRelation.locator('.vcc-reactions')).toContainText('🌙', { timeout: 20_000 })
  await expect(firstRelation.locator('.vcc-reactions')).toContainText('🌙', { timeout: 20_000 })
  await secondRelation.locator('.vcc-reactions button[data-emoji="🌙"]').click()
  await expect(secondRelation.locator('.vcc-reactions')).toHaveCount(0, { timeout: 20_000 })
  await expect(firstRelation.locator('.vcc-reactions')).toHaveCount(0, { timeout: 20_000 })
  await secondRelation.locator('button[data-action="reaction"][data-emoji="🌙"]').click()
  await expect(secondRelation.locator('.vcc-reactions')).toContainText('🌙', { timeout: 20_000 })
  await expect(firstRelation.locator('.vcc-reactions')).toContainText('🌙', { timeout: 20_000 })

  const originalText = `Original matrix text ${prefix}`
  await firstChat.getByTestId('message-input').fill(originalText)
  await firstChat.getByTestId('send-message').click()
  const firstMessage = messageArticle(firstChat, originalText)
  const secondMessage = messageArticle(secondChat, originalText)
  await expect(firstMessage).toContainText('已发送')
  await expect(secondMessage).toBeVisible()
  await expect(secondMessage.locator('button[data-action="edit"]')).toHaveCount(0)
  await expect(secondMessage.locator('button[data-action="delete"]')).toHaveCount(0)

  await firstMessage.locator('button[data-action="edit"]').click()
  await expect(firstChat.getByTestId('chat-context')).toBeVisible()
  const editedText = `Edited matrix text ${prefix}`
  await firstChat.getByTestId('message-input').fill(editedText)
  await firstChat.getByTestId('send-message').click()
  const editedFirstMessage = messageArticle(firstChat, editedText)
  const editedSecondMessage = messageArticle(secondChat, editedText)
  await expect(editedFirstMessage).toContainText('已编辑')
  await expect(editedSecondMessage).toContainText('已编辑')

  await editedFirstMessage.locator('button[data-action="delete"]').click()
  const deletedFirstMessage = messageArticle(firstChat, '这条消息已删除')
  const deletedSecondMessage = messageArticle(secondChat, '这条消息已删除')
  await expect(deletedFirstMessage).toBeVisible()
  await expect(deletedSecondMessage).toBeVisible()

  const attachmentName = `matrix-attachment-${prefix}.txt`
  const attachmentContent = `attachment-content-${prefix}`
  await firstChat.getByTestId('attachment-input').setInputFiles({
    name: attachmentName,
    mimeType: 'text/plain',
    buffer: Buffer.from(attachmentContent),
  })
  const firstAttachment = firstChat.getByTestId('message-attachment')
    .filter({ hasText: attachmentName })
  const secondAttachment = secondChat.getByTestId('message-attachment')
    .filter({ hasText: attachmentName })
  await expect(firstAttachment).toBeVisible({ timeout: 15_000 })
  await expect(secondAttachment).toBeVisible({ timeout: 15_000 })

  const offlineText = `Queued while offline ${prefix}`
  await secondContext.setOffline(true)
  await secondChat.getByTestId('message-input').fill(offlineText)
  await secondChat.getByTestId('send-message').click()
  const queuedMessage = messageArticle(secondChat, offlineText)
  await expect(queuedMessage).toContainText(/发送中|发送失败/)
  await expect(firstChat.getByTestId('message-body').filter({ hasText: offlineText })).toHaveCount(0)
  await secondContext.setOffline(false)
  const retryButton = queuedMessage.getByTestId('retry-message')
  if (await retryButton.count()) await retryButton.click()
  await expect(firstChat.getByTestId('message-body').filter({ hasText: offlineText }))
    .toHaveCount(1, { timeout: 20_000 })
  await expect(queuedMessage).toContainText('已发送', { timeout: 20_000 })

  const refreshRelationText = `Refresh relation target ${prefix}`
  await firstChat.getByTestId('message-input').fill(refreshRelationText)
  await firstChat.getByTestId('send-message').click()
  const refreshRelation = messageArticle(secondChat, refreshRelationText)
  await expect(refreshRelation).toBeVisible()
  await refreshRelation.locator('button[data-action="reply"]').click()
  const refreshReplyText = `Refresh reply ${prefix}`
  await secondChat.getByTestId('message-input').fill(refreshReplyText)
  await secondChat.getByTestId('send-message').click()
  await expect(messageArticle(firstChat, refreshReplyText)).toContainText(refreshRelationText)
  await refreshRelation.locator('button[data-action="reaction"][data-emoji="🌙"]').click()
  await expect(refreshRelation.locator('.vcc-reactions')).toContainText('🌙', { timeout: 20_000 })
  await expect(messageArticle(firstChat, refreshRelationText).locator('.vcc-reactions'))
    .toContainText('🌙', { timeout: 20_000 })

  const readTargetText = `Explicit read target ${prefix}`
  await secondChat.getByTestId('message-input').fill(readTargetText)
  await secondChat.getByTestId('send-message').click()
  await expect(messageArticle(firstChat, readTargetText)).toBeVisible()
  await invokeMarkRead(first.page, firstChat)

  await Promise.all([first.page.reload(), second.page.reload()])
  const [reloadedFirst, reloadedSecond] = await Promise.all([
    openAppChat(first.page),
    openAppChat(second.page),
  ])
  for (const frame of [reloadedFirst, reloadedSecond]) {
    await assertUniqueMessage(frame, refreshRelationText)
    await expect(messageArticle(frame, refreshReplyText)).toContainText(refreshRelationText)
    await expect(messageArticle(frame, refreshRelationText).locator('.vcc-reactions'))
      .toContainText('🌙')
    await expect(frame.getByTestId('message-attachment').filter({ hasText: attachmentName }))
      .toBeVisible()
    await assertUniqueMessage(frame, offlineText)
    await assertUniqueMessage(frame, readTargetText)
  }

  for (const page of [first.page, second.page]) {
    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage))
    expect(localStorageDump).not.toContain(attachmentContent)
    expect(localStorageDump).not.toContain(
      page === first.page
        ? first.bootstrap.matrix.accessToken
        : second.bootstrap.matrix.accessToken,
    )
  }

  await firstContext.setOffline(false)
  await secondContext.setOffline(false)
}

test.describe('Vibe Chat complete Matrix message operations', () => {
  test.setTimeout(300_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  const contracts: ChatContractCase[] = [
    { spaceId: 'space-default', label: 'Default Chat' },
    { spaceId: 'space-campfire', label: 'Campfire' },
  ]
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  let firstContext: BrowserContext
  let secondContext: BrowserContext
  let first: MatrixUser
  let second: MatrixUser

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    firstContext = await browser.newContext()
    secondContext = await browser.newContext()
    first = await createMatrixUser(
      firstContext,
      'Matrix Ops Alice',
      `e2e-matrix-ops-a-${suffix}@example.com`,
    )
    second = await createMatrixUser(
      secondContext,
      'Matrix Ops Bob',
      `e2e-matrix-ops-b-${suffix}@example.com`,
    )

    const requestResponse = await first.page.request.post('/v1/friend-requests', {
      data: { recipientUserId: second.bootstrap.user.id },
    })
    expect(requestResponse.status(), await requestResponse.text()).toBe(201)
    const secondSocialResponse = await second.page.request.get('/v1/contacts')
    expect(secondSocialResponse.ok(), await secondSocialResponse.text()).toBeTruthy()
    const secondSocial = await secondSocialResponse.json()
    const friendRequestId = secondSocial.incomingRequests[0].id
    const acceptResponse = await second.page.request.post(
      `/v1/friend-requests/${encodeURIComponent(friendRequestId)}/accept`,
      { data: {} },
    )
    expect(acceptResponse.ok(), await acceptResponse.text()).toBeTruthy()
  })

  test.afterAll(async () => {
    if (!firstContext || !secondContext) return
    await Promise.allSettled([
      firstContext.setOffline(false),
      secondContext.setOffline(false),
    ])
    await closeBrowserContexts([firstContext, secondContext])
  })

  for (const contract of contracts) {
    test(`runs the shared Chat Core contract in ${contract.spaceId}`, async () => {
      const room = await createSpace(first, second, contract)
      const runtimeResponse = await first.page.request.get(
        `/v1/spaces/instances/${encodeURIComponent(room.matrixRoomId)}`,
      )
      expect(runtimeResponse.ok(), await runtimeResponse.text()).toBeTruthy()
      const runtime = await runtimeResponse.json()
      expect(runtime.project.template.id).toBe(contract.spaceId)
      await exerciseChatCoreContract({
        contract,
        first,
        firstContext,
        roomId: room.matrixRoomId,
        second,
        secondContext,
        suffix,
      })
    })
  }
})
