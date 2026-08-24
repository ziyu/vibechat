import { z } from 'zod'

export const spaceAppChannelSchema = z.enum(['dev', 'live'])
export const spaceAgentIdSchema = z.string().trim().min(1).max(64)

export const spaceRuntimeMessageSchema = z.object({
  id: z.string().min(1),
  turnId: z.string().min(1),
  type: z.enum(['user', 'agent', 'error']),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  text: z.string(),
  createdAt: z.string().datetime(),
})

export const spaceRuntimeSnapshotSchema = z.object({
  spaceInstanceId: z.string().min(1),
  matrixRoomId: z.string().min(1),
  defaultAgentId: spaceAgentIdSchema,
  availableAgents: z.array(z.object({
    id: spaceAgentIdSchema,
    name: z.string().min(1),
    available: z.boolean(),
  })),
  project: z.object({
    exists: z.boolean(),
    draftId: z.string().nullable(),
    releaseId: z.string().nullable(),
    updatedAt: z.string().datetime().nullable(),
    summary: z.string().nullable(),
    template: z.object({
      id: z.string().min(1),
      versionId: z.string().min(1),
      integrity: z.string().min(1),
      sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
      manifestHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
      projectFormat: z.literal('agentos-app-v1'),
    }).nullable(),
  }),
  devPreview: z.object({
    state: z.enum(['idle', 'building', 'ready', 'failed']),
    version: z.string().optional(),
    updatedAt: z.string().datetime().optional(),
    error: z.string().optional(),
  }),
  messages: z.array(spaceRuntimeMessageSchema).default([]),
  build: z.object({
    turnId: z.string(),
    authorName: z.string(),
    requestCount: z.number().int().positive(),
    startedAt: z.string().datetime(),
    stage: z.string(),
    agentText: z.string(),
    agentId: spaceAgentIdSchema,
    activities: z.array(z.record(z.string(), z.unknown())),
  }).nullable().default(null),
  queue: z.object({
    activeCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
  }).default({ activeCount: 0, pendingCount: 0 }),
  appState: z.object({
    revision: z.number().int().nonnegative(),
    state: z.record(z.string(), z.unknown()),
    presence: z.array(z.record(z.string(), z.unknown())),
  }).default({ revision: 0, state: {}, presence: [] }),
})

export const createSpaceAgentTurnRequestSchema = z.object({
  matrixEventId: z.string().min(1).max(255),
  message: z.string().trim().min(1).max(4_000),
  agentId: spaceAgentIdSchema.optional(),
})

export const spaceTurnAcceptedSchema = z.object({
  accepted: z.literal(true),
  deduplicated: z.boolean().default(false),
  turnId: z.string().min(1),
  queuePosition: z.number().int().nonnegative(),
})

export const publishSpaceAppRequestSchema = z.object({
  requestId: z.string().min(1).max(255),
})

export const spaceAppBridgeRequestSchema = z.object({
  action: z.enum([
    'presence.update',
    'state.set',
    'state.delete',
    'event.emit',
    'chat.send',
    'chat.attach',
    'chat.edit',
    'chat.delete',
    'chat.reaction.toggle',
    'chat.retry',
    'chat.typing',
    'chat.markRead',
    'theme.set',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const spaceAppBridgeResponseSchema = z.object({
  ok: z.literal(true),
}).passthrough()

export type SpaceAppChannel = z.infer<typeof spaceAppChannelSchema>
export type SpaceRuntimeSnapshot = z.infer<typeof spaceRuntimeSnapshotSchema>
export type CreateSpaceAgentTurnRequest = z.infer<typeof createSpaceAgentTurnRequestSchema>
export type SpaceTurnAccepted = z.infer<typeof spaceTurnAcceptedSchema>
export type PublishSpaceAppRequest = z.infer<typeof publishSpaceAppRequestSchema>
export type SpaceAppBridgeRequest = z.infer<typeof spaceAppBridgeRequestSchema>
export type SpaceAppBridgeResponse = z.infer<typeof spaceAppBridgeResponseSchema>
