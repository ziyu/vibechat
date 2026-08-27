export interface SpaceAgentAuditEvent {
  eventId: string
  spaceInstanceId: string
  agentId: string
  definitionId: string | null
  sessionId: string | null
  turnId: string | null
  eventType: string
  policySnapshotHash: string | null
  result: Record<string, unknown>
  createdAt: Date
}

export interface SpaceAgentAuditRepository {
  appendAuditEvent(event: SpaceAgentAuditEvent): Promise<void>
  listAuditEvents(input: {
    spaceInstanceId?: string
    agentId?: string
    limit: number
  }): Promise<SpaceAgentAuditEvent[]>
}

export class SpaceAgentAuditService {
  constructor(private readonly repository: SpaceAgentAuditRepository) {}

  async record(event: SpaceAgentAuditEvent) {
    const serialized = JSON.stringify(event.result)
    if (serialized.length > 4_096) {
      throw new Error('Space Agent audit result must not exceed 4096 serialized characters')
    }
    await this.repository.appendAuditEvent(event)
  }
}
