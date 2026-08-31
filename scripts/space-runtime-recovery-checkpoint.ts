import { deepStrictEqual } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  spaceRuntimeRecoveryManifestSchema,
  type SpaceRuntimeRecoveryManifest,
} from '@vibechat/space-app-contracts'
import {
  signSpaceRuntimeCredential,
  spaceBackendCallbackAudience,
} from '@vibechat/space-runtime-auth'

void main().catch((error) => {
  console.error(
    'Space Runtime recovery checkpoint failed:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
})

async function main() {
  const [command, fileArgument] = process.argv.slice(2)
  if ((command !== 'capture' && command !== 'verify') || !fileArgument) {
    throw new Error(
      'Usage: space-runtime-recovery-checkpoint.ts <capture|verify> <manifest.json>',
    )
  }

  const outputPath = resolve(fileArgument)
  if (command === 'capture') {
    const manifest = await capture()
    assertQuiesced(manifest)
    await verifyContentAddressedObjects(manifest)
    await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })
    console.log(`Captured ${manifest.schemaVersion} at ${outputPath}`)
    return
  }

  const baseline = spaceRuntimeRecoveryManifestSchema.parse(
    JSON.parse(await readFile(outputPath, 'utf8')),
  )
  const recovered = await capture()
  assertQuiesced(recovered)
  await verifyContentAddressedObjects(recovered)
  deepStrictEqual(recoveryIdentity(recovered), recoveryIdentity(baseline))
  console.log(`Verified recovered Space authority against ${outputPath}`)
}

async function capture() {
  const body = {
    action: 'capture_recovery_manifest',
    spaceInstanceId: required('A34_SPACE_INSTANCE_ID'),
  }
  const response = await signedFetch(
    '/v1/internal/space-runtime-control',
    { method: 'POST', body: JSON.stringify(body) },
  )
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Recovery manifest request returned ${response.status}: ${text}`)
  }
  return spaceRuntimeRecoveryManifestSchema.parse(JSON.parse(text).manifest)
}

async function verifyContentAddressedObjects(
  manifest: SpaceRuntimeRecoveryManifest,
) {
  const objectKeys = new Set([
    manifest.project?.sourceObjectKey,
    manifest.project?.artifactObjectKey,
    ...manifest.revisions.map((revision) => revision.sourceObjectKey),
  ].filter((key): key is string => Boolean(key)))
  for (const objectKey of objectKeys) {
    const hash = /^space-runtime\/objects\/([a-f0-9]{64})$/.exec(objectKey)?.[1]
    if (!hash) throw new Error(`Recovery source is not content-addressed: ${objectKey}`)
    const response = await signedFetch(
      `/v1/internal/space-runtime-objects/${hash}`,
    )
    const content = new Uint8Array(await response.arrayBuffer())
    if (!response.ok) {
      throw new Error(`Recovery object ${objectKey} returned ${response.status}`)
    }
    const actual = await sha256(content)
    if (actual !== `sha256:${hash}`) {
      throw new Error(`Recovery object ${objectKey} failed SHA-256 validation`)
    }
  }
}

async function signedFetch(path: string, init: RequestInit = {}) {
  const origin = new URL(required('A34_BACKEND_ORIGIN')).origin
  const method = (init.method || 'GET').toUpperCase()
  const credential = await signSpaceRuntimeCredential({
    secret: required('SPACE_RUNTIME_INTERNAL_TOKEN'),
    audience: spaceBackendCallbackAudience,
    subject: 'space-runtime',
    method,
    path,
    ttlSeconds: 60,
  })
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${credential}`)
  if (init.body) headers.set('content-type', 'application/json')
  return fetch(new URL(path, origin), { ...init, headers })
}

function assertQuiesced(manifest: SpaceRuntimeRecoveryManifest) {
  const activeTurns = manifest.turns.find((entry) => entry.status === 'active')?.count || 0
  const activeOutbox = manifest.outbox.find((entry) => entry.status === 'processing')?.count || 0
  if (activeTurns > 0 || activeOutbox > 0) {
    throw new Error(
      `Recovery checkpoint requires a quiesced Space; active turns=${activeTurns}, processing outbox=${activeOutbox}`,
    )
  }
  if (!manifest.project || !manifest.project.readyRevisionId) {
    throw new Error('Recovery checkpoint requires a ready Project Revision')
  }
}

function recoveryIdentity(manifest: SpaceRuntimeRecoveryManifest) {
  return {
    spaceInstanceId: manifest.spaceInstanceId,
    instance: manifest.instance && {
      sequence: manifest.instance.sequence,
      snapshotHash: manifest.instance.snapshotHash,
    },
    project: manifest.project && {
      projectId: manifest.project.projectId,
      spaceInstanceId: manifest.project.spaceInstanceId,
      sourceObjectKey: manifest.project.sourceObjectKey,
      sourceHash: manifest.project.sourceHash,
      artifactObjectKey: manifest.project.artifactObjectKey,
      artifactHash: manifest.project.artifactHash,
      readyRevisionId: manifest.project.readyRevisionId,
      publishedRevisionId: manifest.project.publishedRevisionId,
      releaseId: manifest.project.releaseId,
    },
    revisions: manifest.revisions.map((revision) => ({
      projectId: revision.projectId,
      revisionId: revision.revisionId,
      parentRevisionId: revision.parentRevisionId,
      sourceObjectKey: revision.sourceObjectKey,
      sourceHash: revision.sourceHash,
    })).sort((left, right) => left.revisionId.localeCompare(right.revisionId)),
    agentSessions: manifest.agentSessions.map((session) => ({
      sessionId: session.sessionId,
      agentId: session.agentId,
      definitionId: session.definitionId,
      definitionVersion: session.definitionVersion,
      adapterKey: session.adapterKey,
      adapterVersion: session.adapterVersion,
      generation: session.generation,
      summaryHash: session.summaryHash,
      restoreStatus: session.restoreStatus,
      lastTurnId: session.lastTurnId,
    })).sort((left, right) => left.sessionId.localeCompare(right.sessionId)),
    turns: [...manifest.turns].sort((left, right) => left.status.localeCompare(right.status)),
    outbox: [...manifest.outbox].sort((left, right) => left.status.localeCompare(right.status)),
  }
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

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}
