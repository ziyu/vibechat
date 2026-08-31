import { asc, count, desc, eq, max } from 'drizzle-orm'
import {
  db,
  spaceAgentSession,
  spaceRuntimeInstanceState,
  spaceRuntimeLease,
  spaceRuntimeOutbox,
  spaceRuntimeProject,
  spaceRuntimeProjectRevision,
  spaceRuntimeTurn,
} from '@libs/database'
import {
  spaceRuntimeRecoveryManifestSchema,
  type SpaceRuntimeRecoveryManifest,
} from '@vibechat/space-app-contracts'

/**
 * Captures a bounded, content-free checkpoint used to verify that Product DB
 * and Object Store recovery agree. Provider refs, prompts, message bodies,
 * Project source, App State values, and Outbox payloads are intentionally
 * excluded from the manifest.
 */
export async function captureSpaceRuntimeRecoveryManifest(
  spaceInstanceId: string,
  capturedAt = new Date(),
): Promise<SpaceRuntimeRecoveryManifest> {
  const [
    instanceRows,
    projectRows,
    revisionRows,
    leaseRows,
    sessionRows,
    turnRows,
    outboxRows,
  ] = await Promise.all([
    db.select().from(spaceRuntimeInstanceState)
      .where(eq(spaceRuntimeInstanceState.spaceInstanceId, spaceInstanceId))
      .limit(1),
    db.select().from(spaceRuntimeProject)
      .where(eq(spaceRuntimeProject.spaceInstanceId, spaceInstanceId))
      .limit(1),
    db.select().from(spaceRuntimeProjectRevision)
      .where(eq(spaceRuntimeProjectRevision.spaceInstanceId, spaceInstanceId))
      .orderBy(desc(spaceRuntimeProjectRevision.createdAt))
      .limit(200),
    db.select().from(spaceRuntimeLease)
      .where(eq(spaceRuntimeLease.spaceInstanceId, spaceInstanceId))
      .limit(1),
    db.select({
      sessionId: spaceAgentSession.sessionId,
      agentId: spaceAgentSession.agentId,
      definitionId: spaceAgentSession.definitionId,
      definitionVersion: spaceAgentSession.definitionVersion,
      adapterKey: spaceAgentSession.adapterKey,
      adapterVersion: spaceAgentSession.adapterVersion,
      generation: spaceAgentSession.generation,
      summaryHash: spaceAgentSession.summaryHash,
      restoreStatus: spaceAgentSession.restoreStatus,
      lastTurnId: spaceAgentSession.lastTurnId,
      updatedAt: spaceAgentSession.updatedAt,
    }).from(spaceAgentSession)
      .where(eq(spaceAgentSession.spaceInstanceId, spaceInstanceId))
      .orderBy(asc(spaceAgentSession.agentId), desc(spaceAgentSession.generation))
      .limit(200),
    db.select({
      status: spaceRuntimeTurn.status,
      count: count(),
      maximumAttempt: max(spaceRuntimeTurn.attempt),
    }).from(spaceRuntimeTurn)
      .where(eq(spaceRuntimeTurn.spaceInstanceId, spaceInstanceId))
      .groupBy(spaceRuntimeTurn.status)
      .orderBy(asc(spaceRuntimeTurn.status)),
    db.select({
      status: spaceRuntimeOutbox.status,
      count: count(),
      maximumAttempt: max(spaceRuntimeOutbox.attempt),
    }).from(spaceRuntimeOutbox)
      .where(eq(spaceRuntimeOutbox.spaceInstanceId, spaceInstanceId))
      .groupBy(spaceRuntimeOutbox.status)
      .orderBy(asc(spaceRuntimeOutbox.status)),
  ])

  const instance = instanceRows[0]
  const project = projectRows[0]
  const lease = leaseRows[0]
  return spaceRuntimeRecoveryManifestSchema.parse({
    schemaVersion: 'vibechat.space-runtime-recovery-manifest/v1',
    capturedAt: capturedAt.toISOString(),
    spaceInstanceId,
    instance: instance
      ? {
          sequence: instance.sequence,
          snapshotHash: await hashJson(instance.snapshotJson),
          fencingToken: instance.fencingToken,
          updatedAt: instance.updatedAt.toISOString(),
        }
      : null,
    project: project
      ? {
          projectId: project.projectId,
          spaceInstanceId: project.spaceInstanceId,
          sourceObjectKey: project.sourceObjectKey,
          sourceHash: project.sourceHash,
          artifactObjectKey: project.artifactObjectKey,
          artifactHash: project.artifactHash,
          readyRevisionId: project.readyRevisionId,
          publishedRevisionId: project.publishedRevisionId,
          releaseId: project.releaseId,
          metadata: project.metadataJson,
          fencingToken: project.fencingToken,
          updatedAt: project.updatedAt.toISOString(),
        }
      : null,
    revisions: revisionRows.map((revision) => ({
      spaceInstanceId: revision.spaceInstanceId,
      projectId: revision.projectId,
      revisionId: revision.revisionId,
      parentRevisionId: revision.parentRevisionId,
      sourceObjectKey: revision.sourceObjectKey,
      sourceHash: revision.sourceHash,
      metadata: revision.metadataJson,
      fencingToken: revision.fencingToken,
      createdAt: revision.createdAt.toISOString(),
    })),
    lease: lease
      ? {
          spaceInstanceId: lease.spaceInstanceId,
          ownerId: lease.ownerId,
          fencingToken: lease.fencingToken,
          expiresAt: lease.expiresAt.toISOString(),
        }
      : null,
    agentSessions: sessionRows.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
    })),
    turns: turnRows.map((row) => ({
      status: row.status,
      count: Number(row.count),
      maximumAttempt: Number(row.maximumAttempt ?? 0),
    })),
    outbox: outboxRows.map((row) => ({
      status: row.status,
      count: Number(row.count),
      maximumAttempt: Number(row.maximumAttempt ?? 0),
    })),
  })
}

async function hashJson(value: unknown): Promise<`sha256:${string}`> {
  const content = new TextEncoder().encode(stableJson(value))
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(content).buffer,
  )
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
