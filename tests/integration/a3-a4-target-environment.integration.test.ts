import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  spaceRuntimeRecoveryManifestSchema,
  type SpaceRuntimeRecoveryManifest,
} from '@vibechat/space-app-contracts'
import {
  signSpaceRuntimeCredential,
  spaceBackendCallbackAudience,
  spaceRuntimeAudience,
} from '@vibechat/space-runtime-auth'

const describeWithTarget = process.env.RUN_A3_A4_TARGET_ACCEPTANCE === '1'
  ? describe
  : describe.skip

interface TargetConfig {
  backendOrigin: string
  runtimeOrigins: [string, string]
  engineIdentity: string
  spaceInstanceId: string
  matrixHomeserverOrigin: string
  matrixRoomId: string
  matrixAccessToken: string
  internalSigningSecret: string
  engineMetricsEndpoint: string
  dedicatedAgentPool: string
  expectedRegion?: string
  cloudflareAccountId: string
  cloudflareApiToken: string
  d1DatabaseId: string
  r2AccessKeyId: string
  r2AccessKeySecret: string
  r2Bucket: string
}

let config: TargetConfig
let initialManifest: SpaceRuntimeRecoveryManifest
let s3: S3Client

describeWithTarget('A3/A4 target environment acceptance', () => {
  beforeAll(() => {
    const runtimeOrigins = commaSeparated('A34_RUNTIME_ORIGINS').map(origin)
    if (runtimeOrigins.length !== 2 || new Set(runtimeOrigins).size !== 2) {
      throw new Error('A34_RUNTIME_ORIGINS must contain exactly two distinct Runtime origins')
    }
    config = {
      backendOrigin: origin(required('A34_BACKEND_ORIGIN')),
      runtimeOrigins: [runtimeOrigins[0]!, runtimeOrigins[1]!],
      engineIdentity: publicEngineIdentity(required('A34_ENGINE_ENDPOINT')),
      spaceInstanceId: required('A34_SPACE_INSTANCE_ID'),
      matrixHomeserverOrigin: origin(required('A34_MATRIX_HOMESERVER_URL')),
      matrixRoomId: required('A34_MATRIX_ROOM_ID'),
      matrixAccessToken: required('A34_MATRIX_ACCESS_TOKEN'),
      internalSigningSecret: required('SPACE_RUNTIME_INTERNAL_TOKEN'),
      engineMetricsEndpoint: url(required('A34_ENGINE_METRICS_ENDPOINT')),
      dedicatedAgentPool: required('A34_DEDICATED_AGENT_POOL'),
      expectedRegion: process.env.A34_EXPECTED_REGION?.trim() || undefined,
      cloudflareAccountId: required('CLOUDFLARE_ACCOUNT_ID'),
      cloudflareApiToken: required('CLOUDFLARE_API_TOKEN'),
      d1DatabaseId: required('A34_D1_DATABASE_ID'),
      r2AccessKeyId: required('R2_ACCESS_KEY_ID'),
      r2AccessKeySecret: required('R2_ACCESS_KEY_SECRET'),
      r2Bucket: required('R2_BUCKET'),
    }
    if (config.matrixRoomId !== process.env.A34_MATRIX_ROOM_ID) {
      throw new Error('A34_MATRIX_ROOM_ID must be an exact Matrix room ID')
    }
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.cloudflareAccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2AccessKeySecret,
      },
    })
  })

  afterAll(() => s3?.destroy())

  it('uses two distinct Runtime replicas, one external regional Engine, and isolated active pools', async () => {
    const health = await Promise.all(
      config.runtimeOrigins.map(async (runtimeOrigin) => {
        const response = await fetch(`${runtimeOrigin}/api/health`)
        return readJson(response) as Promise<any>
      }),
    )
    expect(new Set(health.map((entry) => entry.deployment.replicaId)).size).toBe(2)
    expect(new Set(health.map((entry) => entry.deployment.engineIdentity)).size).toBe(1)
    expect(new Set(health.map((entry) => entry.deployment.region)).size).toBe(1)
    for (const entry of health) {
      expect(entry).toMatchObject({
        ok: true,
        projectStore: 'product-db+object-store',
        deployment: {
          engineMode: 'external',
          engineOwnership: 'external',
          poolRoutingEnforced: true,
          engineIdentity: config.engineIdentity,
        },
        internalAuthConfigured: true,
      })
      const pools = Object.values(entry.deployment.executionPools)
      expect(new Set(pools).size).toBe(3)
      if (config.expectedRegion) {
        expect(entry.deployment.region).toBe(config.expectedRegion)
      }
    }

    const metricsResponse = await fetch(config.engineMetricsEndpoint)
    const metrics = await metricsResponse.text()
    expect(metricsResponse.status, metrics).toBe(200)
    const requiredPools = new Set([
      ...Object.values(health[0].deployment.executionPools) as string[],
      config.dedicatedAgentPool,
    ])
    for (const pool of requiredPools) {
      expect(activeConnections(metrics, pool), `${pool} must have an active worker`).toBeGreaterThan(0)
    }
  }, 30_000)

  it('reads the same D1 authority and content-addressed R2 Project/Revision objects', async () => {
    const backendHealth = await fetch(`${config.backendOrigin}/api/health`)
    await expect(readJson(backendHealth)).resolves.toMatchObject({
      status: 'healthy',
      environment: 'production',
      checks: { database: { status: 'healthy' } },
    })

    initialManifest = await captureRecoveryManifest()
    expect(initialManifest.project).not.toBeNull()
    expect(initialManifest.project?.readyRevisionId).toMatch(/^[a-f0-9]{16}$/)
    expect(initialManifest.revisions.length).toBeGreaterThan(0)
    expect(initialManifest.revisions.some(
      (revision) => revision.revisionId === initialManifest.project?.readyRevisionId,
    )).toBe(true)

    const d1Response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.cloudflareAccountId)}/d1/database/${encodeURIComponent(config.d1DatabaseId)}/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.cloudflareApiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sql: [
            'SELECT project_id, source_object_key, source_hash, artifact_object_key,',
            'artifact_hash, ready_revision_id, published_revision_id, release_id',
            'FROM space_runtime_project WHERE space_instance_id = ? LIMIT 1',
          ].join(' '),
          params: [config.spaceInstanceId],
        }),
      },
    )
    const d1 = await readJson(d1Response) as any
    expect(d1.success).toBe(true)
    expect(d1.result?.[0]?.results?.[0]).toMatchObject({
      project_id: initialManifest.project!.projectId,
      source_object_key: initialManifest.project!.sourceObjectKey,
      source_hash: initialManifest.project!.sourceHash,
      artifact_object_key: initialManifest.project!.artifactObjectKey,
      artifact_hash: initialManifest.project!.artifactHash,
      ready_revision_id: initialManifest.project!.readyRevisionId,
      published_revision_id: initialManifest.project!.publishedRevisionId,
      release_id: initialManifest.project!.releaseId,
    })

    const sourceKeys = new Set([
      initialManifest.project!.sourceObjectKey,
      initialManifest.project!.artifactObjectKey,
      ...initialManifest.revisions.map((revision) => revision.sourceObjectKey),
    ].filter((key): key is string => Boolean(key)))
    for (const objectKey of sourceKeys) {
      const expectedHash = objectHash(objectKey)
      expect(expectedHash, `${objectKey} must be content-addressed`).toBeTruthy()
      const [backendObject, r2Object] = await Promise.all([
        readBackendObject(expectedHash!),
        readR2Object(objectKey),
      ])
      expect(await sha256(backendObject)).toBe(`sha256:${expectedHash}`)
      expect(await sha256(r2Object)).toBe(`sha256:${expectedHash}`)
      expect(Buffer.from(r2Object).equals(Buffer.from(backendObject))).toBe(true)
    }
  }, 60_000)

  it('fences an expired owner and restores the fixed Dev Revision and Release through both replicas', async () => {
    const project = initialManifest.project
    if (!project?.readyRevisionId) throw new Error('Acceptance Space has no ready Revision')
    const currentLease = initialManifest.lease
    if (currentLease && new Date(currentLease.expiresAt).getTime() > Date.now()) {
      throw new Error(
        `Acceptance Space is not idle; lease ${currentLease.ownerId} is active until ${currentLease.expiresAt}`,
      )
    }
    const health = await Promise.all(config.runtimeOrigins.map((runtimeOrigin) =>
      fetch(`${runtimeOrigin}/api/health`).then(readJson) as Promise<any>,
    ))
    const ownerA = health[0].deployment.replicaId as string
    const ownerB = health[1].deployment.replicaId as string
    const leaseA = await control({
      action: 'claim_lease',
      spaceInstanceId: config.spaceInstanceId,
      ownerId: ownerA,
      ttlMs: 1_000,
    }).then((body) => body.lease)
    expect(leaseA).toBeTruthy()
    await expect(control({
      action: 'claim_lease',
      spaceInstanceId: config.spaceInstanceId,
      ownerId: ownerB,
      ttlMs: 1_000,
    })).resolves.toMatchObject({ lease: null })

    await new Promise((resolve) => setTimeout(resolve, 1_250))
    const leaseB = await control({
      action: 'claim_lease',
      spaceInstanceId: config.spaceInstanceId,
      ownerId: ownerB,
      ttlMs: 30_000,
    }).then((body) => body.lease)
    expect(leaseB.fencingToken).toBeGreaterThan(leaseA.fencingToken)
    try {
      const staleWrite = await signedFetch(
        config.backendOrigin,
        '/v1/internal/space-runtime-control',
        spaceBackendCallbackAudience,
        'space-runtime',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'save_project',
            lease: leaseA,
            project: {
              projectId: project.projectId,
              spaceInstanceId: project.spaceInstanceId,
              sourceObjectKey: project.sourceObjectKey,
              sourceHash: project.sourceHash,
              artifactObjectKey: project.artifactObjectKey,
              artifactHash: project.artifactHash,
              readyRevisionId: project.readyRevisionId,
              publishedRevisionId: project.publishedRevisionId,
              releaseId: project.releaseId,
              metadata: project.metadata,
            },
          }),
        },
      )
      expect(staleWrite.status, await staleWrite.text()).toBe(409)
    } finally {
      await control({ action: 'release_lease', lease: leaseB })
    }

    for (const runtimeOrigin of config.runtimeOrigins) {
      const fixedDev = await signedFetch(
        runtimeOrigin,
        `/runtime/dev/apps/${encodeURIComponent(config.spaceInstanceId)}/?version=${encodeURIComponent(project.readyRevisionId)}`,
        spaceRuntimeAudience,
        'vibechat-backend',
      )
      expect(fixedDev.status, await fixedDev.text()).toBe(200)
      if (project.releaseId) {
        const live = await signedFetch(
          runtimeOrigin,
          `/runtime/apps/${encodeURIComponent(config.spaceInstanceId)}/`,
          spaceRuntimeAudience,
          'vibechat-backend',
        )
        expect(live.status, await live.text()).toBe(200)
      }
    }
  }, 90_000)

  it('matches the recovered Product DB pointers with the real Matrix room state and timeline', async () => {
    const statePath = `/_matrix/client/v3/rooms/${encodeURIComponent(config.matrixRoomId)}/state/${encodeURIComponent('io.vibechat.space.instance.v2')}/`
    const stateResponse = await matrixFetch(statePath)
    await expect(readJson(stateResponse)).resolves.toMatchObject({
      schemaVersion: 'vibechat.space-instance/v2',
      spaceInstanceId: config.spaceInstanceId,
      projectId: initialManifest.project!.projectId,
      readyRevisionId: initialManifest.project!.readyRevisionId,
      publishedRevisionId: initialManifest.project!.publishedRevisionId,
      releaseId: initialManifest.project!.releaseId,
    })
    const timelineResponse = await matrixFetch(
      `/_matrix/client/v3/rooms/${encodeURIComponent(config.matrixRoomId)}/messages?dir=b&limit=100`,
    )
    const timeline = await readJson(timelineResponse) as any
    expect(Array.isArray(timeline.chunk)).toBe(true)
    expect(timeline.chunk.some((event: any) => event.type === 'm.room.message')).toBe(true)

    const recovered = await captureRecoveryManifest()
    expect(recovered.project).toMatchObject({
      projectId: initialManifest.project!.projectId,
      sourceObjectKey: initialManifest.project!.sourceObjectKey,
      sourceHash: initialManifest.project!.sourceHash,
      readyRevisionId: initialManifest.project!.readyRevisionId,
      publishedRevisionId: initialManifest.project!.publishedRevisionId,
      releaseId: initialManifest.project!.releaseId,
    })
    expect(recovered.instance?.snapshotHash).toBe(initialManifest.instance?.snapshotHash)
    expect(recovered.agentSessions.map(sessionIdentity)).toEqual(
      initialManifest.agentSessions.map(sessionIdentity),
    )
    expect(recovered.turns).toEqual(initialManifest.turns)
    expect(recovered.outbox).toEqual(initialManifest.outbox)
  }, 30_000)
})

