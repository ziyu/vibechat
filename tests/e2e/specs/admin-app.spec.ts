import { expect, test } from '@playwright/test'
import { ADMIN_USER, TIMEOUTS, uniqueEmail } from '../helpers/constants'
import { signInViaAPI, signUpViaAPI } from '../helpers/auth'
import { setCommissionBalance } from '../helpers/affiliate'

const ADMIN_ORIGIN = process.env.ADMIN_E2E_ORIGIN || 'http://localhost:8005'
const WEB_ORIGIN = process.env.E2E_BASE_URL || 'http://localhost:8001'
const adminUrl = (path = '') => `${ADMIN_ORIGIN}/admin${path}`

test.describe('Independent Admin App', () => {
  test.describe.configure({ mode: 'serial' })

  test('fails closed for signed-out and normal users', async ({ browser }) => {
    const signedOutContext = await browser.newContext()
    const signedOutPage = await signedOutContext.newPage()
    await signedOutPage.goto(adminUrl(), { timeout: TIMEOUTS.navigation })
    await expect(signedOutPage).toHaveURL(/\/signin$/)
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
    await expect(normalPage).toHaveURL(/\/forbidden$/)
    await expect(normalPage.getByTestId('admin-forbidden')).toBeVisible()
    expect((await normalPage.request.get(`${ADMIN_ORIGIN}/api/admin/stats`)).status()).toBe(403)
    await normalContext.close()
  })

  test('admin reads every active operations domain', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const callbackURL = adminUrl()
    const signIn = await page.request.post(`${WEB_ORIGIN}/api/auth/sign-in/email`, {
      data: { ...ADMIN_USER, callbackURL },
      headers: { Origin: WEB_ORIGIN },
    })
    expect(
      signIn.ok(),
      `Admin callback sign-in failed (${signIn.status()}): ${await signIn.text()}`,
    ).toBeTruthy()

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
      const response = await page.request.get(`${ADMIN_ORIGIN}${endpoint}`, {
        maxRedirects: 0,
      })
      expect(response.status(), `${endpoint}: ${await response.text()}`).toBe(200)
      expect(
        response.headers()['content-type'],
        `${endpoint} must return JSON without redirecting to an Admin page`,
      ).toContain('application/json')
      await expect(response.json()).resolves.toBeDefined()
    }
    const invalidLedgerQuery = await page.request.get(
      `${ADMIN_ORIGIN}/api/admin/credits/transactions?limit=101`,
    )
    expect(invalidLedgerQuery.status()).toBe(400)

    const operationsPages = [
      { route: '/users', apiPath: '/api/admin/users' },
      { route: '/subscriptions', apiPath: '/api/admin/subscriptions' },
      { route: '/orders', apiPath: '/api/admin/orders' },
      { route: '/credits', apiPath: '/api/admin/credits/transactions' },
      { route: '/pricing', apiPath: '/api/admin/pricing-plans' },
      { route: '/blog', apiPath: '/api/admin/blog' },
      { route: '/commissions', apiPath: '/api/admin/commissions' },
      { route: '/withdrawals', apiPath: '/api/admin/withdrawals' },
    ]
    for (const { route, apiPath } of operationsPages) {
      const apiResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === 'GET' && url.pathname === apiPath
      })
      await page.goto(adminUrl(route), { timeout: TIMEOUTS.navigation })
      const apiResponse = await apiResponsePromise
      expect(apiResponse.status(), `${route} loaded ${apiPath} unsuccessfully`).toBe(200)
      expect(apiResponse.headers()['content-type']).toContain('application/json')
      await expect(apiResponse.json()).resolves.toBeDefined()
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
      data: { name: updatedName, kycVerified: true },
    })
    expect(patch.ok(), await patch.text()).toBeTruthy()
    const read = await adminPage.request.get(`${ADMIN_ORIGIN}/api/users/${createPayload.user.id}`)
    expect(read.ok(), await read.text()).toBeTruthy()
    expect(await read.json()).toMatchObject({ name: updatedName, kycVerified: true })

    await adminPage.goto(`${ADMIN_ORIGIN}/admin/users/${createPayload.user.id}`, { timeout: TIMEOUTS.navigation })
    await expect(adminPage.locator('#name')).toHaveValue(updatedName)
    const uiUpdate = adminPage.waitForResponse((response) => (
      response.url() === `${ADMIN_ORIGIN}/api/users/${createPayload.user.id}`
      && response.request().method() === 'PATCH'
    ))
    await adminPage.getByTestId('admin-user-save').click()
    expect((await uiUpdate).status()).toBe(200)

    const restore = await adminPage.request.patch(`${ADMIN_ORIGIN}/api/users/${createPayload.user.id}`, {
      data: { name: originalName, kycVerified: false },
    })
    expect(restore.ok(), await restore.text()).toBeTruthy()
    await adminContext.close()
  })

  test('admin persists blog and pricing CRUD operations', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const signIn = await signInViaAPI(page, ADMIN_USER)
    expect(signIn.ok(), await signIn.text()).toBeTruthy()

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const createdPost = await page.request.post(`${ADMIN_ORIGIN}/api/admin/blog`, {
      data: { title: `E2E Blog ${suffix}`, slug: `e2e-blog-${suffix}`, content: 'Initial', status: 'draft' },
    })
    expect(createdPost.ok(), await createdPost.text()).toBeTruthy()
    const post = await createdPost.json() as { id: string }
    const updatedPost = await page.request.patch(`${ADMIN_ORIGIN}/api/admin/blog/${post.id}`, {
      data: { title: `E2E Blog Updated ${suffix}`, status: 'published' },
    })
    expect(updatedPost.ok(), await updatedPost.text()).toBeTruthy()
    expect((await updatedPost.json() as { status: string }).status).toBe('published')
    const deletedPost = await page.request.delete(`${ADMIN_ORIGIN}/api/admin/blog/${post.id}`)
    expect(deletedPost.ok(), await deletedPost.text()).toBeTruthy()

    const createdPlan = await page.request.post(`${ADMIN_ORIGIN}/api/admin/pricing-plans`, {
      data: {
        provider: 'stripe', amount: 3.21, currency: 'USD', durationType: 'credits', credits: 33,
        i18n: { en: { name: `E2E Plan ${suffix}`, description: 'Created by active Admin E2E', features: ['One'] } },
      },
    })
    expect(createdPlan.ok(), await createdPlan.text()).toBeTruthy()
    const plan = (await createdPlan.json() as { plan: { id: string } }).plan
    const updatedPlan = await page.request.put(`${ADMIN_ORIGIN}/api/admin/pricing-plans`, {
      data: { id: plan.id, amount: 4.56, recommended: true },
    })
    expect(updatedPlan.ok(), await updatedPlan.text()).toBeTruthy()
    expect(Number((await updatedPlan.json() as { plan: { amount: string } }).plan.amount)).toBe(4.56)
    const deletedPlan = await page.request.delete(`${ADMIN_ORIGIN}/api/admin/pricing-plans?id=${encodeURIComponent(plan.id)}&hard=true`)
    expect(deletedPlan.ok(), await deletedPlan.text()).toBeTruthy()
    await context.close()
  })

  test('admin KYC review unlocks withdrawal and rejection refunds exactly once', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const adminSignIn = await signInViaAPI(adminPage, ADMIN_USER)
    expect(adminSignIn.ok(), await adminSignIn.text()).toBeTruthy()

    const email = uniqueEmail('withdrawal-lifecycle')
    const password = 'TestPassword123!'
    const create = await adminPage.request.post(`${ADMIN_ORIGIN}/api/auth/admin/create-user`, {
      data: { name: 'Withdrawal Lifecycle', email, password, role: 'user' },
      headers: { Origin: ADMIN_ORIGIN },
    })
    expect(create.ok(), await create.text()).toBeTruthy()
    const userId = (await create.json() as { user: { id: string } }).user.id
    await setCommissionBalance(userId, 150)

    const userContext = await browser.newContext()
    const userPage = await userContext.newPage()
    const userSignIn = await signInViaAPI(userPage, { email, password })
    expect(userSignIn.ok(), await userSignIn.text()).toBeTruthy()
    const requestId = `withdrawal:e2e-${Date.now()}`
    const requestBody = {
      amount: 100,
      paymentMethod: 'paypal',
      paymentAccount: 'withdrawal-e2e@example.com',
      requestId,
    }

    const beforeKyc = await userPage.request.post(`${WEB_ORIGIN}/api/withdrawal/request`, { data: requestBody })
    expect(beforeKyc.status()).toBe(400)
    expect(await beforeKyc.json()).toMatchObject({ error: 'KYC verification required' })

    const review = await adminPage.request.patch(`${ADMIN_ORIGIN}/api/users/${userId}`, {
      data: { kycVerified: true },
    })
    expect(review.ok(), await review.text()).toBeTruthy()

    const requested = await userPage.request.post(`${WEB_ORIGIN}/api/withdrawal/request`, { data: requestBody })
    expect(requested.ok(), await requested.text()).toBeTruthy()
    expect(await requested.json()).toMatchObject({ success: true, withdrawalId: requestId })
    const reservedStats = await userPage.request.get(`${WEB_ORIGIN}/api/affiliate/stats`)
    expect((await reservedStats.json() as { commissionBalance: number }).commissionBalance).toBe(50)

    const rejected = await adminPage.request.patch(`${ADMIN_ORIGIN}/api/admin/withdrawals/${encodeURIComponent(requestId)}`, {
      data: { status: 'rejected', adminNote: 'E2E lifecycle verification' },
    })
    expect(rejected.ok(), await rejected.text()).toBeTruthy()
    const repeated = await adminPage.request.patch(`${ADMIN_ORIGIN}/api/admin/withdrawals/${encodeURIComponent(requestId)}`, {
      data: { status: 'rejected', adminNote: 'Must not refund twice' },
    })
    expect(repeated.status()).toBe(400)

    const restoredStats = await userPage.request.get(`${WEB_ORIGIN}/api/affiliate/stats`)
    expect((await restoredStats.json() as { commissionBalance: number }).commissionBalance).toBe(150)
    const history = await userPage.request.get(`${WEB_ORIGIN}/api/withdrawal/history`)
    expect((await history.json() as { withdrawals: Array<{ id: string; status: string }> }).withdrawals)
      .toContainEqual(expect.objectContaining({ id: requestId, status: 'rejected' }))

    await userContext.close()
    await adminContext.close()
  })
})
