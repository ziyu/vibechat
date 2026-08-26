import type { DurableSpaceControl } from '../../../apps/space-runtime/src/durable-space-control'
import type { SpaceTurnRequest } from '../../../apps/space-runtime/src/space-instance-server'

interface MemorySpaceState {
  sequence: number
  snapshot: Record<string, unknown>
  turns: SpaceTurnRequest[]
  activeTurnId: string | null
  externalRequests: Map<string, string>
}

export function createMemoryDurableSpaceControl(): DurableSpaceControl {
  const spaces = new Map<string, MemorySpaceState>()
  const state = (spaceInstanceId: string) => {
    let current = spaces.get(spaceInstanceId)
    if (!current) {
      current = {
        sequence: 0,
        snapshot: {},
        turns: [],
        activeTurnId: null,
        externalRequests: new Map(),
      }
      spaces.set(spaceInstanceId, current)
    }
    return current
  }

  return {
    description: 'test-memory-control',
    async loadInstance(spaceInstanceId) {
      const current = spaces.get(spaceInstanceId)
      return current
        ? { sequence: current.sequence, snapshot: structuredClone(current.snapshot) }
        : null
    },
    async saveInstance(spaceInstanceId, sequence, snapshot) {
      const current = state(spaceInstanceId)
      current.sequence = Math.max(current.sequence, sequence)
      current.snapshot = structuredClone(snapshot)
    },
    async enqueueTurn(spaceInstanceId, request) {
      const current = state(spaceInstanceId)
      const existingTurnId = current.externalRequests.get(request.externalRequestId)
      if (existingTurnId) return { turnId: existingTurnId, deduplicated: true }
      current.externalRequests.set(request.externalRequestId, request.turnId)
      current.turns.push(structuredClone(request))
      return { turnId: request.turnId, deduplicated: false }
    },
    async claimTurn(spaceInstanceId) {
      const current = state(spaceInstanceId)
      if (current.activeTurnId) return null
      const turn = current.turns.shift() ?? null
      current.activeTurnId = turn?.turnId ?? null
      return turn ? structuredClone(turn) : null
    },
    async completeTurn(spaceInstanceId, turnId) {
      const current = state(spaceInstanceId)
      if (current.activeTurnId !== turnId) return false
      current.activeTurnId = null
      return true
    },
    async heartbeat() {},
    async listRunnableSpaceInstanceIds() {
      return [...spaces.entries()]
        .filter(([, current]) => current.turns.length > 0)
        .map(([spaceInstanceId]) => spaceInstanceId)
    },
    async reconcileOutbox() {},
  }
}
