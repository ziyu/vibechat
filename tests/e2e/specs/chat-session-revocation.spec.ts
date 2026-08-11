import { expect, test } from '@playwright/test'
import { signOutViaAPI, signUpViaAPI } from '../helpers/auth'

test.describe('Vibe Chat session revocation', () => {
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('sign-out revokes the bound Matrix device and product session', async ({ page }) => {
    const email = `e2e-matrix-revoke-${Date.now()}@example.com`
    const signUp = await signUpViaAPI(page, {
      name: 'Matrix Revoke E2E',
      email,
      password: 'VibeChat-e2e-password-2026!',
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()

    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap.matrix).toMatchObject({
      status: 'ready',
      homeserverUrl: 'http://localhost:8008',
      userId: expect.stringMatching(/^@vibe_.*:localhost$/),
      deviceId: expect.stringMatching(/^VIBE_[A-F0-9]{24}$/),
      accessToken: expect.any(String),
    })

    const whoami = await page.request.get(
      'http://localhost:8008/_matrix/client/v3/account/whoami',
      { headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` } },
    )
    expect(whoami.ok(), await whoami.text()).toBeTruthy()
    await expect(whoami.json()).resolves.toMatchObject({
      user_id: bootstrap.matrix.userId,
      device_id: bootstrap.matrix.deviceId,
    })

    const signOut = await signOutViaAPI(page)
    expect(signOut.ok(), await signOut.text()).toBeTruthy()

    const revokedWhoami = await page.request.get(
      'http://localhost:8008/_matrix/client/v3/account/whoami',
      { headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` } },
    )
    expect(revokedWhoami.status()).toBe(401)

    const unauthenticatedBootstrap = await page.request.get('/v1/session/bootstrap')
    expect(unauthenticatedBootstrap.status()).toBe(401)
    await expect(unauthenticatedBootstrap.json()).resolves.toMatchObject({
      error: { code: 'AUTH_SESSION_REQUIRED' },
    })
  })
})
