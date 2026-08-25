import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'

async function createMatrixUser(
  context: BrowserContext,
  name: string,
  email: string,
) {
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

async function expectMatrixReady(page: Page) {
  await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
}

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

test.describe('Vibe Chat social trust and Matrix invitation', () => {
  test.setTimeout(120_000)

  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('completes friend request, Space invitation, join, and bidirectional Chat', async ({ browser }) => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const aliceContext = await browser.newContext()
    const bobContext = await browser.newContext()

    try {
      const alice = await createMatrixUser(
        aliceContext,
        'Alice Social E2E',
        `e2e-social-alice-${suffix}@example.com`,
      )
      const bob = await createMatrixUser(
        bobContext,
        'Bob Social E2E',
        `e2e-social-bob-${suffix}@example.com`,
      )

      const unauthorizedInvite = await alice.page.request.post('/v1/rooms', {
        data: {
          spaceId: 'space-campfire',
          participantUserIds: [bob.bootstrap.user.id],
          instanceConfig: {},
          clientRequestId: `not-contact-${crypto.randomUUID()}`,
          name: 'Trust required',
        },
      })
      expect(unauthorizedInvite.status()).toBe(409)
      await expect(unauthorizedInvite.json()).resolves.toMatchObject({
        error: { code: 'SOCIAL_NOT_CONTACT' },
      })

      await alice.page.goto('/contacts')
      await expectMatrixReady(alice.page)
      await alice.page.getByPlaceholder('搜索名字或用户名').fill(bob.bootstrap.user.email)
      const searchResult = alice.page.getByTestId('user-search-result')
      await expect(searchResult).toHaveCount(1)
      await expect(searchResult).toContainText('Bob Social E2E')
      await searchResult.getByRole('button', { name: '发送好友请求' }).click()
      await expect(searchResult.getByRole('button', { name: '好友请求已发送' })).toBeDisabled()

      const repeatedRequest = await alice.page.request.post('/v1/friend-requests', {
        data: { recipientUserId: bob.bootstrap.user.id },
      })
      expect(repeatedRequest.status(), await repeatedRequest.text()).toBe(201)
      const repeated = await repeatedRequest.json()

      const alicePendingResponse = await alice.page.request.get('/v1/contacts')
      expect(alicePendingResponse.ok(), await alicePendingResponse.text()).toBeTruthy()
      const alicePending = await alicePendingResponse.json()
      expect(alicePending.outgoingRequests).toHaveLength(1)
      expect(alicePending.outgoingRequests[0]).toMatchObject({
        id: repeated.id,
        status: 'pending',
        person: { id: bob.bootstrap.user.id },
      })

      await bob.page.goto('/contacts')
      await expectMatrixReady(bob.page)
      const incomingRequest = bob.page.getByTestId('friend-request')
      await expect(incomingRequest).toHaveCount(1)
      await expect(incomingRequest).toContainText('Alice Social E2E')
      await incomingRequest.getByRole('button', { name: '接受请求' }).click()
      await expect(incomingRequest).toHaveCount(0)

      const [aliceContactsResponse, bobContactsResponse] = await Promise.all([
        alice.page.request.get('/v1/contacts'),
        bob.page.request.get('/v1/contacts'),
      ])
      expect(aliceContactsResponse.ok(), await aliceContactsResponse.text()).toBeTruthy()
      expect(bobContactsResponse.ok(), await bobContactsResponse.text()).toBeTruthy()
      const aliceContacts = await aliceContactsResponse.json()
      const bobContacts = await bobContactsResponse.json()
      expect(aliceContacts.contacts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: bob.bootstrap.user.id }),
      ]))
      expect(bobContacts.contacts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: alice.bootstrap.user.id }),
      ]))

      await alice.page.reload()
      await expectMatrixReady(alice.page)
      const bobContact = alice.page.getByTestId('contact-row').filter({ hasText: 'Bob Social E2E' })
      await expect(bobContact).toBeVisible()
      await bobContact.click()
      await alice.page.getByTestId('start-space-with-contact').click()
      const dialog = alice.page.getByTestId('new-space-dialog')
      await expect(dialog).toContainText('Bob Social E2E')
      const dialogBackground = await dialog.evaluate(
        (element) => window.getComputedStyle(element).backgroundColor,
      )
      expect(dialogBackground).not.toBe('transparent')
      expect(dialogBackground).not.toBe('rgba(0, 0, 0, 0)')
      await dialog.getByRole('button', { name: '下一页' }).click()
      await dialog.getByRole('button', { name: /夜航电台/ }).click()
      await dialog.getByRole('button', { name: '下一页' }).click()
      await dialog.getByRole('button', { name: '创建 Space' }).click()
      await expect(alice.page).toHaveURL(/\/spaces\/!/)
      await expectMatrixReady(alice.page)
      const roomId = decodeURIComponent(new URL(alice.page.url()).pathname.split('/').at(-1)!)

      await bob.page.goto('/spaces')
      await expectMatrixReady(bob.page)
      const invitedRoom = bob.page.locator(
        '[data-testid="space-row"][data-membership="invite"]',
      )
      // Matrix invitations arrive through the recipient's long-polling /sync.
      // Give the live sync cycle room to complete under a loaded local Synapse.
      await expect(invitedRoom).toHaveCount(1, { timeout: 20_000 })
      await invitedRoom.getByTestId('accept-room-invite').click()
      await expect(invitedRoom).toHaveCount(0)
      const joinedRoom = bob.page.locator(
        '[data-testid="space-row"][data-membership="join"]',
      )
      await expect(joinedRoom).toHaveCount(1)
      await joinedRoom.getByRole('link').click()
      await expect(bob.page).toHaveURL(new RegExp(`/spaces/${encodeURIComponent(roomId)}`))
      const [aliceChat, bobChat] = await Promise.all([
        openAppChat(alice.page),
        openAppChat(bob.page),
      ])

      const aliceText = `Alice 到达房间 ${suffix}`
      await aliceChat.getByTestId('message-input').fill(aliceText)
      await aliceChat.getByTestId('send-message').click()
      await expect(
        aliceChat.getByTestId('message-body').filter({ hasText: aliceText }),
      ).toHaveCount(1)
      await expect(
        bobChat.getByTestId('message-body').filter({ hasText: aliceText }),
      ).toHaveCount(1)

      const aliceMessage = bobChat.getByTestId('message-body')
        .filter({ hasText: aliceText })
        .locator('xpath=ancestor::article')
      await aliceMessage.getByRole('button', { name: '回复' }).click()
      const bobText = `Bob 已收到 ${suffix}`
      await bobChat.getByTestId('message-input').fill(bobText)
      await bobChat.getByTestId('send-message').click()
      await expect(
        aliceChat.getByTestId('message-body')
          .filter({ hasText: bobText })
          .locator('xpath=ancestor::article'),
      ).toContainText(aliceText)

      await bob.page.goto('/contacts')
      await expectMatrixReady(bob.page)
      const aliceContact = bob.page.getByTestId('contact-row').filter({ hasText: 'Alice Social E2E' })
      await expect(aliceContact).toBeVisible()
      await aliceContact.click()
      bob.page.once('dialog', (dialog) => void dialog.accept())
      await bob.page.getByRole('button', { name: '屏蔽联系人' }).click()
      await expect(aliceContact).toHaveCount(0)

      const blockedRequest = await alice.page.request.post('/v1/friend-requests', {
        data: { recipientUserId: bob.bootstrap.user.id },
      })
      expect(blockedRequest.status()).toBe(403)
      await expect(blockedRequest.json()).resolves.toMatchObject({
        error: { code: 'SOCIAL_BLOCKED' },
      })
      const blockedInvite = await alice.page.request.post('/v1/rooms', {
        data: {
          spaceId: 'space-campfire',
          participantUserIds: [bob.bootstrap.user.id],
          instanceConfig: {},
          clientRequestId: `blocked-invite-${crypto.randomUUID()}`,
          name: 'Blocked invitation',
        },
      })
      expect(blockedInvite.status()).toBe(403)
      await expect(blockedInvite.json()).resolves.toMatchObject({
        error: { code: 'SOCIAL_BLOCKED' },
      })

      await bob.page.goto('/me')
      await expectMatrixReady(bob.page)
      await bob.page.getByTestId('manage-privacy').click()
      const blockedUser = bob.page.getByTestId('blocked-user')
      await expect(blockedUser).toContainText('Alice Social E2E')
      await blockedUser.getByRole('button', { name: '解除屏蔽' }).click()
      await expect(blockedUser).toHaveCount(0)

      const renewedRequest = await alice.page.request.post('/v1/friend-requests', {
        data: { recipientUserId: bob.bootstrap.user.id },
      })
      expect(renewedRequest.status(), await renewedRequest.text()).toBe(201)
      const bobRenewedSnapshot = await bob.page.request.get('/v1/contacts')
      expect(bobRenewedSnapshot.ok(), await bobRenewedSnapshot.text()).toBeTruthy()
      await expect(bobRenewedSnapshot.json()).resolves.toMatchObject({
        contacts: [],
        incomingRequests: [expect.objectContaining({
          status: 'pending',
          person: expect.objectContaining({ id: alice.bootstrap.user.id }),
        })],
        blockedUserIds: [],
      })
    } finally {
      await aliceContext.close()
      await bobContext.close()
    }
  })
})
