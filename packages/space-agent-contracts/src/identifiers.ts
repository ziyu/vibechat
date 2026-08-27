import { z } from 'zod'

const boundedId = z.string().trim().min(1).max(255)

export const spaceAgentIdSchema = z.string().trim().min(1).max(64)
export const agentDefinitionIdSchema = boundedId
export const agentBindingIdSchema = boundedId
export const agentSessionIdSchema = boundedId
export const agentTurnIdSchema = boundedId
export const agentVersionSchema = z.string().trim().regex(
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/,
  'Agent version must be a canonical semantic version',
)
export const agentAdapterKeySchema = z.string().trim().min(1).max(64)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
export const agentAdapterVersionSchema = z.string().trim().min(1).max(64)

export type SpaceAgentId = z.infer<typeof spaceAgentIdSchema>
export type AgentDefinitionId = z.infer<typeof agentDefinitionIdSchema>
export type AgentBindingId = z.infer<typeof agentBindingIdSchema>
export type AgentSessionId = z.infer<typeof agentSessionIdSchema>
export type AgentTurnId = z.infer<typeof agentTurnIdSchema>
