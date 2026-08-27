import { resolve } from 'node:path'
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type FrameLocator,
  type Page,
} from '@playwright/test'
import { completeChatOnboarding, signInViaAPI, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'
const e2eBaseUrl = process.env.E2E_BASE_URL || 'http://localhost:8001'
const matrixBaseUrl = process.env.MATRIX_PUBLIC_HOMESERVER_URL || 'http://localhost:8008'

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

async function createMatrixUser(context: BrowserContext, label: string, email: string) {
  const page = await context.newPage()
  const signUp = await signUpViaAPI(page, { name: label, email, password })
  expect(signUp.ok(), await signUp.text()).toBeTruthy()
  await completeChatOnboarding(page)
  const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
  expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
  const bootstrap = await bootstrapResponse.json()
  expect(bootstrap.matrix.status).toBe('ready')
  return { page, bootstrap, email }
}

async function signInFresh(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: e2eBaseUrl })
  const page = await context.newPage()
  const signIn = await signInViaAPI(page, { email, password })
  expect(signIn.ok(), await signIn.text()).toBeTruthy()
  return { context, page }
}

async function createSpace(
  owner: Awaited<ReturnType<typeof createMatrixUser>>,
  member: Awaited<ReturnType<typeof createMatrixUser>>,
  spaceId: 'space-default' | 'space-campfire',
  label: string,
) {
  const response = await owner.page.request.post('/v1/rooms', {
    data: {
      spaceId,
      participantUserIds: [member.bootstrap.user.id],
      instanceConfig: {},
      clientRequestId: `member-history-${spaceId}-${crypto.randomUUID()}`,
      name: label,
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  const room = await response.json()
  const join = await member.page.request.post(
    `${matrixBaseUrl}/_matrix/client/v3/join/${encodeURIComponent(room.matrixRoomId)}`,
    {
      data: {},
      headers: { authorization: `Bearer ${member.bootstrap.matrix.accessToken}` },
    },
  )
  expect(join.ok(), await join.text()).toBeTruthy()
  return room as { matrixRoomId: string }
}

async function sendMatrixHistory(
  page: Page,
  roomId: string,
  accessToken: string,
  prefix: string,
  count: number,
) {
  const bodies: string[] = []
  for (let index = 0; index < count; index += 1) {
    const body = `${prefix} ${String(index).padStart(2, '0')}`
    let sent = false
    for (let attempt = 0; attempt < 10 && !sent; attempt += 1) {
      const response = await page.request.put(
        `${matrixBaseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}`
          + `/send/m.room.message/${encodeURIComponent(`history-${crypto.randomUUID()}`)}`,
        {
          data: { msgtype: 'm.text', body },
          headers: { authorization: `Bearer ${accessToken}` },
        },
      )
      if (response.status() === 429) {
        const rateLimit = await response.json() as { retry_after_ms?: number }
        await page.waitForTimeout(Math.max(250, rateLimit.retry_after_ms ?? 1_000))
        continue
      }
      expect(response.ok(), await response.text()).toBeTruthy()
      sent = true
    }
    expect(sent, `Matrix did not accept history message ${index}`).toBe(true)
    bodies.push(body)
  }
  return bodies
}

async function readControlPlaneEvidence(matrixRoomId: string, userId: string) {
  const sqlitePath = resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/local.sqlite')
  const Database = (await import('better-sqlite3')).default
  const db = new Database(sqlitePath, { readonly: true })
  try {
    const room = db.prepare(
      'SELECT space_instance_id FROM room_index WHERE matrix_room_id = ?',
    ).get(matrixRoomId) as { space_instance_id: string } | undefined
    expect(room).toBeTruthy()
    const count = (sql: string, value: string) => (
      db.prepare(sql).get(value) as { count: number }
    ).count
    const user = db.prepare('SELECT credit_balance FROM "user" WHERE id = ?')
      .get(userId) as { credit_balance: string } | undefined
    expect(user).toBeTruthy()
    return {
      turnCount: count(
        'SELECT COUNT(*) AS count FROM space_runtime_turn WHERE space_instance_id = ?',
        room!.space_instance_id,
      ),
      creditTransactionCount: count(
        'SELECT COUNT(*) AS count FROM credit_transaction WHERE user_id = ?',
        userId,
      ),
      creditBalance: user!.credit_balance,
    }
  } finally {
    db.close()
  }
}

async function sdkMessages(frame: FrameLocator) {
  return frame.locator('body').evaluate(() => {
    const messages = (window as unknown as {
      spaceApp: { chat: { messages: Array<Record<string, unknown>> } }
    }).spaceApp.chat.messages
    return structuredClone(messages)
  })
}

async function loadEarlierAndAssertStable(frame: FrameLocator, earliestBody: string) {
  const timeline = frame.getByTestId('message-timeline')
  const before = await timeline.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }))
  await frame.getByTestId('load-earlier-messages').click()
  await expect(frame.getByTestId('message-body').filter({ hasText: earliestBody }))
    .toHaveCount(1, { timeout: 30_000 })
  await expect.poll(async () => timeline.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }))).toMatchObject({
    scrollHeight: expect.any(Number),
    scrollTop: expect.any(Number),
  })
  const after = await timeline.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }))
  expect(Math.abs(
    (after.scrollHeight - after.scrollTop) - (before.scrollHeight - before.scrollTop),
  )).toBeLessThan(80)
}

