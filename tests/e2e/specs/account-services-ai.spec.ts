import { expect, test } from '@playwright/test'
import { createAndSignIn, signInViaAPI, signOutViaAPI, signUpViaAPI } from '../helpers/auth'
import { uniqueEmail } from '../helpers/constants'
import { seedCredits } from '../helpers/credits'
import { seedActiveSubscription } from '../helpers/subscription'

test.describe('Account, services, AI and payment return surfaces', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await createAndSignIn(page, {
      name: 'Product Services User',
      email: uniqueEmail('product-services'),
      password: 'TestPassword123!',
    })
  })

  test('loads account records and account security without Matrix runtime', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('product-app-shell')).toBeVisible()
    await expect(page.getByTestId('account-overview')).toBeVisible()
    await page.getByRole('button', { name: 'Security' }).click()
    await expect(page.getByTestId('account-security')).toBeVisible()
    await expect(page.getByText('Linked sign-in methods')).toBeVisible()
    await expect(page.getByText('Email & Password')).toBeVisible()
  })

  test('grants the configured welcome credits exactly once at signup', async ({ page }) => {
    const status = await page.request.get('/api/credits/status')
    expect(status.ok()).toBeTruthy()
    expect((await status.json() as { credits: { balance: number; totalPurchased: number } }).credits)
      .toMatchObject({ balance: 1000, totalPurchased: 1000 })

    const ledger = await page.request.get('/api/credits/transactions?page=1&limit=20')
    const transactions = (await ledger.json() as {
      transactions: Array<{ type: string; amount: string; description: string }>
    }).transactions
    const welcomeGrants = transactions.filter((transaction) =>
      transaction.type === 'bonus' && transaction.description === 'new_user_bonus'
    )
    expect(welcomeGrants).toHaveLength(1)
    expect(welcomeGrants[0]).toMatchObject({ type: 'bonus', amount: '1000', description: 'new_user_bonus' })
  })

  test('loads pricing and all three real AI product surfaces', async ({ page }) => {
    await page.goto('/services')
    await expect(page.getByTestId('pricing-plans')).toBeVisible()
    await expect(page.getByTestId('ai-tools')).toBeVisible()

    await page.goto('/ai')
    await expect(page.getByTestId('ai-chat-page')).toBeVisible()
    await expect(page.getByPlaceholder('What can I help you with?')).toBeVisible()

    await page.goto('/image-generate')
    await expect(page.getByTestId('image-generation-page')).toBeVisible()
    await expect(page.getByPlaceholder('Describe the image you want to generate...')).toBeVisible()

    await page.goto('/video-generate')
    await expect(page.getByTestId('video-generation-page')).toBeVisible()
    await expect(page.getByPlaceholder('Describe the video you want to generate...')).toBeVisible()
  })

  test('enforces and unlocks premium access from the persisted entitlement', async ({ page }) => {
    const session = await page.request.get('/api/auth/get-session')
    const userId = (await session.json() as { user: { id: string } }).user.id

    await page.goto('/premium-features')
    await expect(page).toHaveURL(/\/services$/)

    await seedActiveSubscription(userId)
    const subscriptionResponse = await page.request.get('/api/subscription/status')
    const subscriptionPayload = await subscriptionResponse.json() as {
      subscription: Record<string, unknown> | null
    }
    expect(subscriptionPayload.subscription).toBeTruthy()
    expect(subscriptionPayload.subscription).not.toHaveProperty('stripeCustomerId')
    expect(subscriptionPayload.subscription).not.toHaveProperty('stripeSubscriptionId')
    expect(subscriptionPayload.subscription).not.toHaveProperty('metadata')
    await page.goto('/premium-features')
    await expect(page.getByTestId('premium-features-page')).toBeVisible()
  })

  test('validates uploads and never fabricates a successful provider result', async ({ page }) => {
    const invalid = await page.request.post('/api/upload', {
      multipart: {
        provider: 'r2',
        file: { name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') },
      },
    })
    expect(invalid.status()).toBe(400)
    expect(await invalid.json()).toMatchObject({ error: 'Invalid file type. Only images are allowed' })

    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const providerResult = await page.request.post('/api/upload', {
      multipart: {
        provider: 'r2',
        file: { name: 'one-pixel.png', mimeType: 'image/png', buffer: onePixelPng },
      },
    })
    if (providerResult.ok()) {
      expect(await providerResult.json()).toMatchObject({
        success: true,
        data: { provider: 'r2', contentType: 'image/png', originalName: 'one-pixel.png' },
      })
    } else {
      expect(providerResult.status()).toBe(503)
      expect(await providerResult.json()).toEqual({ error: 'Storage provider is unavailable' })
    }
  })

  test('settles or refunds image credits against the real provider result', async ({ page }) => {
    const session = await page.request.get('/api/auth/get-session')
    const payload = await session.json() as { user: { id: string } }
    await seedCredits(payload.user.id, 100)

    const before = await page.request.get('/api/credits/status')
    const beforeCredits = (await before.json() as { credits: { balance: number } }).credits.balance
    const ledger = await page.request.get('/api/credits/transactions')
    const ledgerPayload = await ledger.json() as { transactions: Array<Record<string, unknown>> }
    expect(ledgerPayload.transactions[0]).not.toHaveProperty('userId')
    expect(ledgerPayload.transactions[0]).not.toHaveProperty('metadata')
    const response = await page.request.post('/api/image-generate', {
      data: {
        requestId: `image:e2e-${Date.now()}`,
        provider: 'qwen',
        model: 'qwen-image-plus',
        prompt: 'A red circle on a white background',
        size: '1328*1328',
      },
    })
    const after = await page.request.get('/api/credits/status')
    const afterCredits = (await after.json() as { credits: { balance: number } }).credits.balance
    if (response.ok()) {
      const generated = await response.json() as { success: boolean; data?: { imageUrl?: string }; credits: { consumed: number } }
      expect(generated.success).toBe(true)
      expect(generated.data?.imageUrl).toMatch(/^https?:\/\//)
      expect(generated.credits.consumed).toBeGreaterThan(0)
      expect(afterCredits).toBe(beforeCredits - generated.credits.consumed)
    } else {
      expect(response.status()).toBe(500)
      expect(afterCredits).toBe(beforeCredits)
    }
  })

  test('settles or refunds chat credits against the real provider stream', async ({ page }) => {
    const session = await page.request.get('/api/auth/get-session')
    const payload = await session.json() as { user: { id: string } }
    await seedCredits(payload.user.id, 100)
    const beforeResponse = await page.request.get('/api/credits/status')
    const beforeCredits = (await beforeResponse.json() as { credits: { balance: number } }).credits.balance

    let completedResponse: Awaited<ReturnType<typeof page.request.post>> | null = null
    let streamAborted = false
    try {
      completedResponse = await page.request.post('/api/chat', {
        data: {
          requestId: `chat:e2e-${Date.now()}`,
          provider: 'qwen',
          model: 'qwen-turbo',
          messages: [{ id: 'message-e2e', role: 'user', parts: [{ type: 'text', text: 'Reply with the single word hello.' }] }],
        },
      })
      await completedResponse.body()
    } catch (error) {
      streamAborted = /aborted/i.test(error instanceof Error ? error.message : String(error))
    }

    let afterCredits = beforeCredits
    await expect.poll(async () => {
      const afterResponse = await page.request.get('/api/credits/status')
      afterCredits = (await afterResponse.json() as { credits: { balance: number } }).credits.balance
      return completedResponse?.ok() && !streamAborted ? afterCredits < beforeCredits : afterCredits === beforeCredits
    }).toBe(true)
    if (completedResponse?.ok() && !streamAborted) expect(afterCredits).toBeLessThan(beforeCredits)
    else expect(streamAborted || completedResponse?.status() === 500).toBe(true)
  })

  test('persists failed video tasks and refunds the reservation exactly once', async ({ page }) => {
    const session = await page.request.get('/api/auth/get-session')
    const payload = await session.json() as { user: { id: string } }
    await seedCredits(payload.user.id, 100)
    const beforeResponse = await page.request.get('/api/credits/status')
    const beforeCredits = (await beforeResponse.json() as { credits: { balance: number } }).credits.balance
    const requestId = `video:e2e-${Date.now()}`

    const first = await page.request.post('/api/video-generate', {
      data: {
        requestId,
        provider: 'fal',
        model: 'kling-video/v2.5-turbo/pro/text-to-video',
        prompt: 'A still red circle on a white background',
        aspectRatio: '16:9',
        duration: 5,
      },
    })
    const afterFirstResponse = await page.request.get('/api/credits/status')
    const afterFirstCredits = (await afterFirstResponse.json() as { credits: { balance: number } }).credits.balance
    if (first.ok()) {
      const generated = await first.json() as { data: { videoUrl?: string }; credits: { consumed: number } }
      expect(generated.data.videoUrl).toMatch(/^https?:\/\//)
      expect(afterFirstCredits).toBe(beforeCredits - generated.credits.consumed)
    } else {
      expect(first.status()).toBe(500)
      expect(afterFirstCredits).toBe(beforeCredits)
      const repeated = await page.request.post('/api/video-generate', {
        data: {
          requestId,
          provider: 'fal',
          model: 'kling-video/v2.5-turbo/pro/text-to-video',
          prompt: 'A still red circle on a white background',
          aspectRatio: '16:9',
          duration: 5,
        },
      })
      expect(repeated.status()).toBe(409)
      expect(await repeated.json()).toMatchObject({ error: 'generation_failed' })
      const afterRepeatResponse = await page.request.get('/api/credits/status')
      expect((await afterRepeatResponse.json() as { credits: { balance: number } }).credits.balance).toBe(beforeCredits)
    }
  })

  test('preserves provider query strings through unlocalized payment returns', async ({ page }) => {
    await page.goto('/payment-success?provider=stripe&session_id=missing')
    await expect(page).toHaveURL(/\/payment-success\?provider=stripe&session_id=missing/)
    await expect(page.getByTestId('payment-success-page')).toBeVisible()

    await page.goto('/payment-cancel?provider=paypal')
    await expect(page).toHaveURL(/\/payment-cancel\?provider=paypal/)
    await expect(page.getByTestId('payment-cancel-page')).toBeVisible()
  })

  test('terminates a failed checkout and keeps the request idempotent', async ({ page }) => {
    const requestId = `payment:e2e-${Date.now()}`
    const first = await page.request.post('/api/payment/initiate', {
      data: { planId: 'monthly', provider: 'stripe', requestId },
    })
    expect(first.status()).toBe(503)
    expect(await first.json()).toMatchObject({ error: 'checkout_unavailable' })

    const repeated = await page.request.post('/api/payment/initiate', {
      data: { planId: 'monthly', provider: 'stripe', requestId },
    })
    expect(repeated.status()).toBe(409)
    expect(await repeated.json()).toMatchObject({ error: 'checkout_failed' })

    const orders = await page.request.get('/api/orders?page=1&limit=100')
    const body = await orders.json() as { orders: Array<{ id: string; status: string; metadata?: unknown }> }
    expect(body.orders.filter((order) => order.id === requestId)).toHaveLength(1)
    expect(body.orders.find((order) => order.id === requestId)).toMatchObject({ id: requestId, status: 'failed' })
    expect(body.orders.find((order) => order.id === requestId)).not.toHaveProperty('metadata')
  })

  test('changes the password from account security and re-authenticates', async ({ page }) => {
    const originalPassword = 'TestPassword123!'
    const nextPassword = 'ChangedPassword123!'
    const session = await page.request.get('/api/auth/get-session')
    const email = (await session.json() as { user: { email: string } }).user.email

    await page.goto('/account')
    await expect(page.getByTestId('account-overview')).toBeVisible()
    await page.getByRole('button', { name: 'Security' }).click()
    await expect(page.getByTestId('account-security')).toBeVisible()
    await page.getByTestId('security-current-password').fill(originalPassword)
    await page.getByTestId('security-new-password').fill(nextPassword)
    await page.getByTestId('security-confirm-password').fill(nextPassword)
    await page.getByTestId('security-change-password').click()
    await expect(page.getByText('Password updated. Other browser sessions were revoked.')).toBeVisible()
    await signOutViaAPI(page)
    expect((await signInViaAPI(page, { email, password: nextPassword })).ok()).toBeTruthy()
  })

  test('captures a referral landing and grants both signup bonuses once', async ({ page }) => {
    const referrerSession = await page.request.get('/api/auth/get-session')
    const referrer = (await referrerSession.json() as { user: { id: string; email: string } }).user
    const stats = await page.request.get('/api/affiliate/stats')
    const statsPayload = await stats.json() as { referralCode: string; enabled: boolean }
    expect(statsPayload.enabled).toBe(true)
    const referralCode = statsPayload.referralCode
    const beforeReferrerCreditsResponse = await page.request.get('/api/credits/status')
    const beforeReferrerCredits = (await beforeReferrerCreditsResponse.json() as { credits: { balance: number } }).credits.balance

    await signOutViaAPI(page)
    await page.goto(`/referral/${referralCode}`)
    await expect(page).toHaveURL(new RegExp(`/signup\\?ref=${referralCode}`))
    await expect.poll(async () => (await page.context().cookies())
      .some((cookie) => cookie.name === 'referral_code' && cookie.value === referralCode)).toBe(true)

    const refereeEmail = uniqueEmail('referee')
    const signup = await signUpViaAPI(page, { name: 'Referral E2E', email: refereeEmail, password: 'TestPassword123!' })
    const signupPayload = await signup.json().catch(() => null) as { user?: { id: string }; message?: string } | null
    expect(signup.ok(), JSON.stringify(signupPayload)).toBeTruthy()
    expect(signupPayload?.user?.id).toBeTruthy()
    const claim = await page.request.post('/api/affiliate/claim')
    const claimPayload = await claim.json().catch(() => null)
    expect(claim.ok(), JSON.stringify(claimPayload)).toBeTruthy()
    expect(claimPayload).toMatchObject({ applied: true, bonusGranted: true })

    const repeated = await page.request.post('/api/affiliate/claim')
    expect(repeated.ok()).toBeTruthy()
    expect(await repeated.json()).toMatchObject({ applied: false, reason: 'no_referral_code' })
    const refereeCredits = await page.request.get('/api/credits/status')
    expect((await refereeCredits.json() as { credits: { balance: number } }).credits.balance).toBe(110)

    await signOutViaAPI(page)
    expect((await signInViaAPI(page, { email: referrer.email, password: 'TestPassword123!' })).ok()).toBeTruthy()
    const referrerCredits = await page.request.get('/api/credits/status')
    expect((await referrerCredits.json() as { credits: { balance: number } }).credits.balance).toBe(beforeReferrerCredits + 10)
    const updatedStats = await page.request.get('/api/affiliate/stats')
    expect(await updatedStats.json()).toMatchObject({ totalRegisteredReferrals: 1 })
  })

  test('deletes an eligible account through the real security flow', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('account-overview')).toBeVisible()
    await page.getByRole('button', { name: 'Security' }).click()
    await expect(page.getByTestId('account-security')).toBeVisible()
    await page.getByTestId('security-delete-phrase').fill('DELETE')
    await page.getByTestId('security-delete-password').fill('TestPassword123!')
    await page.getByTestId('security-delete-account').click()
    await expect(page).toHaveURL(/\/(?:signin|login)$/)
    const session = await page.request.get('/api/auth/get-session')
    expect(await session.json()).toBeNull()
  })
})
