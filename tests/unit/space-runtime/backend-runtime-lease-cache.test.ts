import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackendDurableSpaceControl } from '../../../apps/space-runtime/src/durable-space-control'
import { BackendRemoteProjectStore } from '../../../apps/space-runtime/src/remote-project-store'

const spaceInstanceId = 'space-instance-lease-cache'
const sourceHash = `sha256:${'a'.repeat(64)}` as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Backend Runtime lease caches', () => {
  it('revalidates a cached instance lease after an early control-plane release', async () => {
    let fencingToken = 1
    let renewalCount = 0
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = requestBody(init)
      if (body.action === 'claim_lease') {
        return Response.json({ lease: lease(fencingToken) })
      }
      if (body.action === 'renew_lease') {
        renewalCount += 1
        return Response.json({
          lease: leaseToken(body.lease) === fencingToken
            ? lease(fencingToken)
            : null,
        })
      }
      if (body.action === 'save_instance') {
        return leaseToken(body.lease) === fencingToken
          ? Response.json({ instance: body.instance })
          : Response.json({ error: 'runtime_fenced' }, { status: 409 })
      }
      throw new Error(`Unexpected control action ${String(body.action)}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const control = new BackendDurableSpaceControl(
      'http://backend.test',
      'test-runtime-signing-secret-at-least-32-chars',
    )
    await control.heartbeat(spaceInstanceId)

    // An empty claim can release token 1 while its serialized expiresAt is still
    // in the future. A later owner cycle advances the authoritative fence.
    fencingToken = 2

    await expect(control.saveInstance(spaceInstanceId, 1, { ok: true }))
      .resolves.toBeUndefined()
    expect(renewalCount).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('revalidates a cached Project lease before crossing a fencing generation', async () => {
    let fencingToken = 1
    let renewalCount = 0
    let pointer: Record<string, unknown> | null = null
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.startsWith('/v1/internal/space-runtime-objects/')) {
        return Response.json({
          objectKey: `space-runtime/objects/${'b'.repeat(64)}`,
        })
      }

      const body = requestBody(init)
      if (body.action === 'load_project') {
        return Response.json({ projectId: 'project-1', project: pointer })
      }
      if (body.action === 'claim_lease') {
        return Response.json({ lease: lease(fencingToken) })
      }
      if (body.action === 'renew_lease') {
        renewalCount += 1
        return Response.json({
          lease: leaseToken(body.lease) === fencingToken
            ? lease(fencingToken)
            : null,
        })
      }
      if (body.action === 'save_project') {
        if (leaseToken(body.lease) !== fencingToken) {
          return Response.json({ error: 'runtime_fenced' }, { status: 409 })
        }
        pointer = {
          ...(body.project as Record<string, unknown>),
          fencingToken,
          updatedAt: new Date().toISOString(),
        }
        return Response.json({ project: pointer })
      }
      throw new Error(`Unexpected control action ${String(body.action)}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = new BackendRemoteProjectStore(
      'http://backend.test',
      'test-runtime-signing-secret-at-least-32-chars',
    )
    const project = {
      appId: spaceInstanceId,
      files: { 'src/index.ts': 'export const value = 1' },
      sourceHash,
      summary: 'Lease cache regression fixture',
      updatedAt: new Date().toISOString(),
    }
    await store.save(project)

    fencingToken = 2

    await expect(store.save({ ...project, summary: 'Updated fixture' }))
      .resolves.toMatchObject({ summary: 'Updated fixture' })
    expect(renewalCount).toBe(1)
  })
})

function lease(fencingToken: number) {
  return {
    spaceInstanceId,
    ownerId: 'runtime-replica-test',
    fencingToken,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }
}

function requestBody(init?: RequestInit) {
  if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body')
  return JSON.parse(init.body) as Record<string, unknown>
}

function leaseToken(value: unknown) {
  return Number((value as { fencingToken?: unknown } | undefined)?.fencingToken)
}
