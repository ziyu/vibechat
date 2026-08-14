import { expect, test } from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'

const password = 'VibeChat-e2e-password-2026!'

test.describe('Vibe Chat profile onboarding and contact remarks', () => {
  test.setTimeout(120_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('guards first setup and keeps contact remarks private', async ({ browser }) => {
    const suffix = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`
    const firstContext = await browser.newContext()
    const secondContext = await browser.newContext()
    const firstPage = await firstContext.newPage()
    const secondPage = await secondContext.newPage()

    try {
      const firstEmail = `e2e-profile-a-${suffix}@example.com`
      const secondEmail = `e2e-profile-b-${suffix}@example.com`
      const firstSignUp = await signUpViaAPI(firstPage, {
        name: 'Profile Alice',
        email: firstEmail,
        password,
      })
      expect(firstSignUp.ok(), await firstSignUp.text()).toBeTruthy()

      const invalidProfile = await firstPage.request.patch('/v1/profile', {
        data: { username: 'Not Valid!' },
      })
      expect(invalidProfile.status()).toBe(400)
      await expect(invalidProfile.json()).resolves.toMatchObject({
        error: { code: 'PROFILE_REQUEST_INVALID' },
      })

      await firstPage.goto('/zh-CN/messages')
      await expect(firstPage).toHaveURL(/\/zh-CN\/onboarding$/)
      await expect(firstPage.getByTestId('onboarding-page')).toBeVisible()

      const secondSignUp = await signUpViaAPI(secondPage, {
        name: 'Profile Bob',
        email: secondEmail,
        password,
      })
      expect(secondSignUp.ok(), await secondSignUp.text()).toBeTruthy()
      const claimedUsername = `claimed_${suffix}`.slice(0, 30)
      await completeChatOnboarding(secondPage, {
        displayName: 'Original Bob',
        username: claimedUsername,
      })

      await firstPage.getByTestId('onboarding-avatar').setInputFiles({
        name: 'too-large.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      })
      await expect(firstPage.getByRole('alert')).toContainText('请选择小于 5 MB')

      await firstPage.getByTestId('profile-display-name').fill('Alice Atmosphere')
      await firstPage.getByTestId('profile-username').fill(claimedUsername)
      await firstPage.getByTestId('complete-onboarding').click()
      await expect(firstPage.getByRole('alert')).toContainText('用户名已经被使用')

      const firstUsername = `alice_${suffix}`.slice(0, 30)
      await firstPage.getByTestId('profile-username').fill(firstUsername)
      await firstPage.getByTestId('complete-onboarding').click()
      await expect(firstPage).toHaveURL(/\/zh-CN\/messages$/)
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')

      const firstBootstrapResponse = await firstPage.request.get('/v1/session/bootstrap')
      expect(firstBootstrapResponse.ok(), await firstBootstrapResponse.text()).toBeTruthy()
      const firstBootstrap = await firstBootstrapResponse.json()
      expect(firstBootstrap.user).toMatchObject({
        displayName: 'Alice Atmosphere',
        username: firstUsername,
        onboardingCompleted: true,
      })

      await firstPage.goto('/zh-CN/me')
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await firstPage.getByTestId('edit-profile').click()
      await firstPage.getByTestId('me-profile-display-name').fill('Alice Updated')
      const updatedUsername = `updated_${suffix}`.slice(0, 30)
      await firstPage.getByTestId('me-profile-username').fill(updatedUsername)
      await firstPage.getByTestId('save-profile').click()
      await expect(firstPage.getByTestId('me-page')).toContainText('Alice Updated')
      await expect(firstPage.getByTestId('me-page')).toContainText(`@${updatedUsername}`)

      const secondProfile = await secondPage.request.get('/v1/profile').then((response) => response.json())
      const nonContactRemark = await firstPage.request.patch(
        `/v1/contacts/${encodeURIComponent(secondProfile.id)}`,
        { data: { remark: 'Not yet' } },
      )
      expect(nonContactRemark.status()).toBe(409)

      const requestResponse = await firstPage.request.post('/v1/friend-requests', {
        data: { recipientUserId: secondProfile.id },
      })
      expect(requestResponse.status(), await requestResponse.text()).toBe(201)
      const secondSnapshotResponse = await secondPage.request.get('/v1/contacts')
      expect(secondSnapshotResponse.ok(), await secondSnapshotResponse.text()).toBeTruthy()
      const secondSnapshot = await secondSnapshotResponse.json()
      const acceptResponse = await secondPage.request.post(
        `/v1/friend-requests/${encodeURIComponent(secondSnapshot.incomingRequests[0].id)}/accept`,
        { data: {} },
      )
      expect(acceptResponse.ok(), await acceptResponse.text()).toBeTruthy()

      await firstPage.goto('/zh-CN/contacts')
      await expect(firstPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
      await expect(firstPage.getByTestId('contact-row')).toContainText('Original Bob')
      await firstPage.getByTestId('edit-contact-remark').click()
      await firstPage.getByTestId('contact-remark-input').fill('深夜电台搭子')
      await firstPage.getByTestId('save-contact-remark').click()
      await expect(firstPage.getByTestId('contact-row')).toContainText('深夜电台搭子')

      const firstSnapshot = await firstPage.request.get('/v1/contacts').then((response) => response.json())
      expect(firstSnapshot.contacts[0]).toMatchObject({
        id: secondProfile.id,
        remark: '深夜电台搭子',
      })
      const privateSnapshot = await secondPage.request.get('/v1/contacts').then((response) => response.json())
      expect(privateSnapshot.contacts[0]).toMatchObject({
        id: firstBootstrap.user.id,
        displayName: 'Alice Updated',
      })
      expect(privateSnapshot.contacts[0].remark).toBeNull()

      await firstPage.getByTestId('edit-contact-remark').click()
      await firstPage.getByTestId('clear-contact-remark').click()
      await expect(firstPage.getByTestId('contact-row')).toContainText('Original Bob')

      await firstPage.goto('/zh-CN/onboarding')
      await expect(firstPage).toHaveURL(/\/zh-CN\/messages$/)
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })
})
