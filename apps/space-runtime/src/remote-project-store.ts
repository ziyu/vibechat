import {
  spaceRuntimeLeaseSchema,
  spaceRuntimeProjectPointerSchema,
  type SpaceRuntimeLease,
  type SpaceRuntimeProjectPointer,
} from '@vibechat/space-app-contracts'
import {
  signSpaceRuntimeCredential,
  spaceBackendCallbackAudience,
} from '@vibechat/space-runtime-auth'
import type { StoredProject } from './project-store.js'
import { runtimeReplicaOwnerId } from './runtime-replica.js'

const controlPath = '/v1/internal/space-runtime-control'
const leaseTtlMs = 30_000

export interface RemoteProjectStore {
  load(appId: string): Promise<StoredProject | null>
  save(project: StoredProject): Promise<StoredProject>
}

export function createRemoteProjectStoreFromEnv(): RemoteProjectStore {
  const origin = process.env.SPACE_RUNTIME_CALLBACK_ORIGIN?.trim()
  const signingSecret = process.env.SPACE_RUNTIME_INTERNAL_TOKEN?.trim()
  if (!origin || !signingSecret) {
    throw new Error(
      'Space Runtime requires SPACE_RUNTIME_CALLBACK_ORIGIN and SPACE_RUNTIME_INTERNAL_TOKEN',
    )
  }
  return new BackendRemoteProjectStore(origin, signingSecret)
}

export class BackendRemoteProjectStore implements RemoteProjectStore {
  readonly #origin: string
  readonly #signingSecret: string
  readonly #ownerId = runtimeReplicaOwnerId
  readonly #leases = new Map<string, SpaceRuntimeLease>()

  constructor(origin: string, signingSecret: string) {
    this.#origin = new URL(origin).origin
    this.#signingSecret = signingSecret
  }

  async load(appId: string) {
    const loaded = await this.#loadPointer(appId)
    if (!loaded.project) return null
    const objectHash = objectHashFromKey(loaded.project.sourceObjectKey)
    if (!objectHash) throw new Error(`Space Project ${appId} has no valid source object`)
    const response = await this.#fetch(
      `/v1/internal/space-runtime-objects/${objectHash}`,
      { method: 'GET' },
    )
    if (!response.ok) {
      throw new Error(`Space Project object read returned ${response.status}`)
    }
    return JSON.parse(await response.text()) as StoredProject
  }

  async save(project: StoredProject) {
    if (!project.sourceHash) throw new Error('Space Project source hash is required')
    const loaded = await this.#loadPointer(project.appId)
    const lease = await this.#lease(project.appId)
    const content = new TextEncoder().encode(`${JSON.stringify(project)}\n`)
    const objectHash = await sha256Hex(content)
    const objectResponse = await this.#fetch(
      `/v1/internal/space-runtime-objects/${objectHash}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: content,
      },
    )
    if (!objectResponse.ok) {
      throw new Error(`Space Project object write returned ${objectResponse.status}`)
    }
    const object = await objectResponse.json() as { objectKey?: unknown }
    if (typeof object.objectKey !== 'string') {
      throw new Error('Space Project object write returned an invalid pointer')
    }
    const controlResponse = await this.#control({
      action: 'save_project',
      lease,
      project: {
        projectId: loaded.projectId,
        spaceInstanceId: project.appId,
        sourceObjectKey: object.objectKey,
        sourceHash: project.sourceHash,
        artifactObjectKey: loaded.project?.artifactObjectKey ?? null,
        artifactHash: loaded.project?.artifactHash ?? null,
        readyRevisionId: project.draftId ?? null,
        publishedRevisionId: project.publishedDraftId ?? null,
        releaseId: project.releaseId ?? null,
        metadata: {
          format: 'vibechat.stored-project/v1',
          sourceBlobHash: `sha256:${objectHash}`,
          summary: project.summary,
          template: project.template ?? null,
        },
      },
    })
    if (controlResponse.status === 409) {
      this.#leases.delete(project.appId)
      throw new Error(`Space Runtime owner was fenced for ${project.appId}`)
    }
    if (!controlResponse.ok) {
      throw new Error(`Space Project pointer write returned ${controlResponse.status}`)
    }
    const body = await controlResponse.json() as { project?: unknown }
    spaceRuntimeProjectPointerSchema.parse(body.project)
    return project
  }

  async #loadPointer(appId: string): Promise<{
    projectId: string
    project: SpaceRuntimeProjectPointer | null
  }> {
    const response = await this.#control({ action: 'load_project', spaceInstanceId: appId })
    if (!response.ok) throw new Error(`Space Project pointer read returned ${response.status}`)
    const body = await response.json() as { projectId?: unknown; project?: unknown }
    if (typeof body.projectId !== 'string' || !body.projectId) {
      throw new Error('Space Project pointer read returned no projectId')
    }
    return {
      projectId: body.projectId,
      project: body.project ? spaceRuntimeProjectPointerSchema.parse(body.project) : null,
    }
  }

  async #lease(spaceInstanceId: string) {
    const current = this.#leases.get(spaceInstanceId)
    if (current) {
      // The turn control path can release this replica's lease before the
      // advertised expiry. Confirm cached ownership before persisting a Project
      // so an independently cached token cannot cross a fencing generation.
      const renewed = await this.#control({
        action: 'renew_lease',
        lease: current,
        ttlMs: leaseTtlMs,
      })
      if (renewed.ok) {
        const body = await renewed.json() as { lease?: unknown }
        if (body.lease) {
          const lease = spaceRuntimeLeaseSchema.parse(body.lease)
          this.#leases.set(spaceInstanceId, lease)
          return lease
        }
      }
      this.#leases.delete(spaceInstanceId)
    }
    const claimed = await this.#control({
      action: 'claim_lease',
      spaceInstanceId,
      ownerId: this.#ownerId,
      ttlMs: leaseTtlMs,
    })
    if (!claimed.ok) throw new Error(`Space Runtime lease claim returned ${claimed.status}`)
    const body = await claimed.json() as { lease?: unknown }
    const lease = body.lease ? spaceRuntimeLeaseSchema.parse(body.lease) : null
    if (!lease) throw new Error(`Space Runtime lease is held by another replica for ${spaceInstanceId}`)
    this.#leases.set(spaceInstanceId, lease)
    return lease
  }

  #control(body: Record<string, unknown>) {
    return this.#fetch(controlPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async #fetch(path: string, init: RequestInit) {
    const method = init.method || 'GET'
    const credential = await signSpaceRuntimeCredential({
      secret: this.#signingSecret,
      audience: spaceBackendCallbackAudience,
      subject: 'space-runtime',
      method,
      path,
      ttlSeconds: 60,
    })
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${credential}`)
    return fetch(new URL(path, this.#origin), { ...init, headers })
  }
}

function objectHashFromKey(objectKey: string | null) {
  return /^space-runtime\/objects\/([a-f0-9]{64})$/.exec(objectKey || '')?.[1] ?? null
}

async function sha256Hex(content: Uint8Array) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(content).buffer,
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
