import { z } from 'zod'
import { agentErrorV1Schema } from './error.js'
import { agentTurnIdSchema } from './identifiers.js'
import { agentUsageV1Schema } from './usage.js'

const eventBase = {
  schemaVersion: z.literal('vibechat.agent-event/v1'),
  eventId: z.string().trim().min(1).max(255),
  turnId: agentTurnIdSchema,
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
}

export const agentEventV1Schema = z.discriminatedUnion('type', [
  z.object({
    ...eventBase,
    type: z.literal('status'),
    stage: z.string().trim().min(1).max(128),
    message: z.string().trim().max(1_000).optional(),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal('text_delta'),
    text: z.string().min(1).max(16_000),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal('tool_activity'),
    tool: z.string().trim().min(1).max(128),
    activity: z.string().trim().min(1).max(128),
    status: z.enum(['started', 'completed', 'failed']),
    summary: z.string().trim().max(1_000).optional(),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal('project_patch'),
    baseRevisionId: z.string().trim().min(1).max(255),
    patchRef: z.string().trim().min(1).max(1_024),
    sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    filesChanged: z.array(z.string().trim().min(1).max(512)).max(1_000),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal('usage'),
    usage: agentUsageV1Schema,
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal('completed'),
    outcome: z.enum(['conversation', 'revision']),
    summary: z.string().trim().max(4_000),
    projectRevisionId: z.string().trim().min(1).max(255).optional(),
    usage: agentUsageV1Schema.optional(),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal('failed'),
    error: agentErrorV1Schema,
    usage: agentUsageV1Schema.optional(),
  }).strict(),
])

export type AgentEventV1 = z.infer<typeof agentEventV1Schema>
