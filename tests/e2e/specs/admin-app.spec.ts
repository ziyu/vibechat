import { expect, test } from '@playwright/test'
import { ADMIN_USER, TIMEOUTS, uniqueEmail } from '../helpers/constants'
import { signInViaAPI, signUpViaAPI } from '../helpers/auth'

const ADMIN_ORIGIN = process.env.ADMIN_E2E_ORIGIN || 'http://localhost:8005'
const adminUrl = (path = '') => `${ADMIN_ORIGIN}/en/admin${path}`

test.describe('Independent Admin App', () => {
  test.describe.configure({ mode: 'serial' })

  test('fails closed for signed-out and normal users', async ({ browser }) => {
    const signedOutContext = await browser.newContext()
    const signedOutPage = await signedOutContext.newPage()
    await signedOutPage.goto(adminUrl(), { timeout: TIMEOUTS.navigation })
    await expect(signedOutPage).toHaveURL(/\/en\/signin$/)
    await expect(signedOutPage.getByRole('heading', {
      name: 'Administrator sign-in required',
    })).toBeVisible()
    expect((await signedOutPage.request.get(`${ADMIN_ORIGIN}/api/admin/stats`)).status()).toBe(401)
    await signedOutContext.close()

    const normalContext = await browser.newContext()
    const normalPage = await normalContext.newPage()
    const signup = await signUpViaAPI(normalPage, {
      name: 'Admin Boundary User',
      email: uniqueEmail('admin-boundary'),
      password: 'TestPassword123!',
    })
    expect(signup.ok(), await signup.text()).toBeTruthy()
    await normalPage.goto(adminUrl(), { timeout: TIMEOUTS.navigation })
    await expect(normalPage).toHaveURL(/\/en\/forbidden$/)
    await expect(normalPage.getByTestId('admin-forbidden')).toBeVisible()
    expect((await normalPage.request.get(`${ADMIN_ORIGIN}/api/admin/stats`)).status()).toBe(403)
    await normalContext.close()
  })

  test('admin reads every active operations domain', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const signIn = await signInViaAPI(page, ADMIN_USER)
    expect(signIn.ok(), await signIn.text()).toBeTruthy()

    await page.goto(adminUrl(), { timeout: TIMEOUTS.navigation })
    await expect(page.getByTestId('admin-shell')).toBeVisible()
    await expect(page.getByTestId('admin-dashboard')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()

    const endpoints = [
      '/api/admin/stats',
      '/api/admin/stats/monthly',
      '/api/admin/users?limit=10&offset=0',
      '/api/admin/subscriptions?limit=10&offset=0',
      '/api/admin/orders?limit=10&offset=0',
      '/api/admin/credits/transactions?limit=10&offset=0',
      '/api/admin/pricing-plans',
      '/api/admin/blog?limit=10&offset=0',
      '/api/admin/commissions?limit=10&offset=0',
      '/api/admin/withdrawals?limit=10&offset=0',
    ]
    for (const endpoint of endpoints) {
      const response = await page.request.get(`${ADMIN_ORIGIN}${endpoint}`)
      expect(response.status(), `${endpoint}: ${await response.text()}`).toBe(200)
    }
    const invalidLedgerQuery = await page.request.get(
      `${ADMIN_ORIGIN}/api/admin/credits/transactions?limit=101`,
    )
    expect(invalidLedgerQuery.status()).toBe(400)

    for (const route of ['/users', '/subscriptions', '/orders', '/credits', '/pricing', '/blog', '/commissions', '/withdrawals']) {
      await page.goto(adminUrl(route), { timeout: TIMEOUTS.navigation })
      await expect(page.locator('h1').first()).toBeVisible()
    }
    await context.close()
  })

  test('admin user mutation persists and can be restored', async ({ browser }) => {
    const originalName = 'Admin Mutation Target'
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const signIn = await signInViaAPI(adminPage, ADMIN_USER)
    expect(signIn.ok(), await signIn.text()).toBeTruthy()

    const create = await adminPage.request.post(`${ADMIN_ORIGIN}/api/auth/admin/create-user`, {
      data: {
        name: originalName,
        email: uniqueEmail('admin-mutation'),
        password: 'TestPassword123!',
        role: 'user',
      },
      headers: { Origin: ADMIN_ORIGIN },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const createPayload = await create.json() as { user: { id: string } }

    const updatedName = 'Admin Mutation Verified'
    const patch = await adminPage.request.patch(`${ADMIN_ORIGIN}/api/users/${createPayload.user.id}`, {
      data: { name: updatedName },
    })
    expect(patch.ok(), await patch.text()).toBeTruthy()
    const read = await adminPage.request.get(`${ADMIN_ORIGIN}/api/users/${createPayload.user.id}`)
    expect(read.ok(), await read.text()).toBeTruthy()
    expect((await read.json()).name).toBe(updatedName)

    const restore = await adminPage.request.patch(`${ADMIN_ORIGIN}/api/users/${createPayload.user.id}`, {
      data: { name: originalName },
    })
    expect(restore.ok(), await restore.text()).toBeTruthy()
    await adminContext.close()
  })
})
