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

export const agentSessionSummaryV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-session-summary/v1'),
  sessionId: agentSessionIdSchema,
  generation: z.number().int().positive(),
  sourceTurnId: agentTurnIdSchema,
  summaryRef: z.string().trim().min(1).max(1_024),
  summaryHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
}).strict()

const restoredAgentSessionSchema = agentSessionRefV1Schema.refine(
  (session) => session.restoreStatus === 'ready',
  'A restored Agent session must be ready',
)
const rebuildRequiredAgentSessionSchema = agentSessionRefV1Schema.refine(
  (session) => session.restoreStatus === 'rebuild_required',
  'A session that cannot be restored must request a rebuild',
)

export const agentSessionRestoreResultV1Schema = z.discriminatedUnion('status', [
  z.object({
    schemaVersion: z.literal('vibechat.agent-session-restore/v1'),
    status: z.literal('restored'),
    session: restoredAgentSessionSchema,
  }).strict(),
  z.object({
    schemaVersion: z.literal('vibechat.agent-session-restore/v1'),
    status: z.literal('rebuild_required'),
    session: rebuildRequiredAgentSessionSchema,
    reason: z.string().trim().min(1).max(512),
  }).strict(),
])

export type AgentSessionRefV1 = z.infer<typeof agentSessionRefV1Schema>
export type AgentSessionSummaryV1 = z.infer<typeof agentSessionSummaryV1Schema>
export type AgentSessionRestoreResultV1 = z.infer<typeof agentSessionRestoreResultV1Schema>
