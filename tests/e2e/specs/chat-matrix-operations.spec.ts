import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'

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

test.describe('Vibe Chat complete Matrix message operations', () => {
  test.setTimeout(120_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('syncs typing, edit, redaction, media, search, and recovery across two users', async ({ browser }) => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const firstContext = await browser.newContext()
    const secondContext = await browser.newContext()

    try {
      const first = await createMatrixUser(
        firstContext,
        'Matrix Ops Alice',
        `e2e-matrix-ops-a-${suffix}@example.com`,
      )
      const second = await createMatrixUser(
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

      const roomResponse = await first.page.request.post('/v1/rooms', {
        data: {
          spaceId: 'space-campfire',
          participantUserIds: [second.bootstrap.user.id],
          instanceConfig: {},
          clientRequestId: `matrix-ops-${crypto.randomUUID()}`,
          name: 'Matrix Operations E2E',
        },
      })
      expect(roomResponse.status(), await roomResponse.text()).toBe(201)
      const room = await roomResponse.json()
      const joinResponse = await second.page.request.post(
        `http://localhost:8008/_matrix/client/v3/join/${encodeURIComponent(room.matrixRoomId)}`,
        {
          data: {},
          headers: { authorization: `Bearer ${second.bootstrap.matrix.accessToken}` },
        },
      )
      expect(joinResponse.ok(), await joinResponse.text()).toBeTruthy()

      await Promise.all([
        first.page.goto(`/spaces/${encodeURIComponent(room.matrixRoomId)}`),
        second.page.goto(`/spaces/${encodeURIComponent(room.matrixRoomId)}`),
      ])
      for (const page of [first.page, second.page]) {
        await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
        await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      }
      const [firstChat, secondChat] = await Promise.all([
        openAppChat(first.page),
        openAppChat(second.page),
      ])

      await firstChat.getByTestId('message-input').fill(`typing-${suffix}`)
      await expect(secondChat.getByTestId('typing-indicator')).toBeVisible()
      await firstChat.getByTestId('message-input').fill('')
      await expect(secondChat.getByTestId('typing-indicator')).toBeHidden()

      const originalText = `Original matrix text ${suffix}`
      await firstChat.getByTestId('message-input').fill(originalText)
      await firstChat.getByTestId('send-message').click()
      const firstMessage = firstChat.getByTestId('message-body')
        .filter({ hasText: originalText })
        .locator('xpath=ancestor::article')
      const secondMessage = secondChat.getByTestId('message-body')
        .filter({ hasText: originalText })
        .locator('xpath=ancestor::article')
      await expect(firstMessage).toContainText('已发送')
      await expect(secondMessage).toBeVisible()
      await expect(secondMessage.getByRole('button', { name: '编辑' })).toHaveCount(0)
      await expect(secondMessage.getByRole('button', { name: '删除' })).toHaveCount(0)

      await firstMessage.hover()
      await firstMessage.getByRole('button', { name: '编辑' }).click()
      await expect(firstChat.getByTestId('chat-context')).toBeVisible()
      const editedText = `Edited matrix text ${suffix}`
      await firstChat.getByTestId('message-input').fill(editedText)
      await firstChat.getByTestId('send-message').click()
      const editedFirstMessage = firstChat.getByTestId('message-body')
        .filter({ hasText: editedText })
        .locator('xpath=ancestor::article')
      const editedSecondMessage = secondChat.getByTestId('message-body')
        .filter({ hasText: editedText })
        .locator('xpath=ancestor::article')
      await expect(editedFirstMessage).toContainText('已编辑')
      await expect(editedSecondMessage).toContainText('已编辑')

      await editedFirstMessage.hover()
      await editedFirstMessage.getByRole('button', { name: '删除' }).click()
      const deletedFirstMessage = firstChat.getByTestId('message-body')
        .filter({ hasText: '这条消息已删除' })
        .locator('xpath=ancestor::article')
      const deletedSecondMessage = secondChat.getByTestId('message-body')
        .filter({ hasText: '这条消息已删除' })
        .locator('xpath=ancestor::article')
      await expect(deletedFirstMessage).toBeVisible()
      await expect(deletedSecondMessage).toBeVisible()

      const attachmentName = `matrix-attachment-${suffix}.txt`
      const attachmentContent = `attachment-content-${suffix}`
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

      const offlineText = `Queued while offline ${suffix}`
      await secondContext.setOffline(true)
      await secondChat.getByTestId('message-input').fill(offlineText)
      await secondChat.getByTestId('send-message').click()
      const queuedMessage = secondChat.getByTestId('message-body')
        .filter({ hasText: offlineText })
        .locator('xpath=ancestor::article')
      await expect(queuedMessage).toContainText(/发送中|发送失败/)
      await expect(firstChat.getByTestId('message-body').filter({ hasText: offlineText })).toHaveCount(0)
      await secondContext.setOffline(false)
      const retryButton = queuedMessage.getByTestId('retry-message')
      if (await retryButton.count()) await retryButton.click()
      await expect(
        firstChat.getByTestId('message-body').filter({ hasText: offlineText }),
      ).toHaveCount(1, { timeout: 20_000 })
      await expect(queuedMessage).toContainText('已发送', { timeout: 20_000 })

      await first.page.goto('/spaces')
      await first.page.getByTestId('space-search').fill(attachmentName)
      await expect(first.page.getByTestId('space-row')).toHaveCount(1)
      await expect(first.page.getByTestId('space-row')).toContainText('Matrix Operations E2E')

      await second.page.reload()
      await expect(second.page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      const reloadedChat = await openAppChat(second.page)
      await expect(
        reloadedChat.getByTestId('message-body').filter({ hasText: '这条消息已删除' }),
      ).toHaveCount(1)
      await expect(
        reloadedChat.getByTestId('message-attachment').filter({ hasText: attachmentName }),
      ).toBeVisible()
      const localStorageDump = await first.page.evaluate(() => JSON.stringify(window.localStorage))
      expect(localStorageDump).not.toContain(attachmentContent)
      expect(localStorageDump).not.toContain(first.bootstrap.matrix.accessToken)
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })
})
