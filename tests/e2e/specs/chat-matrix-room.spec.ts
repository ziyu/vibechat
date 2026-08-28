import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { completeChatOnboarding, signInViaAPI, signUpViaAPI } from '../helpers/auth'

function chatFrame(page: Page) {
  return page.frameLocator('[data-testid="space-app-surface"] iframe')
}

async function openAppChat(page: Page, timeout = 30_000) {
  const frame = chatFrame(page)
  const input = frame.getByTestId('message-input')
  const root = frame.locator('#vcc-root')
  await input.waitFor({ state: 'attached', timeout })
  if (await root.getAttribute('data-open') !== 'true') {
    await frame.getByRole('button', { name: 'Open Space Chat' }).click({ force: true })
  }
  await expect(root).toHaveAttribute('data-open', 'true')
  await expect(input).toBeInViewport()
  return frame
}

async function mountedAppRevision(page: Page) {
  const src = await page.locator('[data-testid="space-app-surface"] iframe').getAttribute('src')
  return src ? new URL(src, page.url()).searchParams.get('version') : null
}

async function readRuntimeSideEffects(spaceInstanceId: string, userId: string) {
  const sqlitePath = resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/local.sqlite')
  const Database = (await import('better-sqlite3')).default
  const db = new Database(sqlitePath, { readonly: true })
  try {
    const count = (sql: string, value: string) => (
      db.prepare(sql).get(value) as { count: number }
    ).count
    const user = db.prepare(
      'SELECT credit_balance FROM "user" WHERE id = ?',
    ).get(userId) as { credit_balance: string } | undefined
    expect(user).toBeTruthy()
    return {
      turnCount: count(
        'SELECT COUNT(*) AS count FROM space_runtime_turn WHERE space_instance_id = ?',
        spaceInstanceId,
      ),
      outboxCount: count(
        'SELECT COUNT(*) AS count FROM space_runtime_outbox WHERE space_instance_id = ?',
        spaceInstanceId,
      ),
      creditTransactionCount: count(
        'SELECT COUNT(*) AS count FROM credit_transaction WHERE user_id = ?',
        userId,
      ),
      creditBalance: user!.credit_balance,
    }
  } finally {
    db.close()
  }
}

