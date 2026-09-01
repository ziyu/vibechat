import { expect, test, type Page } from '@playwright/test'

import { renderDocument as renderDefaultDocument } from '../../../packages/space-templates/official/space-default/app/src/page'
import { renderDocument as renderFocusDocument } from '../../../packages/space-templates/official/space-focus/app/src/page'

const previewOrigin = 'http://space-template-author-card.test'
const memberName = 'Morgan 夜航电台的超长多语言显示名称 مورغان'

function renderMockSdkModule() {
  return `
const listeners = new Map();
const stateListeners = new Map();
const state = new Map();
const self = {
  id: "member-alice",
  clientId: "alice",
  name: "Alice",
  displayName: "Alice",
  handle: "alice",
  initials: "A",
  avatarUrl: null,
  presence: "online",
};
const member = {
  id: "member-morgan",
  clientId: "morgan",
  name: ${JSON.stringify(memberName)},
  displayName: ${JSON.stringify(memberName)},
  handle: "morgan_radio",
  initials: "M",
  avatarUrl: null,
  presence: "away",
};
const agentTarget = {
  id: "wayfinder",
  handle: "wayfinder",
  name: "Wayfinder",
  initials: "W",
  type: "agent",
  available: true,
};
const messages = [
  {
    id: "member-message",
    roomId: "author-card-room",
    senderId: member.id,
    text: "从夜航电台发来的成员消息。",
    createdAt: "2026-09-01T10:00:00.000Z",
    status: "sent",
    reactions: [],
  },
  {
    id: "agent-message",
    roomId: "author-card-room",
    senderId: "agent-matrix-user",
    agent: true,
    agentId: agentTarget.id,
    text: "路线已整理完成。",
    createdAt: "2026-09-01T10:01:00.000Z",
    status: "sent",
    reactions: [],
  },
  {
    id: "unknown-member-message",
    roomId: "author-card-room",
    senderId: "member-unknown",
    text: "身份资料尚未同步。",
    createdAt: "2026-09-01T10:02:00.000Z",
    status: "sent",
    reactions: [],
  },
];
const snapshot = {
  appId: "template-author-card-preview",
  locale: "zh-CN",
  meta: {
    id: "template-author-card-preview",
    name: "作者身份卡验收",
    summary: "共享 Chat 作者身份卡的 Template 验收。",
    icon: "V",
    accent: "#b7d66d",
  },
  self,
  members: [self, member],
  mentions: [agentTarget],
  messages,
  app: { revision: 0, state: {}, presence: [] },
  chat: {
    messages,
    typingMemberIds: [],
    permissions: {
      send: true,
      attach: true,
      reply: true,
      editOwn: true,
      deleteOwn: true,
      react: true,
      retryOwn: true,
      typing: true,
      markRead: true,
    },
  },
  agent: {
    id: agentTarget.id,
    name: agentTarget.name,
    messages: [],
    build: { status: "working", stage: "正在整理夜航路线" },
    queue: { activeCount: 1, pendingCount: 2 },
  },
};
const on = (event, listener) => {
  const handlers = listeners.get(event) || new Set();
  handlers.add(listener);
  listeners.set(event, handlers);
  return () => handlers.delete(listener);
};
const chat = {
  get messages() { return snapshot.chat.messages; },
  get typingMemberIds() { return snapshot.chat.typingMemberIds; },
  get permissions() { return snapshot.chat.permissions; },
  send: async () => undefined,
  edit: async () => undefined,
  delete: async () => undefined,
  toggleReaction: async () => undefined,
  retry: async () => undefined,
  attach: async () => undefined,
  markRead: async () => undefined,
  setTyping: async () => undefined,
};
export const space = {
  version: 1,
  ready: null,
  locale: "zh-CN",
  snapshot,
  self,
  members: snapshot.members,
  mentions: snapshot.mentions,
  meta: snapshot.meta,
  get agent() { return snapshot.agent; },
  chat,
  mention: {
    search(query = "") {
      const normalized = String(query).toLowerCase();
      return snapshot.mentions.filter((target) =>
        target.name.toLowerCase().includes(normalized)
        || target.handle.toLowerCase().includes(normalized));
    },
  },
  theme: {
    set(tokens) {
      for (const [name, value] of Object.entries(tokens)) {
        document.documentElement.style.setProperty(\`--space-\${name}\`, String(value));
      }
    },
  },
  state: {
    get(key) { return state.get(key); },
    async set(key, value) {
      state.set(key, value);
      for (const listener of stateListeners.get(key) || []) listener(value);
    },
    on(key, listener) {
      const handlers = stateListeners.get(key) || new Set();
      handlers.add(listener);
      stateListeners.set(key, handlers);
      return () => handlers.delete(listener);
    },
  },
  on,
  onEvent: on,
  emit: async () => undefined,
  updatePresence: async () => undefined,
};
space.ready = Promise.resolve(space);
`
}

