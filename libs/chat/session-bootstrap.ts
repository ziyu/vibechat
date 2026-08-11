import { z } from 'zod'

export const sessionBootstrapSchema = z.object({
  contractVersion: z.literal(1),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  matrix: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('unavailable'),
      reason: z.literal('SYNAPSE_NOT_CONFIGURED'),
    }),
    z.object({
      status: z.literal('ready'),
      homeserverUrl: z.string().url(),
      userId: z.string().min(1),
      deviceId: z.string().min(1),
      accessToken: z.string().min(1),
    }),
  ]),
})

export const productApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()),
    requestId: z.string().min(1),
  }),
})

export type SessionBootstrap = z.infer<typeof sessionBootstrapSchema>
export type ProductApiError = z.infer<typeof productApiErrorSchema>
