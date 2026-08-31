import {
  defaultClaudeDefinition,
  defaultPiDefinition,
  SpaceAgentGovernanceService,
} from '@libs/space-agents'
import { DatabaseSpaceAgentRepository } from '@libs/space-agents/database-repository'

export async function createSpaceAgentGovernanceService() {
  const repository = new DatabaseSpaceAgentRepository()
  await Promise.all([
    repository.upsertDefinition(defaultPiDefinition),
    repository.upsertDefinition(defaultClaudeDefinition),
  ])
  return new SpaceAgentGovernanceService(repository, {
    allowedAdapterKeys: new Set(['pi', 'claude-code']),
    allowedDedicatedPoolClasses: new Set(
      commaSeparatedValues(process.env.SPACE_AGENT_DEDICATED_POOL_ALLOWLIST),
    ),
  })
}

function commaSeparatedValues(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
