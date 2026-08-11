import { expect, test, type BrowserContext } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'

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
        first.page.goto(`/zh-CN/rooms/${encodeURIComponent(room.matrixRoomId)}`),
        second.page.goto(`/zh-CN/rooms/${encodeURIComponent(room.matrixRoomId)}`),
      ])
      for (const page of [first.page, second.page]) {
        await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
        await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      }

      await first.page.getByTestId('message-input').fill(`typing-${suffix}`)
      await expect(second.page.getByTestId('typing-indicator')).toBeVisible()
      await first.page.getByTestId('message-input').fill('')
      await expect(second.page.getByTestId('typing-indicator')).toHaveCount(0)

      const originalText = `Original matrix text ${suffix}`
      await first.page.getByTestId('message-input').fill(originalText)
      await first.page.getByTestId('send-message').click()
      const firstMessage = first.page.getByTestId('message-body')
        .filter({ hasText: originalText })
        .locator('xpath=ancestor::article')
      const secondMessage = second.page.getByTestId('message-body')
        .filter({ hasText: originalText })
        .locator('xpath=ancestor::article')
      await expect(firstMessage).toContainText('已发送')
      await expect(secondMessage).toBeVisible()
      await expect(secondMessage.getByRole('button', { name: '编辑消息' })).toHaveCount(0)
      await expect(secondMessage.getByRole('button', { name: '删除消息' })).toHaveCount(0)

      await firstMessage.hover()
      await firstMessage.getByRole('button', { name: '编辑消息' }).click()
      await expect(first.page.getByTestId('edit-preview')).toBeVisible()
      const editedText = `Edited matrix text ${suffix}`
      await first.page.getByTestId('message-input').fill(editedText)
      await first.page.getByTestId('send-message').click()
      const editedFirstMessage = first.page.getByTestId('message-body')
        .filter({ hasText: editedText })
        .locator('xpath=ancestor::article')
      const editedSecondMessage = second.page.getByTestId('message-body')
        .filter({ hasText: editedText })
        .locator('xpath=ancestor::article')
      await expect(editedFirstMessage).toContainText('已编辑')
      await expect(editedSecondMessage).toContainText('已编辑')

      first.page.once('dialog', (dialog) => void dialog.accept())
      await editedFirstMessage.hover()
      await editedFirstMessage.getByRole('button', { name: '删除消息' }).click()
      const deletedFirstMessage = first.page.getByTestId('message-body')
        .filter({ hasText: '这条消息已删除' })
        .locator('xpath=ancestor::article')
      const deletedSecondMessage = second.page.getByTestId('message-body')
        .filter({ hasText: '这条消息已删除' })
        .locator('xpath=ancestor::article')
      await expect(deletedFirstMessage).toBeVisible()
      await expect(deletedSecondMessage).toBeVisible()

      const attachmentName = `matrix-attachment-${suffix}.txt`
      const attachmentContent = `attachment-content-${suffix}`
      await first.page.getByTestId('attachment-input').setInputFiles({
        name: attachmentName,
        mimeType: 'text/plain',
        buffer: Buffer.from(attachmentContent),
      })
      const firstAttachment = first.page.getByTestId('message-attachment')
        .filter({ hasText: attachmentName })
      const secondAttachment = second.page.getByTestId('message-attachment')
        .filter({ hasText: attachmentName })
      await expect(firstAttachment).toBeVisible({ timeout: 15_000 })
      await expect(secondAttachment).toBeVisible({ timeout: 15_000 })

      const offlineText = `Queued while offline ${suffix}`
      await secondContext.setOffline(true)
      await second.page.getByTestId('message-input').fill(offlineText)
      await second.page.getByTestId('send-message').click()
      const queuedMessage = second.page.getByTestId('message-body')
        .filter({ hasText: offlineText })
        .locator('xpath=ancestor::article')
      await expect(queuedMessage).toContainText(/发送中|发送失败/)
      await expect(first.page.getByTestId('message-body').filter({ hasText: offlineText })).toHaveCount(0)
      await secondContext.setOffline(false)
      const retryButton = queuedMessage.getByTestId('retry-message')
      if (await retryButton.count()) await retryButton.click()
      await expect(
        first.page.getByTestId('message-body').filter({ hasText: offlineText }),
      ).toHaveCount(1, { timeout: 20_000 })
      await expect(queuedMessage).toContainText('已发送', { timeout: 20_000 })

      await first.page.goto('/zh-CN/messages')
      await first.page.getByTestId('conversation-search').fill(attachmentName)
      await expect(first.page.getByTestId('conversation-row')).toHaveCount(1)
      await expect(first.page.getByTestId('conversation-row')).toContainText('Matrix Operations E2E')

      await second.page.reload()
      await expect(second.page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await expect(
        second.page.getByTestId('message-body').filter({ hasText: '这条消息已删除' }),
      ).toHaveCount(1)
      await expect(
        second.page.getByTestId('message-attachment').filter({ hasText: attachmentName }),
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
