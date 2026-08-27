import type {
  AgentDefinitionSnapshot,
  SpaceAgentBindingSnapshot,
} from '@vibechat/space-agent-contracts'

export const defaultPiAgentId = 'pi'
export const defaultPiDefinitionId = 'agent-definition-pi-v1'
export const defaultPiDefinitionVersion = '1.0.0'
export const defaultClaudeAgentId = 'claude'
export const defaultClaudeDefinitionId = 'agent-definition-claude-v1'
export const defaultClaudeDefinitionVersion = '1.0.0'

const bootstrapTimestamp = '2026-08-27T00:00:00.000Z'

export const defaultPiDefinition: AgentDefinitionSnapshot = {
  definitionId: defaultPiDefinitionId,
  agentId: defaultPiAgentId,
  version: defaultPiDefinitionVersion,
  adapterKey: 'pi',
  adapterVersion: '0.2.7',
  provider: 'pi',
  model: 'configured',
  capabilities: ['conversation', 'project_patch'],
  toolPolicyId: 'space-agent-tools-default',
  pricingPolicyId: 'space-agent-pricing-default',
  usageSchemaVersion: 'vibechat.agent-usage/v1',
  maxBudgetCredits: 1_000,
  maxConcurrency: 1,
  dataRegionPolicy: { mode: 'any', regions: [] },
  executionPoolPolicy: { mode: 'regional_shared', poolClass: null },
  displayName: 'Pi',
  description: 'Default VibeChat project Agent',
  status: 'active',
  availability: 'available',
  createdAt: bootstrapTimestamp,
  updatedAt: bootstrapTimestamp,
}

export const defaultClaudeDefinition: AgentDefinitionSnapshot = {
  definitionId: defaultClaudeDefinitionId,
  agentId: defaultClaudeAgentId,
  version: defaultClaudeDefinitionVersion,
  adapterKey: 'claude-code',
  adapterVersion: '0.2.7',
  provider: 'anthropic',
  model: 'configured',
  capabilities: ['conversation', 'project_patch'],
  toolPolicyId: 'space-agent-tools-default',
  pricingPolicyId: 'space-agent-pricing-default',
  usageSchemaVersion: 'vibechat.agent-usage/v1',
  maxBudgetCredits: 1_000,
  maxConcurrency: 1,
  dataRegionPolicy: { mode: 'any', regions: [] },
  executionPoolPolicy: { mode: 'regional_shared', poolClass: null },
  displayName: 'Claude Code',
  description: 'Managed Claude Code Agent for VibeChat Space projects',
  status: 'active',
  availability: 'available',
  createdAt: bootstrapTimestamp,
  updatedAt: bootstrapTimestamp,
}

export function createDefaultPiBinding(
  spaceInstanceId: string,
  now: Date,
): SpaceAgentBindingSnapshot {
  const timestamp = now.toISOString()
  return {
    bindingId: `space-agent-binding:${spaceInstanceId}:pi`,
    spaceInstanceId,
    agentId: defaultPiAgentId,
    definitionId: defaultPiDefinitionId,
    definitionVersion: defaultPiDefinitionVersion,
    isDefault: true,
    permissionPolicyId: 'space-agent-permissions-default',
    toolPolicyId: 'space-agent-tools-default',
    budgetPolicy: {
      maxCreditsPerTurn: 1_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 16_000,
    },
    policySnapshotHash: 'sha256:12d800847af14ba6bbf311eaf86cd75b05b546bd0cfe2c299acedf733d8dd0e3',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
