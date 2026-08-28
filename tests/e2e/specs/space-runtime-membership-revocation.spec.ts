import { resolve } from 'node:path'
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { completeChatOnboarding, signUpViaAPI } from '../helpers/auth'
import { closeBrowserContexts } from '../helpers/browser'

const password = 'VibeChat-e2e-password-2026!'
const e2eBaseUrl = process.env.E2E_BASE_URL || 'http://localhost:8001'

type MatrixBootstrap = {
  user: { id: string }
  matrix: {
    status: string
    accessToken: string
    homeserverUrl: string
    userId: string
  }
}

type MatrixUser = {
  page: Page
  bootstrap: MatrixBootstrap
}

type MembershipFixture = {
  owner: MatrixUser
  member: MatrixUser
  matrixRoomId: string
  close(): Promise<void>
}

type ControlPlaneEvidence = {
  participantUserIds: string[]
  spaceInstanceId: string
  turnCount: number
  outboxCount: number
  creditTransactionCount: number
  creditBalance: string
}

const removedMemberGateways = [
  { name: 'snapshot/bootstrap', method: 'GET', suffix: '' },
  { name: 'app/live', method: 'GET', suffix: '/app?channel=live' },
  { name: 'app/dev', method: 'GET', suffix: '/app?channel=dev' },
  { name: 'events', method: 'GET', suffix: '/events' },
  { name: 'messages/turns', method: 'POST', suffix: '/turns' },
  { name: 'publish', method: 'POST', suffix: '/publish' },
  { name: 'restore', method: 'POST', suffix: '/restore' },
  { name: 'bridge', method: 'POST', suffix: '/bridge' },
] as const

async function createMatrixUser(
  context: BrowserContext,
  name: string,
  email: string,
): Promise<MatrixUser> {
  const page = await context.newPage()
  const signUp = await signUpViaAPI(page, { name, email, password })
  expect(signUp.ok(), await signUp.text()).toBeTruthy()
  await completeChatOnboarding(page)
  const bootstrapResponse = await page.request.get('/v1/session/bootstrap')
  expect(bootstrapResponse.ok(), await bootstrapResponse.text()).toBeTruthy()
  const bootstrap = await bootstrapResponse.json() as MatrixBootstrap
  expect(bootstrap.matrix.status).toBe('ready')
  return { page, bootstrap }
}

async function createMembershipFixture(
  browser: Browser,
  label: string,
): Promise<MembershipFixture> {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const ownerContext = await browser.newContext({ baseURL: e2eBaseUrl })
  const memberContext = await browser.newContext({ baseURL: e2eBaseUrl })

  try {
    const owner = await createMatrixUser(
      ownerContext,
      `${label} Owner`,
      `e2e-runtime-${label}-owner-${suffix}@example.com`,
    )
    const member = await createMatrixUser(
      memberContext,
      `${label} Member`,
      `e2e-runtime-${label}-member-${suffix}@example.com`,
    )

    const friendRequest = await owner.page.request.post('/v1/friend-requests', {
      data: { recipientUserId: member.bootstrap.user.id },
    })
    expect(friendRequest.status(), await friendRequest.text()).toBe(201)
    const memberSocial = await (await member.page.request.get('/v1/contacts')).json()
    const acceptResponse = await member.page.request.post(
      `/v1/friend-requests/${encodeURIComponent(memberSocial.incomingRequests[0].id)}/accept`,
      { data: {} },
    )
    expect(acceptResponse.ok(), await acceptResponse.text()).toBeTruthy()

    const roomResponse = await owner.page.request.post('/v1/rooms', {
      data: {
        spaceId: 'space-default',
        participantUserIds: [member.bootstrap.user.id],
        instanceConfig: {},
        clientRequestId: `runtime-membership-${label}-${crypto.randomUUID()}`,
        name: `${label} Runtime Membership E2E`,
      },
    })
    expect(roomResponse.status(), await roomResponse.text()).toBe(201)
    const room = await roomResponse.json() as { matrixRoomId: string }

    const joinResponse = await matrixRequest(
      member,
      `/rooms/${encodeURIComponent(room.matrixRoomId)}/join`,
      'POST',
      {},
    )
    expect(joinResponse.ok(), await joinResponse.text()).toBeTruthy()

    const runtimeUrl = spaceRuntimeUrl(room.matrixRoomId)
    const memberSnapshot = await member.page.request.get(runtimeUrl)
    expect(memberSnapshot.ok(), await memberSnapshot.text()).toBeTruthy()

    return {
      owner,
      member,
      matrixRoomId: room.matrixRoomId,
      close: () => closeBrowserContexts([ownerContext, memberContext]),
    }
  } catch (error) {
    await closeBrowserContexts([ownerContext, memberContext])
    throw error
  }
}

function matrixRequest(
  user: MatrixUser,
  path: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
) {
  const url = new URL(`/_matrix/client/v3${path}`, user.bootstrap.matrix.homeserverUrl)
  return user.page.request.fetch(url.href, {
    method,
    data,
    headers: { authorization: `Bearer ${user.bootstrap.matrix.accessToken}` },
  })
}

function spaceRuntimeUrl(matrixRoomId: string) {
  return `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}`
}

