import { z } from 'zod'

const tokenCountSchema = z.number().int().nonnegative()

export const agentUsageV1Schema = z.object({
  schemaVersion: z.literal('vibechat.agent-usage/v1'),
  unit: z.literal('tokens'),
  inputTokens: tokenCountSchema.optional(),
  outputTokens: tokenCountSchema.optional(),
  totalTokens: tokenCountSchema.optional(),
}).strict()

export const legacyAgentUsageSchema = z.object({
  inputTokens: tokenCountSchema.optional(),
  outputTokens: tokenCountSchema.optional(),
  totalTokens: tokenCountSchema.optional(),
}).strict()

export const agentUsageCompatSchema = z.union([
  agentUsageV1Schema,
  legacyAgentUsageSchema,
]).transform((usage) => (
  'schemaVersion' in usage
    ? usage
    : {
        schemaVersion: 'vibechat.agent-usage/v1' as const,
        unit: 'tokens' as const,
        ...usage,
      }
))

export type AgentUsageV1 = z.infer<typeof agentUsageV1Schema>
export type AgentTokenUsage = Pick<AgentUsageV1, 'inputTokens' | 'outputTokens' | 'totalTokens'>
