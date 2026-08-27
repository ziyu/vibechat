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
const leaseRenewalWindowMs = 10_000

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

class BackendRemoteProjectStore implements RemoteProjectStore {
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
    const source = await this.#readObject(
      loaded.project.sourceObjectKey,
      `Space Project ${appId} source`,
    )
    const project = JSON.parse(source) as StoredProject
    if (loaded.project.artifactObjectKey || loaded.project.artifactHash) {
      if (!loaded.project.artifactObjectKey || !loaded.project.artifactHash) {
        throw new Error(`Space Project ${appId} has an incomplete prepared artifact pointer`)
      }
      const artifact = JSON.parse(await this.#readObject(
        loaded.project.artifactObjectKey,
        `Space Project ${appId} prepared artifact`,
      )) as NonNullable<StoredProject['prepared']>
      if (artifact.artifactHash !== loaded.project.artifactHash) {
        throw new Error(`Space Project ${appId} prepared artifact hash does not match its pointer`)
      }
      return { ...project, prepared: artifact }
    }
    return project
  }

  async save(project: StoredProject) {
    if (!project.sourceHash) throw new Error('Space Project source hash is required')
    const loaded = await this.#loadPointer(project.appId)
    const lease = await this.#lease(project.appId)
    const { prepared, ...sourceProject } = project
    const sourceObjectKey = await this.#writeObject(sourceProject)
    const artifactObjectKey = prepared
      ? await this.#writeObject(prepared)
      : null
    const controlResponse = await this.#control({
      action: 'save_project',
      lease,
      project: {
        projectId: loaded.projectId,
        spaceInstanceId: project.appId,
        sourceObjectKey,
        sourceHash: project.sourceHash,
        artifactObjectKey,
        artifactHash: prepared?.artifactHash ?? null,
        readyRevisionId: project.draftId ?? null,
        publishedRevisionId: project.publishedDraftId ?? null,
        releaseId: project.releaseId ?? null,
        metadata: {
          format: 'vibechat.stored-project/v1',
          sourceBlobHash: `sha256:${objectHashFromKey(sourceObjectKey)}`,
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

  async #readObject(objectKey: string | null, label: string) {
    const objectHash = objectHashFromKey(objectKey)
    if (!objectHash) throw new Error(`${label} has no valid object key`)
    const response = await this.#fetch(
      `/v1/internal/space-runtime-objects/${objectHash}`,
      { method: 'GET' },
    )
    if (!response.ok) throw new Error(`${label} read returned ${response.status}`)
    return response.text()
  }

  async #writeObject(value: unknown) {
    const content = new TextEncoder().encode(`${JSON.stringify(value)}\n`)
    const objectHash = await sha256Hex(content)
    const response = await this.#fetch(
      `/v1/internal/space-runtime-objects/${objectHash}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: content,
      },
    )
    if (!response.ok) {
      throw new Error(`Space Project object write returned ${response.status}`)
    }
    const object = await response.json() as { objectKey?: unknown }
    if (
      typeof object.objectKey !== 'string'
      || objectHashFromKey(object.objectKey) !== objectHash
    ) {
      throw new Error('Space Project object write returned an invalid pointer')
    }
    return object.objectKey
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
      const remainingMs = new Date(current.expiresAt).getTime() - Date.now()
      if (remainingMs > leaseRenewalWindowMs) return current
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