async function assertMembershipIsLeave(fixture: MembershipFixture) {
  const membership = await matrixRequest(
    fixture.owner,
    `/rooms/${encodeURIComponent(fixture.matrixRoomId)}`
      + `/state/m.room.member/${encodeURIComponent(fixture.member.bootstrap.matrix.userId)}`,
    'GET',
  )
  expect(membership.ok(), await membership.text()).toBeTruthy()
  await expect(membership.json()).resolves.toMatchObject({ membership: 'leave' })
}

async function assertAllRuntimeGatewaysFailClosed(fixture: MembershipFixture) {
  const runtimeUrl = spaceRuntimeUrl(fixture.matrixRoomId)
  const results = await Promise.all(removedMemberGateways.map(async (gateway) => {
    const response = await fixture.member.page.request.fetch(`${runtimeUrl}${gateway.suffix}`, {
      method: gateway.method,
      data: gateway.method === 'POST' ? {} : undefined,
    })
    return { gateway, response }
  }))

  for (const { gateway, response } of results) {
    expect(
      response.status(),
      `${gateway.name} should reject a removed Matrix member: ${await response.text()}`,
    ).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SPACE_INSTANCE_NOT_FOUND' },
    })
  }
}

async function readControlPlaneEvidence(
  matrixRoomId: string,
  memberUserId: string,
): Promise<ControlPlaneEvidence> {
  const sqlitePath = resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/local.sqlite')
  const Database = (await import('better-sqlite3')).default
  const db = new Database(sqlitePath, { readonly: true })
  try {
    const room = db.prepare(
      'SELECT space_instance_id, participant_user_ids_json FROM room_index WHERE matrix_room_id = ?',
    ).get(matrixRoomId) as {
      participant_user_ids_json: string
      space_instance_id: string
    } | undefined
    expect(room).toBeTruthy()
    const count = (sql: string, value: string) => (
      db.prepare(sql).get(value) as { count: number }
    ).count
    const user = db.prepare(
      'SELECT credit_balance FROM "user" WHERE id = ?',
    ).get(memberUserId) as { credit_balance: string } | undefined
    expect(user).toBeTruthy()

    return {
      participantUserIds: JSON.parse(room!.participant_user_ids_json) as string[],
      spaceInstanceId: room!.space_instance_id,
      turnCount: count(
        'SELECT COUNT(*) AS count FROM space_runtime_turn WHERE space_instance_id = ?',
        room!.space_instance_id,
      ),
      outboxCount: count(
        'SELECT COUNT(*) AS count FROM space_runtime_outbox WHERE space_instance_id = ?',
        room!.space_instance_id,
      ),
      creditTransactionCount: count(
        'SELECT COUNT(*) AS count FROM credit_transaction WHERE user_id = ?',
        memberUserId,
      ),
      creditBalance: user!.credit_balance,
    }
  } finally {
    db.close()
  }
}

async function assertOwnerStillHasRuntimeAccess(fixture: MembershipFixture) {
  const runtimeUrl = spaceRuntimeUrl(fixture.matrixRoomId)
  const snapshot = await fixture.owner.page.request.get(runtimeUrl)
  expect(snapshot.ok(), await snapshot.text()).toBeTruthy()
  const app = await fixture.owner.page.request.get(`${runtimeUrl}/app?channel=dev`, {
    headers: { accept: 'text/html' },
  })
  expect(app.ok(), await app.text()).toBeTruthy()
  expect(app.headers()['content-type']).toContain('text/html')
}

test.describe('Space Runtime live Matrix membership revocation', () => {
  test.setTimeout(180_000)
  test.skip(
    process.env.E2E_MATRIX_EXPECT_READY !== '1',
    'Requires local Synapse',
  )
  test.skip(
    (process.env.DB_DIALECT || 'sqlite') !== 'sqlite',
    'Stale participant projection and side-effect assertions currently use the local SQLite control plane',
  )

  for (const mode of ['kick', 'leave'] as const) {
    test(`${mode} immediately denies every Runtime gateway despite stale participant projection`, async ({ browser }) => {
      const fixture = await createMembershipFixture(browser, mode)
      try {
        const before = await readControlPlaneEvidence(
          fixture.matrixRoomId,
          fixture.member.bootstrap.user.id,
        )
        expect(before.participantUserIds).toContain(fixture.member.bootstrap.user.id)

        const revokeResponse = mode === 'kick'
          ? await matrixRequest(
              fixture.owner,
              `/rooms/${encodeURIComponent(fixture.matrixRoomId)}/kick`,
              'POST',
              {
                user_id: fixture.member.bootstrap.matrix.userId,
                reason: 'Space Runtime membership revocation E2E',
              },
            )
          : await matrixRequest(
              fixture.member,
              `/rooms/${encodeURIComponent(fixture.matrixRoomId)}/leave`,
              'POST',
              {},
            )
        expect(revokeResponse.ok(), await revokeResponse.text()).toBeTruthy()
        await assertMembershipIsLeave(fixture)

        await assertAllRuntimeGatewaysFailClosed(fixture)

        const after = await readControlPlaneEvidence(
          fixture.matrixRoomId,
          fixture.member.bootstrap.user.id,
        )
        expect(after.participantUserIds).toContain(fixture.member.bootstrap.user.id)
        expect(after).toEqual(before)

        await assertOwnerStillHasRuntimeAccess(fixture)
      } finally {
        await fixture.close()
      }
    })
  }
})
