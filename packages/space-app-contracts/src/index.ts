import { z } from 'zod'
import { spaceAgentIdSchema } from '@vibechat/space-agent-contracts'

export {
  spaceAgentBillingCallbackSchema,
  spaceAgentCompletionCallbackSchema,
  spaceAgentIdSchema,
} from '@vibechat/space-agent-contracts'
export type {
  SpaceAgentBillingCallbackV1 as SpaceAgentBillingCallback,
  SpaceAgentCompletionCallbackV1 as SpaceAgentCompletionCallback,
} from '@vibechat/space-agent-contracts'

export const spaceAppChannelSchema = z.enum(['dev', 'live'])
export const spaceAgentMentionSchema = z.object({
  type: z.literal('agent'),
  id: spaceAgentIdSchema,
})
export const spaceAgentMentionsEventContentKey = 'io.vibechat.agent_mentions' as const
export const spaceAgentReplyEventContentKey = 'io.vibechat.agent' as const
export const spaceAgentMemberEventContentKey = 'io.vibechat.agent_member' as const

export const spaceAgentMemberMetadataSchema = z.object({
  schemaVersion: z.literal('vibechat.space-agent-member/v1'),
  agentId: spaceAgentIdSchema,
})

export const spaceAgentReplyMetadataSchema = z.object({
  schemaVersion: z.literal('vibechat.space-agent-message/v1'),
  agentId: spaceAgentIdSchema,
  turnId: z.string().min(1).max(255),
  sourceEventIds: z.array(z.string().min(1).max(255)).min(1).max(32),
})

export const spaceRuntimeStateCallbackSchema = z.object({
  spaceInstanceId: z.string().min(1).max(255),
  readyRevisionId: z.string().min(1).max(255),
  publishedRevisionId: z.string().min(1).max(255).nullable(),
  releaseId: z.string().min(1).max(255).nullable(),
  sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  sequence: z.number().int().nonnegative(),
})

export const spaceRuntimeLeaseSchema = z.object({
  spaceInstanceId: z.string().min(1).max(255),
  ownerId: z.string().min(1).max(255),
  fencingToken: z.number().int().positive(),
  expiresAt: z.string().datetime(),
})

export const spaceRuntimeProjectPointerSchema = z.object({
  projectId: z.string().min(1).max(255),
  spaceInstanceId: z.string().min(1).max(255),
  sourceObjectKey: z.string().min(1).max(512).nullable(),
  sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
  artifactObjectKey: z.string().min(1).max(512).nullable(),
  artifactHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
  readyRevisionId: z.string().min(1).max(255).nullable(),
  publishedRevisionId: z.string().min(1).max(255).nullable(),
  releaseId: z.string().min(1).max(255).nullable(),
  metadata: z.record(z.string(), z.unknown()),
  fencingToken: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
})

export const spaceRuntimeControlRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('claim_lease'),
    spaceInstanceId: z.string().min(1).max(255),
    ownerId: z.string().min(1).max(255),
    ttlMs: z.number().int().min(1_000).max(300_000),
  }),
  z.object({
    action: z.literal('renew_lease'),
    lease: spaceRuntimeLeaseSchema,
    ttlMs: z.number().int().min(1_000).max(300_000),
  }),
  z.object({
    action: z.literal('release_lease'),
    lease: spaceRuntimeLeaseSchema,
  }),
  z.object({
    action: z.literal('load_project'),
    spaceInstanceId: z.string().min(1).max(255),
  }),
  z.object({
    action: z.literal('save_project'),
    lease: spaceRuntimeLeaseSchema,
    project: spaceRuntimeProjectPointerSchema.omit({
      fencingToken: true,
      updatedAt: true,
    }),
  }),
  z.object({
    action: z.literal('load_instance'),
    spaceInstanceId: z.string().min(1).max(255),
  }),
  z.object({
    action: z.literal('save_instance'),
    lease: spaceRuntimeLeaseSchema,
    instance: z.object({
      spaceInstanceId: z.string().min(1).max(255),
      sequence: z.number().int().nonnegative(),
      snapshot: z.record(z.string(), z.unknown()),
    }),
  }),
  z.object({
    action: z.literal('enqueue_turn'),
    turn: z.object({
      turnId: z.string().min(1).max(255),
      spaceInstanceId: z.string().min(1).max(255),
      externalRequestId: z.string().min(1).max(255),
      kind: z.enum(['message', 'publish', 'restore']),
      payload: z.record(z.string(), z.unknown()),
    }),
  }),
  z.object({
    action: z.literal('claim_turn'),
    spaceInstanceId: z.string().min(1).max(255),
    ownerId: z.string().min(1).max(255),
    ttlMs: z.number().int().min(1_000).max(300_000),
  }),
  z.object({
    action: z.literal('complete_turn'),
    turnId: z.string().min(1).max(255),
    lease: spaceRuntimeLeaseSchema,
    status: z.enum(['completed', 'failed']),
  }),
  z.object({
    action: z.literal('list_runnable_instances'),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  z.object({
    action: z.literal('reconcile_outbox'),
  }),
])

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
  agentMention: spaceAgentMentionSchema,
})

export const spaceTurnAcceptedSchema = z.object({
  accepted: z.literal(true),
  deduplicated: z.boolean().default(false),
  turnId: z.string().min(1),
  queuePosition: z.number().int().nonnegative(),
})

export const publishSpaceAppRequestSchema = z.object({
  requestId: z.string().min(1).max(255),
  expectedReadyRevisionId: z.string().regex(/^[a-f0-9]{16}$/),
})

export const restoreSpaceAppRequestSchema = z.object({
  requestId: z.string().min(1).max(255),
  target: z.literal('default-chat'),
  expectedReadyRevisionId: z.string().regex(/^[a-f0-9]{16}$/),
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
export type SpaceAgentMention = z.infer<typeof spaceAgentMentionSchema>
export type SpaceAgentMemberMetadata = z.infer<typeof spaceAgentMemberMetadataSchema>
export type SpaceAgentReplyMetadata = z.infer<typeof spaceAgentReplyMetadataSchema>
export type SpaceRuntimeStateCallback = z.infer<typeof spaceRuntimeStateCallbackSchema>
export type SpaceRuntimeLease = z.infer<typeof spaceRuntimeLeaseSchema>
export type SpaceRuntimeProjectPointer = z.infer<typeof spaceRuntimeProjectPointerSchema>
export type SpaceRuntimeControlRequest = z.infer<typeof spaceRuntimeControlRequestSchema>
export type SpaceRuntimeSnapshot = z.infer<typeof spaceRuntimeSnapshotSchema>
export type CreateSpaceAgentTurnRequest = z.infer<typeof createSpaceAgentTurnRequestSchema>
export type SpaceTurnAccepted = z.infer<typeof spaceTurnAcceptedSchema>
export type PublishSpaceAppRequest = z.infer<typeof publishSpaceAppRequestSchema>
export type RestoreSpaceAppRequest = z.infer<typeof restoreSpaceAppRequestSchema>
export type SpaceAppBridgeRequest = z.infer<typeof spaceAppBridgeRequestSchema>
export type SpaceAppBridgeResponse = z.infer<typeof spaceAppBridgeResponseSchema>
