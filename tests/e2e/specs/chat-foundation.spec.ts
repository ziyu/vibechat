import { expect, test } from '@playwright/test'

const storageKey = 'vibechat-demo-state-v1'

test.describe('Vibe Chat foundation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/zh-CN/messages')
    await page.evaluate((key) => window.localStorage.removeItem(key), storageKey)
    await page.reload()
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
  })

  const waitForChatReady = async (page: import('@playwright/test').Page) => {
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
  }

  test('loads the host shell and filters the conversation list', async ({ page }) => {
    await page.goto('/zh-CN/messages')
    await waitForChatReady(page)

    await expect(page.getByTestId('chat-primary-nav')).toBeVisible()
    await expect(page.getByTestId('conversation-row')).toHaveCount(3)
    await expect(page.getByTestId('messages-overview')).toBeVisible()

    await page.getByTestId('conversation-search').fill('周四')
    await expect(page.getByTestId('conversation-row')).toHaveCount(1)
    await expect(page.getByTestId('conversation-row')).toContainText('周四小组')

    await page.getByTestId('conversation-search').fill('')
    await page.getByTestId('unread-filter').click()
    await expect(page.getByTestId('conversation-row')).toHaveCount(2)
  })

  test('sends, replies to, and reacts to room messages', async ({ page }) => {
    await page.goto('/zh-CN/rooms/room-afterglow')
    await waitForChatReady(page)

    await expect(page.getByTestId('atmosphere-canvas')).toBeVisible()
    await expect(page.getByTestId('room-control-island')).toBeVisible()
    await expect(page.getByTestId('chat-message')).toHaveCount(4)

    await page.getByTestId('message-input').fill('这一刻已经被好好保存。')
    await page.getByTestId('send-message').click()
    await expect(page.getByTestId('chat-message')).toHaveCount(5)
    await expect(page.getByTestId('chat-message').last()).toContainText('已发送')

    const firstMessage = page.getByTestId('chat-message').first()
    await firstMessage.hover()
    await firstMessage.getByRole('button', { name: '回复' }).click()
    await expect(page.getByTestId('reply-preview')).toContainText('林林')

    await page.getByTestId('message-input').fill('等天亮以后，再慢慢讲给我听。')
    await page.getByTestId('send-message').click()
    await expect(page.getByTestId('chat-message').last()).toContainText('刚刚路过一家还亮着灯的唱片店。')

    await firstMessage.hover()
    await firstMessage.getByRole('button', { name: '回应 ✨' }).click()
    await expect(firstMessage).toContainText('✨ 1')
  })

  test('creates a room by selecting people before an atmosphere', async ({ page }) => {
    await page.goto('/zh-CN/messages')
    await waitForChatReady(page)
    await page.getByTestId('new-chat-button').click()

    await page.getByRole('button', { name: /米拉 @mira/ }).click()
    await page.getByRole('button', { name: '下一页' }).click()
    await page.getByRole('button', { name: /苔原共创室/ }).click()
    await page.getByRole('button', { name: '下一页' }).click()

    await expect(page.getByTestId('new-chat-dialog')).toContainText('能力权限')
    await page.getByRole('button', { name: '创建房间' }).click()

    await expect(page).toHaveURL(/\/zh-CN\/rooms\/room-/)
    await expect(page.getByRole('heading', { level: 1, name: '米拉' })).toBeVisible()

    await page.reload()
    await waitForChatReady(page)
    await expect(page.getByRole('heading', { level: 1, name: '米拉' })).toBeVisible()
  })

  test('handles friend requests and explores atmosphere spaces', async ({ page }) => {
    await page.goto('/zh-CN/contacts')
    await waitForChatReady(page)
    await expect(page.getByTestId('friend-request')).toHaveCount(1)
    await page.getByRole('button', { name: '接受请求' }).click()
    await expect(page.getByTestId('friend-request')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /诺亚 @noah/ })).toBeVisible()

    await page.getByTestId('chat-primary-nav').getByRole('link', { name: '发现' }).click()
    await page.getByPlaceholder('搜索氛围或创作者').fill('像素')
    await expect(page.getByTestId('space-card')).toHaveCount(1)

    const spaceCard = page.getByTestId('space-card')
    await spaceCard.getByRole('link').click()
    await expect(page.getByTestId('space-detail')).toContainText('不连接外部域名')
    await page.getByRole('button', { name: '收藏' }).click()
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible()
  })

  test('uses bottom navigation on mobile and hides it inside rooms', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/zh-CN/messages')
    await waitForChatReady(page)

    await expect(page.locator('.vc-mobile-nav')).toBeVisible()
    await expect(page.getByTestId('chat-primary-nav')).toBeHidden()
    await expect(page.getByTestId('messages-overview')).toBeHidden()

    await page.getByTestId('conversation-row').first().getByRole('link').click()
    await expect(page).toHaveURL('/zh-CN/rooms/room-afterglow')
    await expect(page.locator('.vc-mobile-nav')).toBeHidden()
    await expect(page.getByTestId('room-control-island')).toBeVisible()
  })
})
