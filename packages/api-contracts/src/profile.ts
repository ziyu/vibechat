import { z } from 'zod'

export const productProfileSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  // Read legacy derived values defensively; all new writes are capped at 30.
  username: z.string().min(3).max(64),
  displayName: z.string().min(1).max(50),
  avatarUrl: z.string().url().nullable(),
  onboardingCompleted: z.boolean(),
})

export const updateProductProfileSchema = z.object({
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  displayName: z.string().trim().min(1).max(50).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  completeOnboarding: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one profile field is required.',
})

export type ProductProfileResponse = z.infer<typeof productProfileSchema>
export type UpdateProductProfile = z.infer<typeof updateProductProfileSchema>