async function openTemplateDocument(
  page: Page,
  html: string,
  mode: 'full' | 'dock',
) {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`))
  await page.route(`${previewOrigin}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/v1/space-app-sdk') {
      await route.fulfill({
        status: 200,
        contentType: 'text/javascript; charset=utf-8',
        body: renderMockSdkModule(),
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await page.goto(previewOrigin)

  const root = page.locator('#vcc-root')
  await expect(root).toHaveAttribute('data-mode', mode)
  if (mode === 'dock') await page.locator('#vcc-launch').click()
  await expect(root).toHaveAttribute('data-open', 'true')

  const timeline = page.getByTestId('message-timeline')
  const triggers = timeline.getByTestId('chat-author-trigger')
  await expect(triggers).toHaveCount(3)
  await expect(triggers.nth(0)).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false')
  await expect(triggers.nth(0)).toHaveAccessibleName(`查看${memberName}的资料`)
  await expect(triggers.nth(1)).toHaveAccessibleName('查看Wayfinder的资料')

  const card = timeline.getByTestId('chat-author-card')
  await expect(card).toHaveCount(1)
  await expect(card).toBeHidden()

  await triggers.nth(0).hover()
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-kind', 'member')
  await expect(card.locator('vc-space-user-info-card')).toHaveCount(1)
  await expect(card.locator('vc-space-agent-card')).toHaveCount(0)
  await expect(card).toContainText(memberName)
  await expect(card).toContainText('@morgan_radio')

  // Moving from the trigger into the shared top-layer card must not flash-close it.
  await card.hover()
  await page.waitForTimeout(180)
  await expect(card).toBeVisible()
  await page.getByTestId('message-input').hover()
  await expect(card).toBeHidden()
  await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false')

  await triggers.nth(0).focus()
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-pinned', 'false')
  await page.getByTestId('message-input').focus()
  await expect(card).toBeHidden()

  await triggers.nth(1).focus()
  await page.keyboard.press('Enter')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-kind', 'agent')
  await expect(card).toHaveAttribute('data-pinned', 'true')
  await expect(card.locator('vc-space-user-info-card')).toHaveCount(0)
  await expect(card.locator('vc-space-agent-card')).toHaveCount(1)
  await expect(card).toContainText('Wayfinder')
  await expect(card).toContainText('1 个进行中')
  await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
  await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => triggers.nth(1).evaluate((element) => (
    element.getRootNode() instanceof ShadowRoot
    && element.getRootNode().activeElement === element
  ))).toBe(true)

  await triggers.nth(1).click()
  await expect(card).toBeVisible()
  await page.getByTestId('message-input').click()
  await expect(card).toBeHidden()

  await triggers.nth(1).click()
  await expect(card).toBeVisible()
  await triggers.nth(1).click()
  await expect(card).toBeHidden()

  await triggers.nth(2).click()
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-kind', 'member')
  await expect(card.locator('vc-space-user-info-card')).toContainText('Member')
  await triggers.nth(2).click()
  await expect(card).toBeHidden()

  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await page.locator('html').evaluate((element) => element.setAttribute('dir', 'rtl'))
  await triggers.nth(0).click()
  await expect(card).toBeVisible()
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual({ clientWidth: 390, scrollWidth: 390 })
  await expect.poll(() => card.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: Math.round(rect.left) >= 0,
      right: Math.round(rect.right) <= window.innerWidth,
      animations: element.getAnimations({ subtree: true }).length,
    }
  })).toEqual({ left: true, right: true, animations: 0 })

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(card).toBeHidden()
  await triggers.nth(0).click()
  await expect(card).toBeVisible()
  await expect.poll(() => card.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: Math.round(rect.left) >= 0,
      right: Math.round(rect.right) <= window.innerWidth,
    }
  })).toEqual({ left: true, right: true })

  await timeline.locator('[part="viewport"]').dispatchEvent('scroll')
  await expect(card).toBeHidden()
  await timeline.evaluate((element) => {
    const target = element as HTMLElement & { messages: readonly unknown[] }
    target.messages = [...target.messages]
    target.messages = [...target.messages]
  })
  await expect(card).toHaveCount(1)
  await expect(triggers).toHaveCount(3)

  await triggers.nth(0).click()
  await expect(card).toBeVisible()
  await page.mouse.move(0, 0)
  await timeline.evaluate((element) => {
    const parent = element.parentNode
    const next = element.nextSibling
    element.remove()
    parent?.insertBefore(element, next)
    ;(element as HTMLElement & { state: 'ready' }).state = 'ready'
  })
  await expect(card).toBeHidden()
  await expect(card).toHaveCount(1)

  await triggers.nth(0).click()
  await expect(card).toBeVisible()
  await timeline.evaluate((element) => {
    const target = element as HTMLElement & {
      messages: ReadonlyArray<{ id: string }>
    }
    target.messages = target.messages.filter((message) => message.id !== 'member-message')
  })
  await expect(card).toBeHidden()
  await expect(triggers).toHaveCount(2)
  expect(browserErrors).toEqual([])
}

test.describe('Space Template Chat author cards', () => {
  test('uses one shared member/Agent card in Default full Chat', async ({ page }) => {
    await openTemplateDocument(page, renderDefaultDocument(), 'full')
  })

  test('keeps the same author-card contract in the Focus dock', async ({ page }) => {
    await openTemplateDocument(page, renderFocusDocument(), 'dock')
  })

  test('pins and dismisses the shared card from a touch tap', async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    await page.route(`${previewOrigin}/**`, async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/v1/space-app-sdk') {
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript; charset=utf-8',
          body: renderMockSdkModule(),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: renderDefaultDocument(),
      })
    })
    await page.goto(previewOrigin)

    const timeline = page.getByTestId('message-timeline')
    const trigger = timeline.getByTestId('chat-author-trigger').first()
    const card = timeline.getByTestId('chat-author-card')
    await expect(card).toBeHidden()
    await trigger.tap()
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-pinned', 'true')
    await page.getByTestId('message-input').tap()
    await expect(card).toBeHidden()
    await context.close()
  })
})
