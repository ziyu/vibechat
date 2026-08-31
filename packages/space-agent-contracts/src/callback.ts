import { z } from 'zod'
import { agentTurnIdSchema, spaceAgentIdSchema } from './identifiers.js'
import { agentUsageCompatSchema, agentUsageV1Schema, legacyAgentUsageSchema } from './usage.js'

const completionFields = {
  userId: z.string().min(1),
  spaceInstanceId: z.string().min(1).max(255),
  matrixRoomId: z.string().min(1).max(255),
  turnId: agentTurnIdSchema,
  agentId: spaceAgentIdSchema,
  agentName: z.string().trim().min(1).max(128),
  sourceEventIds: z.array(z.string().min(1).max(255)).min(1).max(32),
  reply: z.object({
    text: z.string().trim().min(1).max(64_000),
  }).strict(),
}

export const spaceAgentCompletionCallbackV1Schema = z.object({
  schemaVersion: z.literal('vibechat.space-agent-completion/v1'),
  ...completionFields,
}).strict()

const legacySpaceAgentCompletionCallbackSchema = z.object(completionFields).strict()

export const spaceAgentCompletionCallbackSchema = z.union([
  spaceAgentCompletionCallbackV1Schema,
  legacySpaceAgentCompletionCallbackSchema,
]).transform((callback) => (
  'schemaVersion' in callback
    ? callback
    : {
        schemaVersion: 'vibechat.space-agent-completion/v1' as const,
        ...callback,
      }
))

const billingFields = {
  spaceInstanceId: z.string().min(1).max(255),
  turnId: agentTurnIdSchema,
  userId: z.string().min(1),
  requestId: z.string().min(1),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  reservedCredits: z.number().int().positive(),
  transactionId: z.string().min(1).max(255),
  status: z.enum(['completed', 'failed']),
}

export const spaceAgentBillingCallbackV1Schema = z.object({
  schemaVersion: z.literal('vibechat.space-agent-billing/v1'),
  ...billingFields,
  usage: agentUsageV1Schema.optional(),
}).strict()

const legacySpaceAgentBillingCallbackSchema = z.object({
  ...billingFields,
  usage: legacyAgentUsageSchema.optional(),
}).strict()

export const spaceAgentBillingCallbackSchema = z.union([
  spaceAgentBillingCallbackV1Schema,
  legacySpaceAgentBillingCallbackSchema,
]).transform((callback) => ({
  ...callback,
  schemaVersion: 'vibechat.space-agent-billing/v1' as const,
  ...(callback.usage ? { usage: agentUsageCompatSchema.parse(callback.usage) } : {}),
}))

export type SpaceAgentCompletionCallbackV1 = z.infer<typeof spaceAgentCompletionCallbackSchema>
export type SpaceAgentBillingCallbackV1 = z.infer<typeof spaceAgentBillingCallbackSchema>