async function captureRecoveryManifest() {
  const body = await control({
    action: 'capture_recovery_manifest',
    spaceInstanceId: config.spaceInstanceId,
  })
  return spaceRuntimeRecoveryManifestSchema.parse(body.manifest)
}

async function control(body: Record<string, unknown>) {
  const response = await signedFetch(
    config.backendOrigin,
    '/v1/internal/space-runtime-control',
    spaceBackendCallbackAudience,
    'space-runtime',
    { method: 'POST', body: JSON.stringify(body) },
  )
  return readJson(response) as Promise<any>
}

async function readBackendObject(hash: string) {
  const response = await signedFetch(
    config.backendOrigin,
    `/v1/internal/space-runtime-objects/${hash}`,
    spaceBackendCallbackAudience,
    'space-runtime',
  )
  const content = new Uint8Array(await response.arrayBuffer())
  expect(response.status, new TextDecoder().decode(content)).toBe(200)
  return content
}

async function readR2Object(objectKey: string) {
  const object = await s3.send(new GetObjectCommand({
    Bucket: config.r2Bucket,
    Key: objectKey,
  }))
  if (!object.Body) throw new Error(`R2 object ${objectKey} returned no body`)
  return new Uint8Array(await object.Body.transformToByteArray())
}

async function signedFetch(
  targetOrigin: string,
  path: string,
  audience: typeof spaceRuntimeAudience | typeof spaceBackendCallbackAudience,
  subject: string,
  init: RequestInit = {},
) {
  const method = (init.method || 'GET').toUpperCase()
  const credential = await signSpaceRuntimeCredential({
    secret: config.internalSigningSecret,
    audience,
    subject,
    method,
    path: new URL(path, targetOrigin).pathname,
    ttlSeconds: 60,
  })
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${credential}`)
  if (init.body) headers.set('content-type', 'application/json')
  return fetch(new URL(path, targetOrigin), { ...init, headers })
}

function matrixFetch(path: string) {
  return fetch(new URL(path, config.matrixHomeserverOrigin), {
    headers: { authorization: `Bearer ${config.matrixAccessToken}` },
  })
}

async function readJson(response: Response) {
  const text = await response.text()
  expect(response.status, text).toBe(200)
  return JSON.parse(text)
}

function activeConnections(metrics: string, poolName: string) {
  return metrics.split('\n')
    .filter((line) => line.startsWith('envoy_connection_active{')
      && line.includes(`pool_name="${poolName}"`))
    .reduce((total, line) => total + Number(line.split(' ').at(-1) || 0), 0)
}

function objectHash(objectKey: string) {
  return /^space-runtime\/objects\/([a-f0-9]{64})$/.exec(objectKey)?.[1] ?? null
}

async function sha256(content: Uint8Array): Promise<`sha256:${string}`> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(content).buffer,
  )
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

function sessionIdentity(session: SpaceRuntimeRecoveryManifest['agentSessions'][number]) {
  return {
    agentId: session.agentId,
    definitionId: session.definitionId,
    definitionVersion: session.definitionVersion,
    generation: session.generation,
    summaryHash: session.summaryHash,
    restoreStatus: session.restoreStatus,
    lastTurnId: session.lastTurnId,
  }
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for A3/A4 target acceptance`)
  return value
}

function commaSeparated(name: string) {
  return required(name).split(',').map((entry) => entry.trim()).filter(Boolean)
}

function origin(value: string) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Expected an HTTP(S) origin, received ${parsed.protocol}`)
  }
  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw new Error('Target origins must not contain credentials, paths, query, or fragments')
  }
  return parsed.origin
}

function url(value: string) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Expected an HTTP(S) URL, received ${parsed.protocol}`)
  }
  if (parsed.username || parsed.password) {
    throw new Error('Target URLs must not contain credentials')
  }
  return parsed.toString()
}

function publicEngineIdentity(value: string) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Expected an HTTP(S) Engine URL, received ${parsed.protocol}`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Engine URL must not contain credentials, query, or fragments')
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
}
