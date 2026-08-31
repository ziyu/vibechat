import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'

/**
 * Stable operator-visible identity used by Product DB leases and fencing.
 * Production deployment validation requires SPACE_RUNTIME_REPLICA_ID; the
 * generated fallback only exists for local development and isolated tests.
 */
export const runtimeReplicaOwnerId =
  process.env.SPACE_RUNTIME_REPLICA_ID?.trim()
  || `${hostname()}:${process.pid}:${randomUUID()}`
