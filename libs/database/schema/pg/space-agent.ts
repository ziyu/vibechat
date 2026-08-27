import { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const spaceAgentDefinition = pgTable('space_agent_definition', {
  definitionId: text('definition_id').primaryKey(),
  agentId: text('agent_id').notNull(),
  version: text('version').notNull(),
  adapterKey: text('adapter_key').notNull(),
  adapterVersion: text('adapter_version').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  capabilitiesJson: jsonb('capabilities_json').$type<string[]>().notNull().default([]),
  toolPolicyId: text('tool_policy_id').notNull(),
  pricingPolicyId: text('pricing_policy_id').notNull(),
  usageSchemaVersion: text('usage_schema_version').notNull(),
  maxBudgetCredits: integer('max_budget_credits').notNull(),
  maxConcurrency: integer('max_concurrency').notNull(),
  dataRegionPolicyJson: jsonb('data_region_policy_json')
    .$type<{ mode: 'any' | 'allowlist' | 'required'; regions: string[] }>()
    .notNull(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('active'),
  availability: text('availability').notNull().default('available'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('space_agent_definition_agent_version_idx').on(table.agentId, table.version),
  index('space_agent_definition_status_idx').on(table.agentId, table.status),
])

export const spaceAgentBinding = pgTable('space_agent_binding', {
  bindingId: text('binding_id').primaryKey(),
  spaceInstanceId: text('space_instance_id').notNull(),
  agentId: text('agent_id').notNull(),
  definitionId: text('definition_id').notNull(),
  definitionVersion: text('definition_version').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  permissionPolicyId: text('permission_policy_id').notNull(),
  toolPolicyId: text('tool_policy_id').notNull(),
  budgetPolicyJson: jsonb('budget_policy_json').$type<{
    maxCreditsPerTurn: number
    maxInputTokens: number
    maxOutputTokens: number
  }>().notNull(),
  policySnapshotHash: text('policy_snapshot_hash').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('space_agent_binding_space_agent_idx').on(table.spaceInstanceId, table.agentId),
  index('space_agent_binding_default_idx').on(table.spaceInstanceId, table.isDefault, table.status),
])

export const spaceAgentSession = pgTable('space_agent_session', {
  sessionId: text('session_id').primaryKey(),
  spaceInstanceId: text('space_instance_id').notNull(),
  agentId: text('agent_id').notNull(),
  definitionId: text('definition_id').notNull(),
  definitionVersion: text('definition_version').notNull(),
  adapterKey: text('adapter_key').notNull(),
  adapterVersion: text('adapter_version').notNull(),
  generation: integer('generation').notNull(),
  providerSessionRef: text('provider_session_ref'),
  summaryRef: text('summary_ref'),
  summaryHash: text('summary_hash'),
  region: text('region').notNull(),
  restoreStatus: text('restore_status').notNull().default('ready'),
  lastTurnId: text('last_turn_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('space_agent_session_generation_idx')
    .on(table.spaceInstanceId, table.agentId, table.generation),
  index('space_agent_session_lookup_idx').on(table.spaceInstanceId, table.agentId, table.updatedAt),
])

export const spaceAgentAuditEvent = pgTable('space_agent_audit_event', {
  eventId: text('event_id').primaryKey(),
  spaceInstanceId: text('space_instance_id').notNull(),
  agentId: text('agent_id').notNull(),
  definitionId: text('definition_id'),
  sessionId: text('session_id'),
  turnId: text('turn_id'),
  eventType: text('event_type').notNull(),
  policySnapshotHash: text('policy_snapshot_hash'),
  resultJson: jsonb('result_json').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('space_agent_audit_space_created_idx').on(table.spaceInstanceId, table.createdAt),
  index('space_agent_audit_turn_idx').on(table.turnId),
])

export type SpaceAgentDefinitionRow = InferSelectModel<typeof spaceAgentDefinition>
export type NewSpaceAgentDefinitionRow = InferInsertModel<typeof spaceAgentDefinition>
export type SpaceAgentBindingRow = InferSelectModel<typeof spaceAgentBinding>
export type NewSpaceAgentBindingRow = InferInsertModel<typeof spaceAgentBinding>
export type SpaceAgentSessionRow = InferSelectModel<typeof spaceAgentSession>
export type NewSpaceAgentSessionRow = InferInsertModel<typeof spaceAgentSession>
export type SpaceAgentAuditEventRow = InferSelectModel<typeof spaceAgentAuditEvent>
export type NewSpaceAgentAuditEventRow = InferInsertModel<typeof spaceAgentAuditEvent>
