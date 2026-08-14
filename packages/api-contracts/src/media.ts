import { z } from 'zod'

export const uploadImageResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    key: z.string(),
    url: z.string().url(),
    size: z.number(),
    contentType: z.string(),
    originalName: z.string(),
    provider: z.string(),
    expiresAt: z.union([z.string(), z.date()]).optional(),
  }),
})
