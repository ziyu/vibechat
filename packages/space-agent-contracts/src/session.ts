import { z } from 'zod'
import {
  agentAdapterKeySchema,
  agentAdapterVersionSchema,
  agentDefinitionIdSchema,
  agentSessionIdSchema,
  agentTurnIdSchema,
  agentVersionSchema,
  spaceAgentIdSchema,
} from './identifiers.js'

export const agentSessionRestoreStatusSchema = z.enum([
  'ready',
  'restoring',
  'rebuild_required',
  'failed',
  'closed',
])

export const agentSessionRefV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-session-ref/v1'),
  sessionId: agentSessionIdSchema,
  spaceInstanceId: z.string().trim().min(1).max(255),
  agentId: spaceAgentIdSchema,
  definitionId: agentDefinitionIdSchema,
  definitionVersion: agentVersionSchema,
  adapterKey: agentAdapterKeySchema,
  adapterVersion: agentAdapterVersionSchema,
  generation: z.number().int().positive(),
  providerSessionRef: z.string().trim().min(1).max(1_024).nullable(),
  summaryRef: z.string().trim().min(1).max(1_024).nullable(),
  summaryHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
  region: z.string().trim().min(1).max(64),
  restoreStatus: agentSessionRestoreStatusSchema,
  lastTurnId: agentTurnIdSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export type AgentSessionRefV1 = z.infer<typeof agentSessionRefV1Schema>
