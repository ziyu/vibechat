import { z } from 'zod'

export const imageProviderSchema = z.enum(['qwen', 'fal', 'openai', 'gemini'])
export const videoProviderSchema = z.enum(['fal', 'volcengine', 'aliyun'])

export const imageGenerationResultSchema = z.object({
  imageUrl: z.string().min(1),
  width: z.number().optional(),
  height: z.number().optional(),
  provider: imageProviderSchema,
  model: z.string(),
  seed: z.number().optional(),
})

export const imageGenerationInputSchema = z.object({
  requestId: z.string().min(8).max(128),
  prompt: z.string().trim().min(1).max(4000),
  provider: imageProviderSchema,
  model: z.string().min(1),
  negativePrompt: z.string().max(2000).optional(),
  size: z.string().optional(),
  aspectRatio: z.string().optional(),
  seed: z.number().int().optional(),
  promptExtend: z.boolean().optional(),
  watermark: z.boolean().optional(),
  numInferenceSteps: z.number().min(1).max(50).optional(),
  guidanceScale: z.number().min(1).max(20).optional(),
})

export const imageGenerationResponseSchema = z.object({
  success: z.literal(true),
  data: imageGenerationResultSchema,
  idempotent: z.boolean().optional(),
  credits: z.object({ consumed: z.number(), remaining: z.number() }),
})

export const videoGenerationResultSchema = z.object({
  videoUrl: z.string().min(1),
  duration: z.number().optional(),
  provider: videoProviderSchema,
  model: z.string(),
  coverImageUrl: z.string().optional(),
})

export const videoGenerationInputSchema = z.object({
  requestId: z.string().min(8).max(128),
  prompt: z.string().trim().min(1).max(4000),
  provider: videoProviderSchema,
  model: z.string().min(1),
  size: z.string().optional(),
  aspectRatio: z.string().optional(),
  duration: z.number().int().min(1).max(30).optional(),
  seed: z.number().int().optional(),
  loop: z.boolean().optional(),
  motionStrength: z.number().min(0).max(1).optional(),
  promptExtend: z.boolean().optional(),
  watermark: z.boolean().optional(),
  firstFrameUrl: z.string().url().optional(),
  lastFrameUrl: z.string().url().optional(),
})

export const asyncVideoTaskSchema = z.object({
  taskId: z.string(),
  status: z.enum(['processing', 'succeeded', 'failed']),
  async: z.literal(true).optional(),
  provider: videoProviderSchema.optional(),
  model: z.string().optional(),
})

export const videoGenerationResponseSchema = z.object({
  success: z.literal(true),
  data: z.union([videoGenerationResultSchema, asyncVideoTaskSchema]),
  credits: z.object({ consumed: z.number(), remaining: z.number() }),
})

export const videoTaskStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    taskId: z.string(),
    status: z.enum(['processing', 'succeeded', 'failed']),
    result: videoGenerationResultSchema.optional(),
    error: z.string().optional(),
  }),
  credits: z.object({ remaining: z.number() }).optional(),
})

export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>
export type ImageGenerationResult = z.infer<typeof imageGenerationResultSchema>
export type VideoGenerationInput = z.infer<typeof videoGenerationInputSchema>
export type VideoGenerationResult = z.infer<typeof videoGenerationResultSchema>
export type VideoGenerationResponse = z.infer<typeof videoGenerationResponseSchema>
export type VideoTaskStatusResponse = z.infer<typeof videoTaskStatusResponseSchema>
