import { expect, test, type Page } from '@playwright/test'

import { renderDocument as renderCampfireDocument } from '../../../packages/space-templates/official/space-campfire/app/src/page'

const previewOrigin = 'http://space-template-user-directory.test'

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
const longNameMember = {
  id: "member-morgan",
  clientId: "morgan",
  name: "Morgan 夜航电台的超长多语言显示名称 Without Truncating Identity",
  displayName: "Morgan 夜航电台的超长多语言显示名称 Without Truncating Identity",
  handle: "morgan_with_a_long_radio_handle",
  initials: "M",
  avatarUrl: null,
  presence: "away",
};
const snapshot = {
  appId: "template-user-directory-preview",
  locale: "zh-CN",
  meta: {
    id: "template-user-directory-preview",
    name: "夜航电台",
    summary: "共享成员目录迁移验收。",
    icon: "V",
    accent: "#ff6b42",
  },
  self,
  members: [self, longNameMember],
  mentions: [{
    id: "wayfinder",
    handle: "wayfinder",
    name: "Wayfinder",
    initials: "W",
    type: "agent",
    available: true,
  }],
  messages: [],
  app: { revision: 0, state: {}, presence: [] },
  chat: {
    messages: [],
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
    id: "wayfinder",
    name: "Wayfinder",
    messages: [],
    build: null,
    queue: { activeCount: 0, pendingCount: 0 },
  },
};
const notify = (event) => {
  const value = event === "members" ? snapshot.members : snapshot[event];
  for (const listener of listeners.get(event) || []) listener(value);
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
  get members() { return snapshot.members; },
  get mentions() { return snapshot.mentions; },
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
  async updatePresence(value) {
    globalThis.__campfirePresenceUpdates.push(value);
  },
};
space.ready = Promise.resolve(space);
globalThis.__campfirePresenceUpdates = [];
globalThis.__setCampfireMembers = (members) => {
  snapshot.members = members;
  notify("members");
};
globalThis.__campfireMembers = { self, longNameMember };
`
}

async function openCampfireDocument(page: Page) {
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
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: renderCampfireDocument().replace(
        /<script type="module" data-vibechat-default-chat-app[\s\S]*?<\/script>/,
        '',
      ),
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await page.goto(previewOrigin)
  return browserErrors
}

test.describe('Campfire shared User Directory', () => {
  test('renders real SDK members through the shared controller and MemberList', async ({ page }) => {
    const browserErrors = await openCampfireDocument(page)
    const memberList = page.getByRole('listbox', { name: 'Space 成员' })
    const options = memberList.getByRole('option')

    // This source-level browser harness resolves the current workspace package.
    // Template exact-version/integrity pins are enforced by catalog and Registry tests.
    const componentScript = page.locator('script[data-vibechat-user-components]')
    await expect(componentScript).toHaveCount(1)
    await expect(componentScript).toHaveAttribute(
      'data-vibechat-user-components-integrity',
      /^sha256:/,
    )
    expect(browserErrors).toEqual([])
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toContainText('Alice')
    await expect(options.nth(0)).toContainText('在线')
    await expect(options.nth(1)).toContainText('Morgan 夜航电台的超长多语言显示名称')
    await expect(options.nth(1)).toContainText('@morgan_with_a_long_radio_handle')
    await expect(page.locator('#copy')).toContainText('2 位听众')
    await expect.poll(() => page.evaluate(
      () => (globalThis as typeof globalThis & {
        __campfirePresenceUpdates: unknown[]
      }).__campfirePresenceUpdates,
    )).toEqual([{ scene: 'radio', status: 'listening' }])

    await options.nth(0).focus()
    await page.keyboard.press('ArrowDown')
    await expect(options.nth(1)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(options.nth(0)).toBeFocused()

    await page.evaluate(() => {
      const preview = globalThis as typeof globalThis & {
        __setCampfireMembers(members: unknown[]): void
      }
      preview.__setCampfireMembers([])
    })
    await expect(page.getByText('暂无成员', { exact: true })).toBeVisible()
    await expect(page.locator('#copy')).toContainText('0 位听众')

    await page.evaluate(() => {
      const preview = globalThis as typeof globalThis & {
        __campfireMembers: { self: unknown; longNameMember: unknown }
        __setCampfireMembers(members: unknown[]): void
      }
      preview.__setCampfireMembers([
        preview.__campfireMembers.self,
        preview.__campfireMembers.longNameMember,
      ])
    })
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await expect(options).toHaveCount(2)
    await expect.poll(() => page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      animations: document.getAnimations({ subtree: true }).length,
    }))).toEqual({ clientWidth: 390, scrollWidth: 390, animations: 0 })
    await expect(page.locator('#members')).toBeInViewport()

    expect(browserErrors).toEqual([])
  })
})
