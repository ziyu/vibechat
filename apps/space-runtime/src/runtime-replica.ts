import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'

export const runtimeReplicaOwnerId = `${hostname()}:${process.pid}:${randomUUID()}`
