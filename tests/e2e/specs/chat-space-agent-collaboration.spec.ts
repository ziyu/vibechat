import { resolve } from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'
const agentMetadataKey = 'io.vibechat.agent'
const agentMemberMetadataKey = 'io.vibechat.agent_member'
const e2eBaseUrl = process.env.E2E_BASE_URL || 'http://localhost:8001'

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

async function readSpaceRuntime(page: Page, matrixRoomId: string) {
  const response = await page.request.get(
    `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}`,
  )
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

async function setSpaceDefaultAgent(matrixRoomId: string, agentId: string) {
  if ((process.env.DB_DIALECT || 'sqlite') !== 'sqlite') {
    throw new Error('The deterministic fake-Agent E2E currently requires the local SQLite stack.')
  }

  const sqlitePath = resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/local.sqlite')
  const Database = (await import('better-sqlite3')).default
  const db = new Database(sqlitePath)
  try {
    const result = db.prepare(
      'UPDATE room_index SET default_agent_id = ?, updated_at = ? WHERE matrix_room_id = ?',
    ).run(agentId, Math.floor(Date.now() / 1000), matrixRoomId)
    expect(result.changes).toBe(1)
  } finally {
    db.close()
  }
}

async function createCollaborationFixture(
  browser: Browser,
  label: string,
  defaultAgentId = 'pi',
) {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const firstContext = await browser.newContext({ baseURL: e2eBaseUrl })
  const secondContext = await browser.newContext({ baseURL: e2eBaseUrl })

  try {
    const first = await createMatrixUser(
      firstContext,
      `${label} Alice`,
      `e2e-${label.toLowerCase().replaceAll(' ', '-')}-a-${suffix}@example.com`,
    )
    const second = await createMatrixUser(
      secondContext,
      `${label} Bob`,
      `e2e-${label.toLowerCase().replaceAll(' ', '-')}-b-${suffix}@example.com`,
    )

    const requestResponse = await first.page.request.post('/v1/friend-requests', {
      data: { recipientUserId: second.bootstrap.user.id },
    })
    expect(requestResponse.status(), await requestResponse.text()).toBe(201)
    const secondSocial = await (await second.page.request.get('/v1/contacts')).json()
    const acceptResponse = await second.page.request.post(
      `/v1/friend-requests/${encodeURIComponent(secondSocial.incomingRequests[0].id)}/accept`,
      { data: {} },
    )
    expect(acceptResponse.ok(), await acceptResponse.text()).toBeTruthy()

    const roomResponse = await first.page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-default',
        participantUserIds: [second.bootstrap.user.id],
        instanceConfig: {},
        clientRequestId: `agent-${label.toLowerCase().replaceAll(' ', '-')}-${crypto.randomUUID()}`,
        name: `${label} E2E`,
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

    if (defaultAgentId !== 'pi') {
      await setSpaceDefaultAgent(room.matrixRoomId, defaultAgentId)
    }

    await Promise.all([
      first.page.goto(`/spaces/${encodeURIComponent(room.matrixRoomId)}`),
      second.page.goto(`/spaces/${encodeURIComponent(room.matrixRoomId)}`),
    ])
    const [firstChat, secondChat] = await Promise.all([
      openAppChat(first.page),
      openAppChat(second.page),
    ])

    return {
      suffix,
      first,
      second,
      room,
      firstChat,
      secondChat,
      close: async () => {
        await firstContext.close()
        await secondContext.close()
      },
    }
  } catch (error) {
    await firstContext.close()
    await secondContext.close()
    throw error
  }
}

test.describe('Space Agent collaboration through the Matrix timeline', () => {
  test.setTimeout(480_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires local Synapse',
  )

  test('writes one idempotent Agent event that both members retain after refresh', async ({ browser }) => {
    test.skip(
      process.env.E2E_SPACE_AGENT_EXPECT_READY !== '1',
      'Requires a configured real Space Agent provider',
    )
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const firstContext = await browser.newContext({ baseURL: e2eBaseUrl })
    const secondContext = await browser.newContext({ baseURL: e2eBaseUrl })

    try {
      const first = await createMatrixUser(
        firstContext,
        'Agent Collaboration Alice',
        `e2e-agent-a-${suffix}@example.com`,
      )
      const second = await createMatrixUser(
        secondContext,
        'Agent Collaboration Bob',
        `e2e-agent-b-${suffix}@example.com`,
      )

      const requestResponse = await first.page.request.post('/v1/friend-requests', {
        data: { recipientUserId: second.bootstrap.user.id },
      })
      expect(requestResponse.status(), await requestResponse.text()).toBe(201)
      const secondSocial = await (await second.page.request.get('/v1/contacts')).json()
      const acceptResponse = await second.page.request.post(
        `/v1/friend-requests/${encodeURIComponent(secondSocial.incomingRequests[0].id)}/accept`,
        { data: {} },
      )
      expect(acceptResponse.ok(), await acceptResponse.text()).toBeTruthy()

      const roomResponse = await first.page.request.post('/v1/rooms', {
        data: {
          spaceId: 'space-default',
          participantUserIds: [second.bootstrap.user.id],
          instanceConfig: {},
          clientRequestId: `agent-collaboration-${crypto.randomUUID()}`,
          name: 'Agent Collaboration E2E',
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
      const [firstChat, secondChat] = await Promise.all([
        openAppChat(first.page),
        openAppChat(second.page),
      ])

      const humanText = `Human collaboration ${suffix}`
      await firstChat.getByTestId('message-input').fill(humanText)
      await firstChat.getByTestId('send-message').click()
      await expect(secondChat.getByTestId('message-body').filter({ hasText: humanText })).toHaveCount(1)

      const beforeResponse = await first.page.request.get(
        `/v1/spaces/instances/${encodeURIComponent(room.matrixRoomId)}`,
      )
      expect(beforeResponse.ok(), await beforeResponse.text()).toBeTruthy()
      const before = await beforeResponse.json()
      expect(before).toMatchObject({
        defaultAgentId: 'pi',
        availableAgents: [{ id: 'pi', name: 'Pi', available: true }],
        agents: [{
          binding: {
            agentId: 'pi',
            isDefault: true,
            status: 'active',
          },
          definition: {
            agentId: 'pi',
            displayName: 'Pi',
            status: 'active',
            availability: 'available',
          },
        }],
      })
      const matrixV2StateResponse = await first.page.request.get(
        `http://localhost:8008/_matrix/client/v3/rooms/${encodeURIComponent(room.matrixRoomId)}/state/${encodeURIComponent('io.vibechat.space.instance.v2')}/`,
        { headers: { authorization: `Bearer ${first.bootstrap.matrix.accessToken}` } },
      )
      expect(matrixV2StateResponse.ok(), await matrixV2StateResponse.text()).toBeTruthy()
      await expect(matrixV2StateResponse.json()).resolves.toMatchObject({
        schemaVersion: 'vibechat.space-instance/v2',
        defaultAgentId: 'pi',
        agents: [{
          binding: { agentId: 'pi', isDefault: true, status: 'active' },
          definition: { agentId: 'pi', displayName: 'Pi', availability: 'available' },
        }],
      })
      const replyToken = `AGENT_MATRIX_${suffix.replaceAll('-', '_')}`
      const agentPrompt = `@pi 请只回复 ${replyToken}，不要修改任何 App 代码。`
      await firstChat.getByTestId('message-input').fill(agentPrompt)
      await firstChat.getByTestId('send-message').click()

      const firstAgentMessage = firstChat.locator('[data-testid="chat-message"][data-agent="true"]')
        .filter({ hasText: replyToken })
      const secondAgentMessage = secondChat.locator('[data-testid="chat-message"][data-agent="true"]')
        .filter({ hasText: replyToken })
      await expect(firstAgentMessage).toHaveCount(1, { timeout: 420_000 })
      await expect(secondAgentMessage).toHaveCount(1, { timeout: 30_000 })

      const timelineResponse = await first.page.request.get(
        `http://localhost:8008/_matrix/client/v3/rooms/${encodeURIComponent(room.matrixRoomId)}/messages?dir=b&limit=100`,
        { headers: { authorization: `Bearer ${first.bootstrap.matrix.accessToken}` } },
      )
      expect(timelineResponse.ok(), await timelineResponse.text()).toBeTruthy()
      const timeline = await timelineResponse.json()
      const mentionEvent = timeline.chunk.find((event: any) => event.content?.body === agentPrompt)
      const agentEvents = timeline.chunk.filter((event: any) =>
        event.type === 'm.room.message'
        && event.content?.body?.includes(replyToken)
        && event.content?.[agentMetadataKey]?.agentId === 'pi')
      expect(mentionEvent?.event_id).toBeTruthy()
      expect(agentEvents).toHaveLength(1)
      expect(agentEvents[0]).toMatchObject({
        sender: expect.stringMatching(/^@vibe_agent_pi_/),
        content: {
          'm.relates_to': { 'm.in_reply_to': { event_id: mentionEvent.event_id } },
          [agentMetadataKey]: {
            schemaVersion: 'vibechat.space-agent-message/v1',
            agentId: 'pi',
            sourceEventIds: expect.arrayContaining([mentionEvent.event_id]),
          },
        },
      })
      const agentMemberState = await first.page.request.get(
        `http://localhost:8008/_matrix/client/v3/rooms/${encodeURIComponent(room.matrixRoomId)}/state/m.room.member/${encodeURIComponent(agentEvents[0].sender)}`,
        { headers: { authorization: `Bearer ${first.bootstrap.matrix.accessToken}` } },
      )
      expect(agentMemberState.ok(), await agentMemberState.text()).toBeTruthy()
      await expect(agentMemberState.json()).resolves.toMatchObject({
        membership: 'join',
        [agentMemberMetadataKey]: {
          schemaVersion: 'vibechat.space-agent-member/v1',
          agentId: 'pi',
        },
      })

      await Promise.all([first.page.reload(), second.page.reload()])
      const [reloadedFirst, reloadedSecond] = await Promise.all([
        openAppChat(first.page),
        openAppChat(second.page),
      ])
      await expect(
        reloadedFirst.locator('[data-testid="chat-message"][data-agent="true"]').filter({ hasText: replyToken }),
      ).toHaveCount(1)
      await expect(
        reloadedSecond.locator('[data-testid="chat-message"][data-agent="true"]').filter({ hasText: replyToken }),
      ).toHaveCount(1)
      await reloadedFirst.getByTestId('message-input').fill('@')
      await expect(reloadedFirst.locator('#vcc-mentions [data-handle="pi"]')).toHaveCount(1)
      await expect(reloadedFirst.locator('#vcc-mentions [data-handle*="vibe_agent_"]')).toHaveCount(0)

      const afterResponse = await first.page.request.get(
        `/v1/spaces/instances/${encodeURIComponent(room.matrixRoomId)}`,
      )
      expect(afterResponse.ok(), await afterResponse.text()).toBeTruthy()
      const after = await afterResponse.json()
      expect(after.project.draftId).toBe(before.project.draftId)
      expect(after.project.releaseId).toBe(before.project.releaseId)
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })

  test('promotes a real Agent revision to both live App surfaces without publishing', async ({ browser }) => {
    test.skip(
      process.env.E2E_SPACE_AGENT_EXPECT_READY !== '1',
      'Requires a configured real Space Agent provider',
    )
    const fixture = await createCollaborationFixture(browser, 'Agent Revision')

    try {
      const before = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
      const marker = `REVISION_SYNC_${fixture.suffix.replaceAll('-', '_')}`
      const agentPrompt = [
        '@pi 请直接修改当前 Space App 的 `src/app/markup.ts`。',
        `把 \`appMarkup\` 改成不会遮挡聊天的 \`<aside data-testid="agent-revision-marker">${marker}</aside>\`。`,
        '保持现有 Chat Core 和其他文件能力不变，不要发布；完成后直接保存代码。',
      ].join('\n')

      await fixture.firstChat.getByTestId('message-input').fill(agentPrompt)
      await fixture.firstChat.getByTestId('send-message').click()

      await expect.poll(async () => {
        const snapshot = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
        if (snapshot.devPreview.state !== 'ready') return before.project.draftId
        return snapshot.project.draftId
      }, {
        message: 'the real Agent should produce and promote a ready Project revision',
        timeout: 420_000,
      }).not.toBe(before.project.draftId)

      const after = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
      expect(after.project.releaseId).toBe(before.project.releaseId)
      expect(after.devPreview.state).toBe('ready')
      expect(after.devPreview.version).toBe(after.project.draftId)

      const firstMarker = chatFrame(fixture.first.page).getByTestId('agent-revision-marker')
      const secondMarker = chatFrame(fixture.second.page).getByTestId('agent-revision-marker')
      await expect(firstMarker).toHaveText(marker, { timeout: 30_000 })
      await expect(secondMarker).toHaveText(marker, { timeout: 30_000 })

      const chatAfterRevision = `Chat after Agent revision ${fixture.suffix}`
      await fixture.secondChat.getByTestId('message-input').fill(chatAfterRevision)
      await fixture.secondChat.getByTestId('send-message').click()
      await expect(
        fixture.firstChat.getByTestId('message-body').filter({ hasText: chatAfterRevision }),
      ).toHaveCount(1)

      await Promise.all([fixture.first.page.reload(), fixture.second.page.reload()])
      const [reloadedFirst, reloadedSecond] = await Promise.all([
        openAppChat(fixture.first.page),
        openAppChat(fixture.second.page),
      ])
      await expect(chatFrame(fixture.first.page).getByTestId('agent-revision-marker')).toHaveText(marker)
      await expect(chatFrame(fixture.second.page).getByTestId('agent-revision-marker')).toHaveText(marker)
      await expect(
        reloadedFirst.getByTestId('message-body').filter({ hasText: chatAfterRevision }),
      ).toHaveCount(1)
      await expect(
        reloadedSecond.getByTestId('message-body').filter({ hasText: chatAfterRevision }),
      ).toHaveCount(1)

      const afterRefresh = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
      expect(afterRefresh.project.draftId).toBe(after.project.draftId)
      expect(afterRefresh.project.releaseId).toBe(before.project.releaseId)
    } finally {
      await fixture.close()
    }
  })

  test('keeps the previous ready App, Chat, and Release after a Candidate build failure', async ({ browser }) => {
    test.skip(
      process.env.E2E_SPACE_FAKE_AGENT_READY !== '1',
      'Requires SPACE_AGENT_FAKE_ENABLED=1 and E2E_SPACE_FAKE_AGENT_READY=1',
    )
    const fixture = await createCollaborationFixture(browser, 'Candidate Failure', 'fake')

    try {
      const before = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
      expect(before.defaultAgentId).toBe('fake')
      expect(before.availableAgents).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'fake', available: true }),
      ]))
      await expect(chatFrame(fixture.first.page).locator('#vcc-root')).toBeAttached()
      await expect(chatFrame(fixture.second.page).locator('#vcc-root')).toBeAttached()
      await fixture.firstChat.getByTestId('message-input').fill('@')
      await expect(fixture.firstChat.locator('#vcc-mentions [data-handle="fake"]')).toHaveCount(1)

      const failurePrompt = '@fake [fake:failure] verify deterministic Candidate isolation'
      await fixture.firstChat.getByTestId('message-input').fill(failurePrompt)
      const [turnResponse] = await Promise.all([
        fixture.first.page.waitForResponse((response) =>
          response.request().method() === 'POST'
          && new URL(response.url()).pathname.endsWith('/turns'),
        ),
        fixture.firstChat.getByTestId('send-message').click(),
      ])
      expect(turnResponse.status(), await turnResponse.text()).toBe(202)

      await expect.poll(async () => {
        const snapshot = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
        return snapshot.devPreview.state
      }, {
        message: 'the fake Agent Candidate should reach a deterministic failed build state',
        timeout: 120_000,
      }).toBe('failed')
      await expect.poll(async () => {
        const snapshot = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
        return snapshot.queue.activeCount === 0
          && snapshot.queue.pendingCount === 0
          && snapshot.build === null
      }, { timeout: 30_000 }).toBe(true)

      const afterFailure = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
      expect(afterFailure.project.draftId).toBe(before.project.draftId)
      expect(afterFailure.project.releaseId).toBe(before.project.releaseId)
      expect(afterFailure.project.summary).toBe(before.project.summary)
      await expect(chatFrame(fixture.first.page).locator('#vcc-root')).toBeAttached()
      await expect(chatFrame(fixture.second.page).locator('#vcc-root')).toBeAttached()
      await expect(fixture.firstChat.getByTestId('message-input')).toBeInViewport()
      await expect(fixture.secondChat.getByTestId('message-input')).toBeInViewport()

      const chatAfterFailure = `Chat after failed Candidate ${fixture.suffix}`
      await fixture.secondChat.getByTestId('message-input').fill(chatAfterFailure)
      await fixture.secondChat.getByTestId('send-message').click()
      await expect(
        fixture.firstChat.getByTestId('message-body').filter({ hasText: chatAfterFailure }),
      ).toHaveCount(1)

      await Promise.all([fixture.first.page.reload(), fixture.second.page.reload()])
      const [reloadedFirst, reloadedSecond] = await Promise.all([
        openAppChat(fixture.first.page),
        openAppChat(fixture.second.page),
      ])
      await expect(reloadedFirst.locator('#vcc-root')).toBeAttached()
      await expect(reloadedSecond.locator('#vcc-root')).toBeAttached()
      await expect(
        reloadedFirst.getByTestId('message-body').filter({ hasText: chatAfterFailure }),
      ).toHaveCount(1)
      await expect(
        reloadedSecond.getByTestId('message-body').filter({ hasText: chatAfterFailure }),
      ).toHaveCount(1)

      const afterRefresh = await readSpaceRuntime(fixture.first.page, fixture.room.matrixRoomId)
      expect(afterRefresh.project.draftId).toBe(before.project.draftId)
      expect(afterRefresh.project.releaseId).toBe(before.project.releaseId)
    } finally {
      await fixture.close()
    }
  })
})
