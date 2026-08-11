import { expect, test } from '@playwright/test'

test.describe('Vibe Chat Email OTP and session bootstrap', () => {
  test('rejects unauthenticated bootstrap requests with the product error contract', async ({
    request,
  }) => {
    const response = await request.get('/v1/session/bootstrap')
    expect(response.status()).toBe(401)

    const body = await response.json()
    expect(body).toMatchObject({
      error: {
        code: 'AUTH_SESSION_REQUIRED',
        details: {},
      },
    })
    expect(body.error.requestId).toEqual(expect.any(String))
  })

  test('signs in with Email OTP and bootstraps the authenticated product session', async ({
    page,
  }) => {
    const email = `e2e-chat-otp-${Date.now()}@example.com`
    await page.goto('/zh-CN/signin')

    await expect(page.getByTestId('signin-card')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('email-otp-request-form')).toBeVisible()
    await expect(page.getByRole('button', { name: '使用密码登录' })).toBeVisible()

    await page.locator('#otp-email').fill(email)
    const sendResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/auth/email-otp/send-verification-otp'),
    )
    await page.getByRole('button', { name: '发送验证码' }).click()

    const sendResponse = await sendResponsePromise
    expect(sendResponse.ok()).toBeTruthy()
    const sendBody = await sendResponse.json()
    expect(sendBody.dev?.otpCode).toMatch(/^\d{6}$/)

    await expect(page.getByTestId('email-otp-verify-form')).toBeVisible()
    await page.locator('#otp-code').fill(sendBody.dev.otpCode)
    await page.getByRole('button', { name: '继续' }).click()
    await expect(page).toHaveURL(/\/zh-CN\/messages$/)

    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap).toMatchObject({
      contractVersion: 1,
      user: {
        email,
      },
      matrix: {
        status: 'unavailable',
        reason: 'SYNAPSE_NOT_CONFIGURED',
      },
    })
    expect(bootstrap.user.id).toEqual(expect.any(String))
    expect(bootstrap.user.displayName).toBe(email.split('@')[0])
    expect(JSON.stringify(bootstrap)).not.toContain('accessToken')
  })

  test('keeps password sign-in available during the migration', async ({ page }) => {
    await page.goto('/en/signin')
    await expect(page.getByTestId('signin-card')).toHaveAttribute('data-ready', 'true')
    await page.getByRole('button', { name: 'Use password instead' }).click()

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use email code instead' })).toBeVisible()
  })
})
