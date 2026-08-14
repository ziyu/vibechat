import { z } from 'zod'

export const adminUserRoleSchema = z.enum(['admin', 'user'])
export const adminUserRoles = adminUserRoleSchema.enum

export const adminUserListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().email(),
  role: adminUserRoleSchema,
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean().nullable(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable(),
  banExpires: z.union([z.string(), z.date()]).nullable(),
  referralCode: z.string().nullable(),
  referredByCode: z.string().nullable(),
  commissionBalance: z.union([z.string(), z.number()]).nullable(),
  kycVerified: z.boolean(),
  referredBy: z.object({
    name: z.string().nullable(),
    email: z.string().email(),
  }).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  image: z.string().url().nullable().optional(),
  phoneNumber: z.string().trim().max(32).nullable().optional(),
  emailVerified: z.boolean().optional(),
  phoneNumberVerified: z.boolean().optional(),
  kycVerified: z.boolean().optional(),
  role: adminUserRoleSchema.optional(),
  banned: z.boolean().optional(),
  banReason: z.string().trim().max(500).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one user field is required.',
})

export const adminCreditTransactionTypeSchema = z.enum([
  'purchase',
  'consumption',
  'refund',
  'bonus',
  'adjustment',
])

export const adminCreditTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  searchField: z.enum(['id', 'userId', 'userEmail', 'userName', 'description']).optional(),
  searchValue: z.string().trim().max(200).optional(),
  type: adminCreditTransactionTypeSchema.optional(),
  userId: z.string().trim().max(100).optional(),
  sortBy: z.enum(['id', 'userId', 'userEmail', 'type', 'amount', 'createdAt']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})

export type AdminUserRole = z.infer<typeof adminUserRoleSchema>
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>
export type AdminUpdateUser = z.infer<typeof adminUpdateUserSchema>
export type AdminCreditTransactionsQuery = z.infer<typeof adminCreditTransactionsQuerySchema>
