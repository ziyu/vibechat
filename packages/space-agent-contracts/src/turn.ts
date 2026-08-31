import { z } from 'zod'
import { agentDefinitionSnapshotSchema } from './definition.js'
import {
  agentSessionIdSchema,
  agentTurnIdSchema,
  spaceAgentIdSchema,
} from './identifiers.js'

export const agentPolicySnapshotV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-policy/v1'),
  policySnapshotHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  permissionPolicyId: z.string().trim().min(1).max(255),
  toolPolicyId: z.string().trim().min(1).max(255),
  pricingPolicyId: z.string().trim().min(1).max(255),
  maxCredits: z.number().int().nonnegative(),
  maxInputTokens: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().nonnegative(),
  allowedTools: z.array(z.string().trim().min(1).max(128)).max(128),
}).strict()

export const agentContextReferenceV1Schema = z.object({
  matrixEventIds: z.array(z.string().min(1).max(255)).min(1).max(64),
  messageWindowRef: z.string().trim().min(1).max(1_024).nullable(),
  summaryRef: z.string().trim().min(1).max(1_024).nullable(),
}).strict()

export const agentProjectRevisionRefV1Schema = z.object({
  projectId: z.string().trim().min(1).max(255),
  revisionId: z.string().trim().min(1).max(255),
  sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict()

export const agentTurnInputV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-turn-input/v1'),
  turnId: agentTurnIdSchema,
  spaceInstanceId: z.string().trim().min(1).max(255),
  agentId: spaceAgentIdSchema,
  sessionId: agentSessionIdSchema,
  sessionGeneration: z.number().int().positive(),
  definition: agentDefinitionSnapshotSchema,
  policy: agentPolicySnapshotV1Schema,
  context: agentContextReferenceV1Schema,
  project: agentProjectRevisionRefV1Schema,
  requestText: z.string().trim().min(1).max(16_000),
  requestedAt: z.string().datetime(),
}).strict()

export const agentTurnCancelReasonSchema = z.enum([
  'user_requested',
  'lease_lost',
  'timeout',
  'runtime_shutdown',
])

export const cancelAgentTurnInputV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-turn-cancel/v1'),
  turnId: agentTurnIdSchema,
  spaceInstanceId: z.string().trim().min(1).max(255),
  agentId: spaceAgentIdSchema,
  sessionId: agentSessionIdSchema,
  sessionGeneration: z.number().int().positive(),
  reason: agentTurnCancelReasonSchema,
  requestedAt: z.string().datetime(),
}).strict()

export type AgentPolicySnapshotV1 = z.infer<typeof agentPolicySnapshotV1Schema>
export type AgentTurnInputV1 = z.infer<typeof agentTurnInputV1Schema>
export type CancelAgentTurnInputV1 = z.infer<typeof cancelAgentTurnInputV1Schema>
export type AgentTurnCancelReason = z.infer<typeof agentTurnCancelReasonSchema>
