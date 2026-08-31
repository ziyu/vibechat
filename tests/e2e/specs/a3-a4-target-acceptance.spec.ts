import { expect, test, type Page } from '@playwright/test'

const enabled = process.env.RUN_A3_A4_TARGET_ACCEPTANCE === '1'
const roomId = process.env.A34_MATRIX_ROOM_ID || ''
const agentId = process.env.A34_CLAUDE_AGENT_ID || 'claude'

function chatFrame(page: Page) {
  return page.frameLocator('[data-testid="space-app-surface"] iframe')
}

async function openAppChat(page: Page) {
  const frame = chatFrame(page)
  const input = frame.getByTestId('message-input')
  const root = frame.locator('#vcc-root')
  await input.waitFor({ state: 'attached', timeout: 60_000 })
  if (await root.getAttribute('data-open') !== 'true') {
    await frame.getByRole('button', { name: 'Open Space Chat' }).click({ force: true })
  }
  await expect(root).toHaveAttribute('data-open', 'true')
  return frame
}

async function signIn(page: Page, emailVariable: string, passwordVariable: string) {
  const email = required(emailVariable)
  const password = required(passwordVariable)
  const response = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

async function snapshot(page: Page) {
  const response = await page.request.get(
    `/v1/spaces/instances/${encodeURIComponent(roomId)}`,
  )
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

test.describe('A3/A4 target Claude collaboration and Revision recovery', () => {
  test.skip(!enabled, 'Run through pnpm test:a3-a4:target with target environment credentials')
  test.setTimeout(600_000)

  test('keeps two Matrix members converged through real Claude Conversation and Revision', async ({ browser }) => {
    if (!roomId) throw new Error('A34_MATRIX_ROOM_ID is required')
    const firstContext = await browser.newContext({
      baseURL: required('A34_WEB_ORIGIN'),
    })
    const secondContext = await browser.newContext({
      baseURL: required('A34_WEB_ORIGIN'),
    })
    try {
      const first = await firstContext.newPage()
      const second = await secondContext.newPage()
      await Promise.all([
        signIn(first, 'A34_USER_A_EMAIL', 'A34_USER_A_PASSWORD'),
        signIn(second, 'A34_USER_B_EMAIL', 'A34_USER_B_PASSWORD'),
      ])
      await Promise.all([
        first.goto(`/spaces/${encodeURIComponent(roomId)}`),
        second.goto(`/spaces/${encodeURIComponent(roomId)}`),
      ])
      const [firstChat, secondChat] = await Promise.all([
        openAppChat(first),
        openAppChat(second),
      ])
      const before = await snapshot(first)
      expect(before.agents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          binding: expect.objectContaining({ agentId, status: 'active' }),
          definition: expect.objectContaining({
            agentId,
            adapterKey: 'claude-code',
            availability: 'available',
          }),
        }),
      ]))

      const conversationToken = `A34_CLAUDE_CONVERSATION_${Date.now()}`
      await firstChat.getByTestId('message-input').fill(
        `@${agentId} 请只回复 ${conversationToken}，不要修改任何 App 文件。`,
      )
      await firstChat.getByTestId('send-message').click()
      const firstReply = firstChat.locator('[data-testid="chat-message"][data-agent="true"]')
        .filter({ hasText: conversationToken })
      const secondReply = secondChat.locator('[data-testid="chat-message"][data-agent="true"]')
        .filter({ hasText: conversationToken })
      await expect(firstReply).toHaveCount(1, { timeout: 420_000 })
      await expect(secondReply).toHaveCount(1, { timeout: 30_000 })
      const afterConversation = await snapshot(first)
      expect(afterConversation.project.draftId).toBe(before.project.draftId)
      expect(afterConversation.project.releaseId).toBe(before.project.releaseId)

      const revisionToken = `A34_CLAUDE_REVISION_${Date.now()}`
      await firstChat.getByTestId('message-input').fill([
        `@${agentId} 请修改当前 Space App 的 src/app/markup.ts。`,
        `在 appMarkup 中追加 <aside data-testid="a34-claude-revision-marker">${revisionToken}</aside>。`,
        '保持 Chat Core、现有交互和其他文件能力不变，不要发布。',
      ].join('\n'))
      await firstChat.getByTestId('send-message').click()
      await expect.poll(async () => {
        const current = await snapshot(first)
        return current.devPreview.state === 'ready'
          ? current.project.draftId
          : before.project.draftId
      }, {
        message: 'Claude should promote a new ready Revision',
        timeout: 420_000,
      }).not.toBe(before.project.draftId)

      await expect(chatFrame(first).getByTestId('a34-claude-revision-marker'))
        .toHaveText(revisionToken, { timeout: 60_000 })
      await expect(chatFrame(second).getByTestId('a34-claude-revision-marker'))
        .toHaveText(revisionToken, { timeout: 60_000 })
      const afterRevision = await snapshot(first)
      expect(afterRevision.project.releaseId).toBe(before.project.releaseId)
      expect(afterRevision.devPreview.version).toBe(afterRevision.project.draftId)

      await Promise.all([first.reload(), second.reload()])
      await Promise.all([openAppChat(first), openAppChat(second)])
      await expect(chatFrame(first).getByTestId('a34-claude-revision-marker'))
        .toHaveText(revisionToken)
      await expect(chatFrame(second).getByTestId('a34-claude-revision-marker'))
        .toHaveText(revisionToken)
      await expect(chatFrame(first).locator('[data-testid="chat-message"][data-agent="true"]')
        .filter({ hasText: conversationToken })).toHaveCount(1)
      await expect(chatFrame(second).locator('[data-testid="chat-message"][data-agent="true"]')
        .filter({ hasText: conversationToken })).toHaveCount(1)
    } finally {
      await Promise.all([firstContext.close(), secondContext.close()])
    }
  })
})

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for A3/A4 target acceptance`)
  return value
}
