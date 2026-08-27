import { z } from 'zod'
import {
  agentAdapterKeySchema,
  agentAdapterVersionSchema,
  agentBindingIdSchema,
  agentDefinitionIdSchema,
  agentVersionSchema,
  spaceAgentIdSchema,
} from './identifiers.js'

export const agentDefinitionStatusSchema = z.enum(['active', 'frozen', 'retired'])
export const agentAvailabilitySchema = z.enum(['available', 'degraded', 'unavailable'])
export const agentBindingStatusSchema = z.enum(['active', 'disabled'])

export const agentDataRegionPolicySchema = z.object({
  mode: z.enum(['any', 'allowlist', 'required']),
  regions: z.array(z.string().trim().min(1).max(64)).max(32),
}).strict()

export const agentDefinitionSnapshotSchema = z.object({
  definitionId: agentDefinitionIdSchema,
  agentId: spaceAgentIdSchema,
  version: agentVersionSchema,
  adapterKey: agentAdapterKeySchema,
  adapterVersion: agentAdapterVersionSchema,
  provider: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(128),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(64),
  toolPolicyId: z.string().trim().min(1).max(255),
  pricingPolicyId: z.string().trim().min(1).max(255),
  usageSchemaVersion: z.literal('vibechat.agent-usage/v1'),
  maxBudgetCredits: z.number().int().nonnegative(),
  maxConcurrency: z.number().int().positive().max(1_000),
  dataRegionPolicy: agentDataRegionPolicySchema,
  displayName: z.string().trim().min(1).max(128),
  description: z.string().trim().max(2_000),
  status: agentDefinitionStatusSchema,
  availability: agentAvailabilitySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const agentDefinitionPublicSnapshotSchema = agentDefinitionSnapshotSchema.pick({
  definitionId: true,
  agentId: true,
  version: true,
  capabilities: true,
  displayName: true,
  description: true,
  status: true,
  availability: true,
  createdAt: true,
  updatedAt: true,
}).strict()

export const agentBudgetPolicySnapshotSchema = z.object({
  maxCreditsPerTurn: z.number().int().nonnegative(),
  maxInputTokens: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().nonnegative(),
}).strict()

export const spaceAgentBindingSnapshotSchema = z.object({
  bindingId: agentBindingIdSchema,
  spaceInstanceId: z.string().trim().min(1).max(255),
  agentId: spaceAgentIdSchema,
  definitionId: agentDefinitionIdSchema,
  definitionVersion: agentVersionSchema,
  isDefault: z.boolean(),
  permissionPolicyId: z.string().trim().min(1).max(255),
  toolPolicyId: z.string().trim().min(1).max(255),
  budgetPolicy: agentBudgetPolicySnapshotSchema,
  policySnapshotHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  status: agentBindingStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const spaceAgentBindingPublicSnapshotSchema = spaceAgentBindingSnapshotSchema.pick({
  bindingId: true,
  spaceInstanceId: true,
  agentId: true,
  definitionId: true,
  definitionVersion: true,
  isDefault: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).strict()

export const spaceAgentPublicViewSchema = z.object({
  binding: spaceAgentBindingPublicSnapshotSchema,
  definition: agentDefinitionPublicSnapshotSchema.nullable(),
}).strict()

export type AgentDefinitionSnapshot = z.infer<typeof agentDefinitionSnapshotSchema>
export type AgentDefinitionPublicSnapshot = z.infer<typeof agentDefinitionPublicSnapshotSchema>
export type SpaceAgentBindingSnapshot = z.infer<typeof spaceAgentBindingSnapshotSchema>
export type SpaceAgentBindingPublicSnapshot = z.infer<typeof spaceAgentBindingPublicSnapshotSchema>
export type SpaceAgentPublicView = z.infer<typeof spaceAgentPublicViewSchema>
export type AgentBudgetPolicySnapshot = z.infer<typeof agentBudgetPolicySnapshotSchema>