async function assertUniqueSdkTimeline(frame: FrameLocator) {
  const ids = (await sdkMessages(frame)).map((message) => String(message.id))
  expect(new Set(ids).size).toBe(ids.length)
}

test.describe('Space Chat member Mention and bounded history', () => {
  test.setTimeout(300_000)
  test.skip(process.env.E2E_MATRIX_EXPECT_READY !== '1', 'Requires local Synapse')
  test.skip(
    (process.env.DB_DIALECT || 'sqlite') !== 'sqlite',
    'Agent/credits side-effect evidence currently uses the local SQLite control plane',
  )

  test('keeps member Mention side-effect free and paginates Default/custom Apps', async ({ browser }) => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const aliceEmail = `e2e-member-history-a-${suffix}@example.com`
    const bobEmail = `e2e-member-history-b-${suffix}@example.com`
    const setupAliceContext = await browser.newContext({ baseURL: e2eBaseUrl })
    const setupBobContext = await browser.newContext({ baseURL: e2eBaseUrl })

    let freshAlice: Awaited<ReturnType<typeof signInFresh>> | undefined
    let freshBob: Awaited<ReturnType<typeof signInFresh>> | undefined
    try {
      const alice = await createMatrixUser(setupAliceContext, 'Member History Alice', aliceEmail)
      const bob = await createMatrixUser(setupBobContext, 'Member History Bob', bobEmail)
      const friendRequest = await alice.page.request.post('/v1/friend-requests', {
        data: { recipientUserId: bob.bootstrap.user.id },
      })
      expect(friendRequest.status(), await friendRequest.text()).toBe(201)
      const bobSocial = await (await bob.page.request.get('/v1/contacts')).json()
      const accept = await bob.page.request.post(
        `/v1/friend-requests/${encodeURIComponent(bobSocial.incomingRequests[0].id)}/accept`,
        { data: {} },
      )
      expect(accept.ok(), await accept.text()).toBeTruthy()

      const defaultRoom = await createSpace(alice, bob, 'space-default', 'Default History E2E')
      const customRoom = await createSpace(alice, bob, 'space-campfire', 'Campfire History E2E')

      await Promise.all([
        alice.page.goto(`/spaces/${encodeURIComponent(defaultRoom.matrixRoomId)}`),
        bob.page.goto(`/spaces/${encodeURIComponent(defaultRoom.matrixRoomId)}`),
      ])
      const [aliceChat, bobChat] = await Promise.all([
        openAppChat(alice.page),
        openAppChat(bob.page),
      ])

      const beforeMention = await readControlPlaneEvidence(
        defaultRoom.matrixRoomId,
        alice.bootstrap.user.id,
      )
      await aliceChat.getByTestId('message-input').fill('@')
      const bobMention = aliceChat.locator('#vcc-mentions [data-handle]')
        .filter({ hasText: 'Member History Bob' })
      await expect(bobMention).toHaveCount(1)
      await bobMention.click()
      const mentionText = `${await aliceChat.getByTestId('message-input').inputValue()}`
        + `member mention ${suffix}`
      await aliceChat.getByTestId('message-input').fill(mentionText)
      await aliceChat.getByTestId('send-message').click()

      const aliceMentionMessage = aliceChat.getByTestId('message-body')
        .filter({ hasText: mentionText }).locator('xpath=ancestor::article')
      const bobMentionMessage = bobChat.getByTestId('message-body')
        .filter({ hasText: mentionText }).locator('xpath=ancestor::article')
      await expect(aliceMentionMessage).toHaveAttribute('data-mentioned', 'false')
      await expect(bobMentionMessage).toHaveAttribute('data-mentioned', 'true')

      const projected = (await sdkMessages(bobChat)).find(
        (message) => message.text === mentionText,
      )
      expect(projected?.mentionedUserIds).toEqual([bob.bootstrap.matrix.userId])
      const timelineResponse = await alice.page.request.get(
        `${matrixBaseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(defaultRoom.matrixRoomId)}`
          + '/messages?dir=b&limit=20',
        { headers: { authorization: `Bearer ${alice.bootstrap.matrix.accessToken}` } },
      )
      expect(timelineResponse.ok(), await timelineResponse.text()).toBeTruthy()
      const mentionEvent = (await timelineResponse.json()).chunk.find(
        (event: any) => event.content?.body === mentionText,
      )
      expect(mentionEvent).toMatchObject({
        content: {
          'm.mentions': { user_ids: [bob.bootstrap.matrix.userId] },
        },
      })
      expect(mentionEvent.content).not.toHaveProperty('io.vibechat.agent_mentions')

      const invalidMentionText = `forged member ${suffix}`
      const invalidMentionError = await aliceChat.locator('body').evaluate(async (_element, { text }) => {
        try {
          await (window as unknown as {
            spaceApp: { chat: { send(input: unknown): Promise<unknown> } }
          }).spaceApp.chat.send({
            text,
            mentionIds: ['@mallory:localhost'],
          })
          return null
        } catch (error) {
          return error instanceof Error ? error.message : String(error)
        }
      }, { text: invalidMentionText })
      expect(invalidMentionError).toBe('CHAT_MENTION_INVALID')
      await expect(aliceChat.getByTestId('message-body').filter({ hasText: invalidMentionText }))
        .toHaveCount(0)

      const messagesBeforeInvalidHistory = await sdkMessages(aliceChat)
      const invalidHistoryErrors = await aliceChat.locator('body').evaluate(async () => {
        const recent = (window as unknown as {
          spaceApp: { chat: { recent(options: unknown): Promise<unknown> } }
        }).spaceApp.chat.recent
        const errors: string[] = []
        for (const options of [{ limit: 51 }, { before: '$unknown-event' }]) {
          try {
            await recent(options)
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        return errors
      })
      expect(invalidHistoryErrors).toEqual([
        'CHAT_HISTORY_LIMIT_INVALID',
        'CHAT_HISTORY_CURSOR_INVALID',
      ])
      expect(await sdkMessages(aliceChat)).toEqual(messagesBeforeInvalidHistory)

      const afterMention = await readControlPlaneEvidence(
        defaultRoom.matrixRoomId,
        alice.bootstrap.user.id,
      )
      expect(afterMention).toEqual(beforeMention)
      await aliceChat.getByTestId('message-input').fill('@')
      await expect(aliceChat.locator('#vcc-mentions [data-handle*="vibe_agent_"]')).toHaveCount(0)

      const [defaultBodies, customBodies] = await Promise.all([
        sendMatrixHistory(
          alice.page,
          defaultRoom.matrixRoomId,
          alice.bootstrap.matrix.accessToken,
          `Default outside sync ${suffix}`,
          35,
        ),
        sendMatrixHistory(
          bob.page,
          customRoom.matrixRoomId,
          bob.bootstrap.matrix.accessToken,
          `Campfire outside sync ${suffix}`,
          35,
        ),
      ])

      await setupAliceContext.close()
      await setupBobContext.close()
      freshAlice = await signInFresh(browser, aliceEmail)
      freshBob = await signInFresh(browser, bobEmail)
      await Promise.all([
        freshAlice.page.goto(`/spaces/${encodeURIComponent(defaultRoom.matrixRoomId)}`),
        freshBob.page.goto(`/spaces/${encodeURIComponent(customRoom.matrixRoomId)}`),
      ])
      const [defaultChat, customChat] = await Promise.all([
        openAppChat(freshAlice.page),
        openAppChat(freshBob.page),
      ])
      await expect(customChat.getByText('夜航电台')).toBeVisible()
      await expect(defaultChat.getByTestId('message-body').filter({ hasText: defaultBodies[0] }))
        .toHaveCount(0)
      await expect(customChat.getByTestId('message-body').filter({ hasText: customBodies[0] }))
        .toHaveCount(0)

      await Promise.all([
        loadEarlierAndAssertStable(defaultChat, defaultBodies[0]),
        loadEarlierAndAssertStable(customChat, customBodies[0]),
      ])
      await Promise.all([
        assertUniqueSdkTimeline(defaultChat),
        assertUniqueSdkTimeline(customChat),
      ])

      for (const [frame, earliestBody] of [
        [defaultChat, defaultBodies[0]],
        [customChat, customBodies[0]],
      ] as const) {
        const earliest = (await sdkMessages(frame)).find((message) => message.text === earliestBody)
        expect(earliest?.id).toBeTruthy()
        await frame.locator('body').evaluate(async (_element, { before }) => {
          const chat = (window as unknown as {
            spaceApp: { chat: { recent(options: unknown): Promise<unknown> } }
          }).spaceApp.chat
          await chat.recent({ limit: 30, before })
          await chat.recent({ limit: 30, before })
        }, { before: earliest!.id })
        await assertUniqueSdkTimeline(frame)
      }

      await Promise.all([freshAlice.page.reload(), freshBob.page.reload()])
      const [reloadedDefault, reloadedCustom] = await Promise.all([
        openAppChat(freshAlice.page),
        openAppChat(freshBob.page),
      ])
      for (const [frame, earliestBody] of [
        [reloadedDefault, defaultBodies[0]],
        [reloadedCustom, customBodies[0]],
      ] as const) {
        if (await frame.getByTestId('message-body').filter({ hasText: earliestBody }).count() === 0) {
          await frame.getByTestId('load-earlier-messages').click()
        }
        await expect(frame.getByTestId('message-body').filter({ hasText: earliestBody }))
          .toHaveCount(1)
        await assertUniqueSdkTimeline(frame)
      }
    } finally {
      await Promise.allSettled([
        setupAliceContext.close(),
        setupBobContext.close(),
        freshAlice?.context.close() ?? Promise.resolve(),
        freshBob?.context.close() ?? Promise.resolve(),
      ])
    }
  })
})
