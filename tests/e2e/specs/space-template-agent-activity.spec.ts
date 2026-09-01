import { expect, test, type Page } from '@playwright/test'

import { renderDocument as renderDefaultDocument } from '../../../packages/space-templates/official/space-default/app/src/page'
import { renderDocument as renderFocusDocument } from '../../../packages/space-templates/official/space-focus/app/src/page'

const previewOrigin = 'http://space-template-agent.test'

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
};
const agentTarget = {
  id: "wayfinder",
  handle: "wayfinder",
  name: "Wayfinder",
  initials: "W",
  type: "agent",
  available: true,
};
const snapshot = {
  appId: "template-agent-preview",
  locale: "zh-CN",
  meta: {
    id: "template-agent-preview",
    name: "Agent Activity Preview",
    summary: "共享 Chat 与 Agent activity 的迁移验收。",
    icon: "V",
    accent: "#b7d66d",
  },
  self,
  members: [self],
  mentions: [agentTarget],
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
  for (const listener of listeners.get(event) || []) listener(snapshot[event]);
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
setTimeout(() => {
  snapshot.agent = {
    id: "wayfinder",
    name: "Wayfinder",
    messages: [],
    build: {
      stage: "正在整理一段足够长的沿河路线活动说明，以验证窄屏自然换行",
      activities: [
        { id: "read-map", label: "读取共享路线图", status: "completed" },
        { id: "mark-route", label: "标记低噪音路径", detail: "保留 Alice 作为来源", status: "active" },
      ],
    },
    queue: { activeCount: 1, pendingCount: 2 },
  };
  notify("agent");
}, 500);
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
  const activity = page.getByTestId('agent-activity')
  await expect(root).toHaveAttribute('data-mode', mode)
  await expect(activity).toHaveAttribute('hidden', '')
  if (mode === 'dock') await page.locator('#vcc-launch').click()

  // This source-level browser harness resolves the current workspace package.
  // Template exact-version/integrity pins are enforced by catalog and Registry tests.
  const componentScript = page.locator('script[data-vibechat-components]')
  await expect(componentScript).toHaveCount(1)
  await expect(componentScript).toHaveAttribute(
    'data-vibechat-components-integrity',
    /^sha256:/,
  )
  await expect(page.locator('#vcc-build')).toHaveCount(0)
  await expect(activity).toBeVisible()
  await expect(activity).not.toHaveAttribute('hidden', '')
  await expect(activity).toHaveAttribute('role', 'group')
  await expect(activity.locator('[part="stage"]')).toContainText('正在整理一段足够长的沿河路线活动说明')
  await expect(activity.locator('[part="activity"]')).toHaveCount(2)
  await expect(activity.locator('[part="live"]')).toHaveAttribute('aria-live', 'polite')
  await expect(activity.locator('vc-space-agent-queue-status').locator('[part="label"]'))
    .toHaveText('1 个进行中 · 2 个等待中')

  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual({ clientWidth: 390, scrollWidth: 390 })
  await expect.poll(() => activity.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: Math.round(rect.left) >= 0,
      right: Math.round(rect.right) <= window.innerWidth,
      animations: element.getAnimations({ subtree: true }).length,
    }
  })).toEqual({ left: true, right: true, animations: 0 })
  await expect(page.getByTestId('message-input')).toBeInViewport()
  expect(browserErrors).toEqual([])
}

test.describe('Space Template Agent activity recipe', () => {
  test('renders the shared Agent activity in Default full Chat', async ({ page }) => {
    await openTemplateDocument(page, renderDefaultDocument(), 'full')
  })

  test('renders the shared Agent activity in the Focus dock', async ({ page }) => {
    await openTemplateDocument(page, renderFocusDocument(), 'dock')
  })
})