test.describe('Vibe Chat real Matrix room and timeline', () => {
  test.setTimeout(90_000)

  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires the local Synapse Matrix-ready profile',
  )

  test('rejects unauthenticated room creation with the product error contract', async ({ request }) => {
    const response = await request.post('/v1/rooms', {
      data: {
        spaceId: 'space-campfire',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `unauth-${crypto.randomUUID()}`,
        name: 'Unauthorized room',
      },
    })

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'AUTH_SESSION_REQUIRED',
        details: {},
        requestId: expect.any(String),
      },
    })

    const applyTemplate = await request.post(
      `/v1/rooms/${encodeURIComponent('!missing:localhost')}/apply-template`,
      {
        data: {
          requestId: `unauth-apply-${crypto.randomUUID()}`,
          expectedReadyRevisionId: '0123456789abcdef',
          spaceTemplateId: 'space-campfire',
          spaceTemplateVersionId: 'tplv-space-campfire-0-1-2',
        },
      },
    )
    expect(applyTemplate.status()).toBe(401)
    await expect(applyTemplate.json()).resolves.toMatchObject({
      error: { code: 'AUTH_SESSION_REQUIRED' },
    })
  })

  test('pins the published Revision while ready Candidates change and enforces the App trust boundary', async ({
    browser,
    page,
  }) => {
    test.setTimeout(480_000)
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const email = `e2e-space-lifecycle-${suffix}@example.com`
    const password = 'VibeChat-e2e-password-2026!'
    const signUp = await signUpViaAPI(page, {
      name: 'Space Lifecycle E2E',
      email,
      password,
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page)
    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap.matrix.status).toBe('ready')

    const createdResponse = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-campfire',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `lifecycle-${crypto.randomUUID()}`,
        name: 'Space lifecycle security E2E',
      },
    })
    expect(createdResponse.status(), await createdResponse.text()).toBe(201)
    const created = await createdResponse.json()
    const runtimeUrl = `/v1/spaces/instances/${encodeURIComponent(created.matrixRoomId)}`
    const appUrl = `${runtimeUrl}/app?channel=dev`

    const secondContext = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:8001',
    })
    try {
      const secondPage = await secondContext.newPage()
      const secondSignIn = await signInViaAPI(secondPage, { email, password })
      expect(secondSignIn.ok(), await secondSignIn.text()).toBeTruthy()
      await Promise.all([
        page.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`),
        secondPage.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`),
      ])
      await Promise.all([
        expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true'),
        expect(secondPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true'),
      ])

      const initialResponse = await page.request.get(runtimeUrl)
      expect(initialResponse.ok(), await initialResponse.text()).toBeTruthy()
      const initial = await initialResponse.json()
      const firstRevision = initial.project.draftId as string
      expect(firstRevision).toMatch(/^[a-f0-9]{16}$/)
      expect(initial.project.template.id).toBe('space-campfire')
      await expect.poll(() => mountedAppRevision(page)).toBe(firstRevision)
      await expect.poll(() => mountedAppRevision(secondPage)).toBe(firstRevision)

      const messageText = `Lifecycle Matrix message ${suffix}`
      const firstChat = await openAppChat(page, 90_000)
      await firstChat.getByTestId('message-input').fill(messageText)
      await firstChat.getByTestId('send-message').click()
      await expect(firstChat.getByTestId('message-body').filter({ hasText: messageText }))
        .toHaveCount(1, { timeout: 30_000 })
      await expect((await openAppChat(secondPage, 90_000)).getByTestId('message-body')
        .filter({ hasText: messageText })).toHaveCount(1, { timeout: 30_000 })

      const stateValue = { marker: `lifecycle-${suffix}` }
      const stateResponse = await page.request.post(`${runtimeUrl}/bridge`, {
        data: {
          action: 'state.set',
          payload: { key: 'e2e.lifecycle', value: stateValue },
        },
      })
      expect(stateResponse.ok(), await stateResponse.text()).toBeTruthy()

      const publishResponse = await page.request.post(`${runtimeUrl}/publish`, {
        data: {
          requestId: `publish-${crypto.randomUUID()}`,
          expectedReadyRevisionId: firstRevision,
        },
      })
      expect(publishResponse.status(), await publishResponse.text()).toBe(202)
      await expect.poll(async () => {
        const response = await page.request.get(runtimeUrl)
        if (!response.ok()) return null
        const snapshot = await response.json()
        return snapshot.project.releaseId || null
      }, { timeout: 240_000 }).not.toBeNull()
      const publishedSnapshot = await (await page.request.get(runtimeUrl)).json()
      const fixedReleaseId = publishedSnapshot.project.releaseId as string
      expect(fixedReleaseId).toEqual(expect.any(String))

      const publishedLive = await page.request.get(`${runtimeUrl}/app?channel=live`)
      expect(publishedLive.ok(), await publishedLive.text()).toBeTruthy()
      expect(await publishedLive.text()).toContain('<title>夜航电台</title>')

      const applyResponse = await page.request.post(
        `/v1/rooms/${encodeURIComponent(created.matrixRoomId)}/apply-template`,
        {
          data: {
            requestId: `apply-focus-${crypto.randomUUID()}`,
            expectedReadyRevisionId: firstRevision,
            spaceTemplateId: 'space-focus',
            spaceTemplateVersionId: 'tplv-space-focus-0-1-2',
          },
        },
      )
      expect(applyResponse.status(), await applyResponse.text()).toBe(202)
      let secondRevision = ''
      await expect.poll(async () => {
        const response = await page.request.get(runtimeUrl)
        if (!response.ok()) return null
        const snapshot = await response.json()
        secondRevision = snapshot.project.draftId
        return {
          changed: secondRevision !== firstRevision,
          templateId: snapshot.project.template?.id,
          previewState: snapshot.devPreview.state,
          releaseId: snapshot.project.releaseId,
          appState: snapshot.appState.state['e2e.lifecycle'],
        }
      }, { timeout: 120_000 }).toEqual({
        changed: true,
        templateId: 'space-focus',
        previewState: 'ready',
        releaseId: fixedReleaseId,
        appState: stateValue,
      })
      expect(secondRevision).toMatch(/^[a-f0-9]{16}$/)
      await expect.poll(() => mountedAppRevision(page)).toBe(secondRevision)
      await expect.poll(() => mountedAppRevision(secondPage)).toBe(secondRevision)

      const firstFixedApp = await page.request.get(`${appUrl}&version=${firstRevision}`)
      expect(firstFixedApp.ok(), await firstFixedApp.text()).toBeTruthy()
      expect(await firstFixedApp.text()).toContain('<title>夜航电台</title>')
      const secondFixedApp = await page.request.get(`${appUrl}&version=${secondRevision}`)
      expect(secondFixedApp.ok(), await secondFixedApp.text()).toBeTruthy()
      expect(await secondFixedApp.text()).toContain('<title>苔原共创室</title>')

      const missingRevisionResponse = await page.request.get(
        `${appUrl}&version=0000000000000000`,
      )
      expect(missingRevisionResponse.status()).toBe(503)
      expect(missingRevisionResponse.headers()['content-type']).toContain('application/json')
      expect(missingRevisionResponse.headers()['x-vibechat-space-recovery']).toBeUndefined()
      const missingRevisionBody = await missingRevisionResponse.text()
      expect(missingRevisionBody).toContain('Space ready Revision 0000000000000000 is unavailable')
      expect(missingRevisionBody).not.toContain('data-vibechat-space-sdk')
      expect(missingRevisionBody).not.toContain('<title>Vibe Chat</title>')

      await Promise.all([page.reload(), secondPage.reload()])
      await Promise.all([
        expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true'),
        expect(secondPage.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true'),
      ])
      await expect.poll(() => mountedAppRevision(page)).toBe(secondRevision)
      await expect.poll(() => mountedAppRevision(secondPage)).toBe(secondRevision)
      await expect((await openAppChat(page)).getByTestId('message-body')
        .filter({ hasText: messageText })).toHaveCount(1)

      const longLivedLive = await page.request.get(`${runtimeUrl}/app?channel=live`)
      expect(longLivedLive.ok(), await longLivedLive.text()).toBeTruthy()
      expect(await longLivedLive.text()).toContain('<title>夜航电台</title>')

      await expect(page.getByTestId('space-kernel-bar')).toBeVisible()
      await expect(chatFrame(page).getByTestId('space-kernel-bar')).toHaveCount(0)
      const fixedAppBody = await secondFixedApp.text()
      expect(fixedAppBody).not.toContain(bootstrap.matrix.accessToken)
      expect(fixedAppBody).not.toContain('SPACE_RUNTIME_INTERNAL_TOKEN')
      expect(fixedAppBody).not.toContain('OPENAI_API_KEY')
      expect(fixedAppBody).not.toContain('ANTHROPIC_API_KEY')

      const directRuntime = await page.request.get(new URL(
        `/api/apps/${encodeURIComponent(created.spaceInstanceId)}`,
        process.env.SPACE_RUNTIME_ORIGIN || 'http://localhost:8007',
      ).href)
      expect(directRuntime.status()).toBe(401)

      const forgedPresence = await page.request.post(`${runtimeUrl}/bridge`, {
        data: {
          clientId: 'kernel',
          authorName: 'Kernel',
          agentId: 'pi',
          spaceInstanceId: 'another-space',
          action: 'presence.update',
          payload: { value: { mode: 'security-probe' } },
        },
      })
      expect(forgedPresence.ok(), await forgedPresence.text()).toBeTruthy()
      const identitySnapshot = await (await page.request.get(runtimeUrl)).json()
      expect(identitySnapshot.appState.presence).toEqual(expect.arrayContaining([
        expect.objectContaining({ clientId: bootstrap.user.id }),
      ]))
      expect(identitySnapshot.appState.presence).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ clientId: 'kernel' }),
      ]))

      const beforeRejectedCommands = (process.env.DB_DIALECT || 'sqlite') === 'sqlite'
        ? await readRuntimeSideEffects(created.spaceInstanceId, bootstrap.user.id)
        : null
      const securityProbe = await chatFrame(page).locator('body').evaluate(async () => {
        let parentAccessDenied = false
        try {
          void window.parent.document.body
        } catch {
          parentAccessDenied = true
        }
        let localStorageDenied = false
        try {
          void window.localStorage.length
        } catch {
          localStorageDenied = true
        }
        let cookie = ''
        let cookieDenied = false
        try {
          cookie = document.cookie
        } catch {
          cookieDenied = true
        }
        let networkDenied = false
        try {
          await fetch('/v1/session/bootstrap')
        } catch {
          networkDenied = true
        }

        const nonce = await new Promise<string>((resolveNonce, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('bridge init timed out')), 5_000)
          const listener = (event: MessageEvent) => {
            if (
              event.source === window.parent
              && event.data?.type === 'space:init'
              && typeof event.data.nonce === 'string'
            ) {
              window.clearTimeout(timeout)
              window.removeEventListener('message', listener)
              resolveNonce(event.data.nonce)
            }
          }
          window.addEventListener('message', listener)
          window.parent.postMessage({ type: 'space:bridge-ready', version: 1 }, '*')
        })

        const pending = new Map<string, (value: Record<string, unknown>) => void>()
        const resultListener = (event: MessageEvent) => {
          const id = event.data?.id
          if (event.source !== window.parent || event.data?.type !== 'space:result' || typeof id !== 'string') return
          pending.get(id)?.(event.data as Record<string, unknown>)
          pending.delete(id)
        }
        window.addEventListener('message', resultListener)
        const send = (value: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolveResult, reject) => {
          const id = String(value.id)
          const timeout = window.setTimeout(() => {
            pending.delete(id)
            reject(new Error(`bridge result timed out: ${id}`))
          }, 15_000)
          pending.set(id, (result) => {
            window.clearTimeout(timeout)
            resolveResult(result)
          })
          window.parent.postMessage(value, '*')
        })
        const envelope = (id: string, sequence: number, action: string, payload = {}) => ({
          type: 'space:command',
          version: 1,
          id,
          nonce,
          sequence,
          action,
          payload,
        })

        const publish = await send(envelope('forged-publish', 900_000, 'app.publish'))
        const wrongNonce = await send({
          ...envelope('wrong-nonce', 900_000, 'theme.set'),
          nonce: 'b53b2817-0019-45d5-a352-ff46ba4b9fc5',
        })
        const forgedEvent = envelope('forged-identity', 1_000_000, 'event.emit', {
          name: 'security.probe',
          payload: {
            clientId: 'kernel',
            authorName: 'Kernel',
            agentId: 'pi',
            matrixRoomId: '!forged:localhost',
            releaseId: 'forged-release',
          },
        })
        const accepted = await send(forgedEvent)
        const replay = await send({ ...forgedEvent, id: 'replayed-command' })
        const burst = await Promise.all(Array.from({ length: 130 }, (_, index) =>
          send(envelope(`burst-${index}`, 1_000_001 + index, 'theme.set')),
        ))
        window.removeEventListener('message', resultListener)
        return {
          parentAccessDenied,
          localStorageDenied,
          cookieDenied,
          networkDenied,
          cookie,
          publish,
          wrongNonce,
          accepted,
          replay,
          burstErrors: burst.filter((result) => result.ok === false).map((result) => result.error),
        }
      })
      expect(securityProbe).toMatchObject({
        parentAccessDenied: true,
        localStorageDenied: true,
        cookieDenied: true,
        networkDenied: true,
        cookie: '',
        publish: { ok: false, error: 'SPACE_APP_BRIDGE_COMMAND_INVALID' },
        wrongNonce: { ok: false, error: 'SPACE_APP_BRIDGE_NONCE_INVALID' },
        accepted: { ok: true },
        replay: { ok: false, error: 'SPACE_APP_BRIDGE_SEQUENCE_INVALID' },
      })
      expect(securityProbe.burstErrors).toContain('SPACE_APP_BRIDGE_RATE_LIMITED')
      if (beforeRejectedCommands) {
        await expect.poll(() => readRuntimeSideEffects(
          created.spaceInstanceId,
          bootstrap.user.id,
        )).toEqual(beforeRejectedCommands)
      }

      const restoreResponse = await page.request.post(`${runtimeUrl}/restore`, {
        data: {
          requestId: `restore-default-${crypto.randomUUID()}`,
          target: 'default-chat',
          expectedReadyRevisionId: secondRevision,
        },
      })
      expect(restoreResponse.status(), await restoreResponse.text()).toBe(202)
      let restoredRevision = ''
      await expect.poll(async () => {
        const response = await page.request.get(runtimeUrl)
        if (!response.ok()) return null
        const snapshot = await response.json()
        restoredRevision = snapshot.project.draftId
        return {
          changed: restoredRevision !== secondRevision,
          templateId: snapshot.project.template?.id,
          previewState: snapshot.devPreview.state,
          releaseId: snapshot.project.releaseId,
          appState: snapshot.appState.state['e2e.lifecycle'],
        }
      }, { timeout: 120_000 }).toEqual({
        changed: true,
        templateId: 'space-default',
        previewState: 'ready',
        releaseId: fixedReleaseId,
        appState: stateValue,
      })
      await expect.poll(() => mountedAppRevision(page)).toBe(restoredRevision)
      await expect.poll(() => mountedAppRevision(secondPage)).toBe(restoredRevision)
      await expect((await openAppChat(page)).getByTestId('message-body')
        .filter({ hasText: messageText })).toHaveCount(1)
      await expect((await openAppChat(secondPage)).getByTestId('message-body')
        .filter({ hasText: messageText })).toHaveCount(1)

      const unchangedLive = await page.request.get(`${runtimeUrl}/app?channel=live`)
      expect(unchangedLive.ok(), await unchangedLive.text()).toBeTruthy()
      expect(await unchangedLive.text()).toContain('<title>夜航电台</title>')
      expect((await page.request.get(`${appUrl}&version=${firstRevision}`)).ok()).toBe(true)
      expect((await page.request.get(`${appUrl}&version=${secondRevision}`)).ok()).toBe(true)
    } finally {
      await secondContext.close()
    }
  })

  test('applies and rolls back a fixed Revision without replacing Chat, App state, or Release', async ({
    browser,
    page,
  }) => {
    test.setTimeout(420_000)
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const signUp = await signUpViaAPI(page, {
      name: 'Blank Space E2E',
      email: `e2e-blank-space-${suffix}@example.com`,
      password: 'VibeChat-e2e-password-2026!',
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page)

    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap.matrix.status).toBe('ready')

    await page.goto('/spaces')
    await page.getByTestId('create-space-hero').click()
    const createDialog = page.getByTestId('new-space-dialog')
    await expect(createDialog).toBeVisible()
    await createDialog.getByTestId('new-space-next').click()
    await expect(createDialog.getByTestId('space-start-blank')).toHaveAttribute(
      'data-selected',
      'true',
    )
    await createDialog.getByTestId('new-space-next').click()

    const createResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/v1/rooms',
    )
    await createDialog.getByTestId('new-space-create').click()
    const createResponse = await createResponsePromise
    expect(createResponse.status(), await createResponse.text()).toBe(201)
    const created = await createResponse.json()
    expect(created).toMatchObject({
      matrixRoomId: expect.stringMatching(/^!.*:localhost$/),
      startMode: 'blank',
      spaceId: null,
      spaceVersionId: null,
      spaceTemplateId: null,
      spaceTemplateVersionId: null,
      status: 'active',
    })
    expect(createResponse.request().postDataJSON()).toMatchObject({
      startMode: 'blank',
    })
    expect(createResponse.request().postDataJSON()).not.toHaveProperty('spaceTemplateId')
    await page.waitForURL((url) =>
      decodeURIComponent(url.pathname) === `/spaces/${created.matrixRoomId}`,
    )

    const blankStateUrl =
      `${bootstrap.matrix.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(created.matrixRoomId)}`
      + '/state/io.vibechat.space.instance.v1/'
    const stateResponse = await page.request.get(blankStateUrl, {
      headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
    })
    expect(stateResponse.ok(), await stateResponse.text()).toBeTruthy()
    const blankState = await stateResponse.json()
    expect(blankState).toMatchObject({
      startMode: 'blank',
      spaceInstanceId: created.spaceInstanceId,
      projectId: created.projectId,
      defaultAgentId: 'pi',
      createdBy: bootstrap.matrix.userId,
    })
    expect(blankState).not.toHaveProperty('templateId')
    expect(blankState).not.toHaveProperty('templateVersionId')

    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    const runtimeUrl = `/v1/spaces/instances/${encodeURIComponent(created.matrixRoomId)}`
    const initialSnapshotResponse = await page.request.get(runtimeUrl)
    expect(initialSnapshotResponse.ok(), await initialSnapshotResponse.text()).toBeTruthy()
    const initialSnapshot = await initialSnapshotResponse.json()
    expect(initialSnapshot.project).toMatchObject({
      draftId: expect.stringMatching(/^[a-f0-9]{16}$/),
      template: { id: 'space-default' },
    })

    const messageText = `Blank Space Matrix message ${Date.now()}`
    const blankChat = await openAppChat(page, 90_000)
    await blankChat.getByTestId('message-input').fill(messageText)
    await blankChat.getByTestId('send-message').click()
    await expect(
      blankChat.getByTestId('message-body')
        .filter({ hasText: messageText })
        .locator('xpath=ancestor::article'),
    ).toContainText('已发送', { timeout: 30_000 })

    const stateValue = { marker: `preserved-${suffix}` }
    const appStateResponse = await page.request.post(`${runtimeUrl}/bridge`, {
      data: {
        action: 'state.set',
        payload: { key: 'e2e.template-preserved', value: stateValue },
      },
    })
    expect(appStateResponse.ok(), await appStateResponse.text()).toBeTruthy()

    const publishResponse = await page.request.post(`${runtimeUrl}/publish`, {
      data: {
        requestId: `blank-publish-${crypto.randomUUID()}`,
        expectedReadyRevisionId: initialSnapshot.project.draftId,
      },
    })
    expect(publishResponse.status(), await publishResponse.text()).toBe(202)
    await expect.poll(async () => {
      const response = await page.request.get(runtimeUrl)
      if (!response.ok()) return null
      const snapshot = await response.json()
      return snapshot.project.releaseId ? snapshot : null
    }, { timeout: 240_000 }).not.toBeNull()
    const beforeApplyResponse = await page.request.get(runtimeUrl)
    expect(beforeApplyResponse.ok(), await beforeApplyResponse.text()).toBeTruthy()
    const beforeApply = await beforeApplyResponse.json()
    expect(beforeApply.appState.state['e2e.template-preserved']).toEqual(stateValue)
    expect(beforeApply.project.releaseId).toEqual(expect.any(String))

    const wrongVersion = await page.request.post(
      `/v1/rooms/${encodeURIComponent(created.matrixRoomId)}/apply-template`,
      {
        data: {
          requestId: `wrong-template-version-${crypto.randomUUID()}`,
          expectedReadyRevisionId: beforeApply.project.draftId,
          spaceTemplateId: 'space-campfire',
          spaceTemplateVersionId: 'tplv-space-campfire-does-not-exist',
        },
      },
    )
    expect(wrongVersion.status()).toBe(404)
    await expect(wrongVersion.json()).resolves.toMatchObject({
      error: { code: 'SPACE_TEMPLATE_VERSION_NOT_FOUND' },
    })

    const outsiderContext = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:8001',
    })
    try {
      const outsider = await outsiderContext.newPage()
      const outsiderSignUp = await signUpViaAPI(outsider, {
        name: 'Blank Space Outsider',
        email: `e2e-blank-space-outsider-${suffix}@example.com`,
        password: 'VibeChat-e2e-password-2026!',
      })
      expect(outsiderSignUp.ok(), await outsiderSignUp.text()).toBeTruthy()
      await completeChatOnboarding(outsider)
      const outsiderBootstrap = await outsider.request.get('/v1/session/bootstrap')
      expect(outsiderBootstrap.ok(), await outsiderBootstrap.text()).toBeTruthy()
      const outsiderApply = await outsider.request.post(
        `/v1/rooms/${encodeURIComponent(created.matrixRoomId)}/apply-template`,
        {
          data: {
            requestId: `outsider-template-${crypto.randomUUID()}`,
            expectedReadyRevisionId: beforeApply.project.draftId,
            spaceTemplateId: 'space-campfire',
            spaceTemplateVersionId: 'tplv-space-campfire-0-1-2',
          },
        },
      )
      expect(outsiderApply.status()).toBe(404)
      await expect(outsiderApply.json()).resolves.toMatchObject({
        error: { code: 'SPACE_INSTANCE_NOT_FOUND' },
      })
      const outsiderHistory = await outsider.request.get(
        `/v1/rooms/${encodeURIComponent(created.matrixRoomId)}/revisions`,
      )
      expect(outsiderHistory.status()).toBe(404)
      await expect(outsiderHistory.json()).resolves.toMatchObject({
        error: { code: 'SPACE_INSTANCE_NOT_FOUND' },
      })
    } finally {
      await outsiderContext.close()
    }

    await page.getByRole('button', { name: 'Space 菜单' }).click()
    await page.getByTestId('apply-space-template').click()
    const applyDialog = page.getByTestId('apply-space-template-dialog')
    await expect(applyDialog).toBeVisible()
    await applyDialog.getByTestId('apply-template-space-campfire').click()
    const applyResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/apply-template'),
    )
    await applyDialog.getByTestId('confirm-apply-space-template').click()
    const applyResponse = await applyResponsePromise
    expect(applyResponse.status(), await applyResponse.text()).toBe(202)
    expect(applyResponse.request().postDataJSON()).toMatchObject({
      expectedReadyRevisionId: beforeApply.project.draftId,
      spaceTemplateId: 'space-campfire',
      spaceTemplateVersionId: 'tplv-space-campfire-0-1-2',
    })

    await expect.poll(async () => {
      const response = await page.request.get(runtimeUrl)
      if (!response.ok()) return null
      const snapshot = await response.json()
      return {
        draftChanged: snapshot.project.draftId !== beforeApply.project.draftId,
        templateId: snapshot.project.template?.id,
        templateVersionId: snapshot.project.template?.versionId,
        releaseId: snapshot.project.releaseId,
        appState: snapshot.appState.state['e2e.template-preserved'],
        previewState: snapshot.devPreview.state,
      }
    }, { timeout: 120_000 }).toEqual({
      draftChanged: true,
      templateId: 'space-campfire',
      templateVersionId: 'tplv-space-campfire-0-1-2',
      releaseId: beforeApply.project.releaseId,
      appState: stateValue,
      previewState: 'ready',
    })

    const appliedChat = await openAppChat(page)
    await expect(appliedChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    const unchangedBlankState = await (await page.request.get(blankStateUrl, {
      headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
    })).json()
    expect(unchangedBlankState).toMatchObject({ startMode: 'blank' })
    expect(unchangedBlankState).not.toHaveProperty('templateId')

    const afterApplyResponse = await page.request.get(runtimeUrl)
    expect(afterApplyResponse.ok(), await afterApplyResponse.text()).toBeTruthy()
    const afterApply = await afterApplyResponse.json()
    const historyResponse = await page.request.get(
      `/v1/rooms/${encodeURIComponent(created.matrixRoomId)}/revisions`,
    )
    expect(historyResponse.ok(), await historyResponse.text()).toBeTruthy()
    const historyText = await historyResponse.text()
    expect(historyText).not.toContain('sourceObjectKey')
    expect(historyText).not.toContain('source_object_key')
    const history = JSON.parse(historyText)
    expect(history.revisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        revisionId: initialSnapshot.project.draftId,
        isReady: false,
        isPublished: true,
      }),
      expect.objectContaining({
        revisionId: afterApply.project.draftId,
        isReady: true,
      }),
    ]))

    const secondContext = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:8001',
    })
    try {
      const secondPage = await secondContext.newPage()
      const secondSignIn = await signInViaAPI(secondPage, {
        email: `e2e-blank-space-${suffix}@example.com`,
        password: 'VibeChat-e2e-password-2026!',
      })
      expect(secondSignIn.ok(), await secondSignIn.text()).toBeTruthy()
      const secondBootstrap = await secondPage.request.get('/v1/session/bootstrap')
      expect(secondBootstrap.ok(), await secondBootstrap.text()).toBeTruthy()
      await secondPage.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`)
      await expect(secondPage.getByTestId('chat-app-shell')).toHaveAttribute(
        'data-ready',
        'true',
      )
      await expect(
        (await openAppChat(secondPage, 90_000)).getByTestId('message-body')
          .filter({ hasText: messageText }),
      ).toHaveCount(1)

      await page.getByRole('button', { name: 'Space 菜单' }).click()
      await page.getByTestId('space-revision-history').click()
      const revisionDialog = page.getByTestId('space-revision-history-dialog')
      await expect(revisionDialog).toBeVisible()
      await revisionDialog.getByTestId(
        `space-revision-${initialSnapshot.project.draftId}`,
      ).click()
      const restoreResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname.endsWith('/restore'),
      )
      await revisionDialog.getByTestId('confirm-restore-space-revision').click()
      const restoreResponse = await restoreResponsePromise
      expect(restoreResponse.status(), await restoreResponse.text()).toBe(202)
      expect(restoreResponse.request().postDataJSON()).toMatchObject({
        target: 'revision',
        revisionId: initialSnapshot.project.draftId,
        expectedReadyRevisionId: afterApply.project.draftId,
      })

      await expect.poll(async () => {
        const [first, second] = await Promise.all([
          page.request.get(runtimeUrl),
          secondPage.request.get(runtimeUrl),
        ])
        if (!first.ok() || !second.ok()) return null
        const [firstSnapshot, secondSnapshot] = await Promise.all([
          first.json(),
          second.json(),
        ])
        return {
          firstRevision: firstSnapshot.project.draftId,
          secondRevision: secondSnapshot.project.draftId,
          releaseId: firstSnapshot.project.releaseId,
          secondReleaseId: secondSnapshot.project.releaseId,
          appState: firstSnapshot.appState.state['e2e.template-preserved'],
        }
      }, { timeout: 120_000 }).toEqual({
        firstRevision: initialSnapshot.project.draftId,
        secondRevision: initialSnapshot.project.draftId,
        releaseId: beforeApply.project.releaseId,
        secondReleaseId: beforeApply.project.releaseId,
        appState: stateValue,
      })
      await expect(
        (await openAppChat(page)).getByTestId('message-body').filter({ hasText: messageText }),
      ).toHaveCount(1)
      await expect(
        (await openAppChat(secondPage)).getByTestId('message-body').filter({ hasText: messageText }),
      ).toHaveCount(1)
    } finally {
      await secondContext.close()
    }
  })

  test('creates an indexed atmosphere room and sends a durable Matrix message', async ({ page }) => {
    const email = `e2e-matrix-room-${Date.now()}@example.com`
    const signUp = await signUpViaAPI(page, {
      name: 'Matrix Room E2E',
      email,
      password: 'VibeChat-e2e-password-2026!',
    })
    expect(signUp.ok(), await signUp.text()).toBeTruthy()
    await completeChatOnboarding(page)

    const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
    expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
    const bootstrap = await bootstrapResponse.json()
    expect(bootstrap.matrix.status).toBe('ready')

    const unknownSpace = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-does-not-exist',
        participantUserIds: [],
        instanceConfig: {},
        clientRequestId: `unknown-space-${crypto.randomUUID()}`,
        name: 'Unknown space',
      },
    })
    expect(unknownSpace.status()).toBe(404)
    await expect(unknownSpace.json()).resolves.toMatchObject({
      error: { code: 'ROOM_SPACE_NOT_FOUND' },
    })

    const missingParticipant = await page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-campfire',
        participantUserIds: ['missing-product-user'],
        instanceConfig: {},
        clientRequestId: `missing-participant-${crypto.randomUUID()}`,
        name: 'Missing participant',
      },
    })
    expect(missingParticipant.status()).toBe(409)
    await expect(missingParticipant.json()).resolves.toMatchObject({
      error: { code: 'SOCIAL_NOT_CONTACT' },
    })

    const clientRequestId = `e2e-room-${crypto.randomUUID()}`
    const createBody = {
      spaceId: 'space-campfire',
      participantUserIds: [],
      instanceConfig: { ambient: 'night' },
      clientRequestId,
      name: 'Matrix Room E2E',
    }
    const createdResponse = await page.request.post('/v1/rooms', { data: createBody })
    expect(createdResponse.status(), await createdResponse.text()).toBe(201)
    const created = await createdResponse.json()
    expect(created).toMatchObject({
      matrixRoomId: expect.stringMatching(/^!.*:localhost$/),
      spaceId: 'space-campfire',
      spaceVersionId: 'tplv-space-campfire-0-1-2',
      status: 'active',
    })

    const repeatedResponse = await page.request.post('/v1/rooms', { data: createBody })
    expect(repeatedResponse.status(), await repeatedResponse.text()).toBe(201)
    await expect(repeatedResponse.json()).resolves.toEqual(created)

    const stateResponse = await page.request.get(
      `${bootstrap.matrix.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(created.matrixRoomId)}`
        + '/state/io.vibechat.space.instance.v1/',
      { headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` } },
    )
    expect(stateResponse.ok(), await stateResponse.text()).toBeTruthy()
    await expect(stateResponse.json()).resolves.toMatchObject({
      templateId: 'space-campfire',
      templateVersionId: 'tplv-space-campfire-0-1-2',
      version: '0.1.2',
      integrity: expect.stringMatching(/^template:space-campfire@0\.1\.2\+sha256\./),
      publisher: {
        id: 'publisher-vibechat',
        verification: 'official',
      },
      instanceConfig: { ambient: 'night' },
      createdBy: bootstrap.matrix.userId,
      permissions: expect.arrayContaining(['messages.read', 'messages.send']),
    })

    const idempotentTxnId = `e2e-txn-${crypto.randomUUID()}`
    const idempotentSendUrl =
      `${bootstrap.matrix.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(created.matrixRoomId)}`
      + `/send/m.room.message/${encodeURIComponent(idempotentTxnId)}`
    const idempotentSendBody = {
      msgtype: 'm.text',
      body: 'Transaction retry should appear once',
    }
    const firstIdempotentSend = await page.request.put(idempotentSendUrl, {
      data: idempotentSendBody,
      headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
    })
    const repeatedIdempotentSend = await page.request.put(idempotentSendUrl, {
      data: idempotentSendBody,
      headers: { authorization: `Bearer ${bootstrap.matrix.accessToken}` },
    })
    expect(firstIdempotentSend.ok(), await firstIdempotentSend.text()).toBeTruthy()
    expect(repeatedIdempotentSend.ok(), await repeatedIdempotentSend.text()).toBeTruthy()
    expect(await repeatedIdempotentSend.json()).toEqual(await firstIdempotentSend.json())

    let delayedSend = false
    const matrixSendRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/_matrix/') && request.url().includes('/send/')) {
        matrixSendRequests.push(request.url())
      }
    })
    await page.route(/\/_matrix\/client\/.*\/rooms\/.*\/send\//, async (route) => {
      delayedSend = true
      await new Promise((resolve) => setTimeout(resolve, 1_500))
      await route.continue()
    })
    const readyAppResponse = page.waitForResponse((response) =>
      response.request().resourceType() === 'document'
      && response.url().includes('/v1/spaces/instances/')
      && response.url().includes('/app?channel=dev'),
    )
    await page.goto(`/spaces/${encodeURIComponent(created.matrixRoomId)}`)
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    await expect(page.getByTestId('space-canvas')).toBeVisible()
    const appResponse = await readyAppResponse
    expect(appResponse.headers()['x-vibechat-space-recovery']).toBeUndefined()
    const chat = await openAppChat(page)

    const messageText = `真实 Matrix 消息 ${Date.now()}`
    await chat.getByTestId('message-input').fill(messageText)
    await chat.getByTestId('send-message').click()
    await expect.poll(
      () => delayedSend,
      { message: `Matrix send requests: ${matrixSendRequests.join(', ')}` },
    ).toBe(true)
    const ownMessage = chat.getByTestId('message-body')
      .filter({ hasText: messageText })
      .locator('xpath=ancestor::article')
    await expect(ownMessage).toContainText('发送中…')
    await expect(ownMessage).toContainText('已发送')
    expect(delayedSend).toBe(true)

    await ownMessage.getByRole('button', { name: '回复' }).click()
    await expect(chat.getByTestId('chat-context')).toContainText(messageText)
    const replyText = `标准 Matrix 回复 ${Date.now()}`
    await chat.getByTestId('message-input').fill(replyText)
    await chat.getByTestId('send-message').click()
    const replyMessage = chat.getByTestId('message-body')
      .filter({ hasText: replyText })
      .locator('xpath=ancestor::article')
    await expect(replyMessage).toContainText(messageText)
    await expect(replyMessage).toContainText('已发送')

    // Resolve fresh locators after the message round-trip so this assertion is
    // independent from App-owned drawer rendering updates.
    const readyChat = await openAppChat(page)
    const readyOwnMessage = readyChat.getByTestId('message-body')
      .filter({ hasText: messageText })
      .locator('xpath=ancestor::article')
    await readyOwnMessage.getByRole('button', { name: '🌙', exact: true }).click()
    await expect(readyOwnMessage.locator('.vcc-reactions')).toContainText('🌙')
    await readyOwnMessage.locator('.vcc-reactions').getByRole('button', { name: '🌙 1' }).click()
    await expect(readyOwnMessage.locator('.vcc-reactions')).toHaveCount(0)
    await readyOwnMessage.getByRole('button', { name: '🌙', exact: true }).click()
    await expect(readyOwnMessage.locator('.vcc-reactions')).toContainText('🌙')

    await page.reload()
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('chat-app-shell')).toHaveAttribute('data-mode', 'matrix')
    const reloadedChat = await openAppChat(page)
    await expect(reloadedChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('message-body').filter({ hasText: replyText }).locator('xpath=ancestor::article'),
    ).toContainText(messageText)
    await expect(
      reloadedChat.getByTestId('message-body').filter({ hasText: 'Transaction retry should appear once' }),
    ).toHaveCount(1)
    await expect(
      reloadedChat.getByTestId('message-body')
        .filter({ hasText: messageText })
        .locator('xpath=ancestor::article')
        .locator('.vcc-reactions'),
    ).toContainText('🌙')

    const runtimeUrl = `/v1/spaces/instances/${encodeURIComponent(created.matrixRoomId)}`
    const beforeRestoreResponse = await page.request.get(runtimeUrl)
    expect(beforeRestoreResponse.ok(), await beforeRestoreResponse.text()).toBeTruthy()
    const beforeRestore = await beforeRestoreResponse.json()
    expect(beforeRestore.project).toMatchObject({
      draftId: expect.stringMatching(/^[a-f0-9]{16}$/),
      template: { id: 'space-campfire' },
    })

    const publishedReleaseId = beforeRestore.project.releaseId

    await page.getByRole('button', { name: 'Space 菜单' }).click()
    await page.getByTestId('restore-default-chat').click()
    const recoveryDialog = page.getByTestId('restore-default-chat-dialog')
    await expect(recoveryDialog).toBeVisible()
    await expect(recoveryDialog).toContainText(beforeRestore.project.draftId.slice(0, 7))
    await page.getByTestId('confirm-restore-default-chat').click()

    await expect.poll(async () => {
      const response = await page.request.get(runtimeUrl)
      if (!response.ok()) return null
      const snapshot = await response.json()
      return {
        draftChanged: snapshot.project.draftId !== beforeRestore.project.draftId,
        releaseId: snapshot.project.releaseId,
        templateId: snapshot.project.template?.id,
        previewState: snapshot.devPreview.state,
      }
    }, { timeout: 20_000 }).toEqual({
      draftChanged: true,
      releaseId: publishedReleaseId,
      templateId: 'space-default',
      previewState: 'ready',
    })

    await expect(page.getByTestId('space-kernel-bar').locator('code')).not.toContainText(
      beforeRestore.project.draftId.slice(0, 7),
    )
    const restoredChat = await openAppChat(page)
    await expect(restoredChat.getByTestId('message-body').filter({ hasText: messageText })).toHaveCount(1)
    await expect(
      restoredChat.getByTestId('message-body').filter({ hasText: replyText }).locator('xpath=ancestor::article'),
    ).toContainText(messageText)
    await expect(
      restoredChat.getByTestId('message-body')
        .filter({ hasText: messageText })
        .locator('xpath=ancestor::article')
        .locator('.vcc-reactions'),
    ).toContainText('🌙')
    await expect(restoredChat.getByText('已恢复 Default Chat App。')).toHaveCount(0)

    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage))
    expect(localStorageDump).not.toContain(bootstrap.matrix.accessToken)
  })
})
