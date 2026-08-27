import { z } from 'zod'
import {
  agentAvailabilitySchema,
  agentBudgetPolicySnapshotSchema,
  agentDataRegionPolicySchema,
  agentDefinitionSnapshotSchema,
  agentExecutionPoolPolicySchema,
  agentVersionSchema,
  spaceAgentBindingSnapshotSchema,
} from '@vibechat/space-agent-contracts'

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

export const adminAgentGovernanceQuerySchema = z.object({
  spaceInstanceId: z.string().trim().min(1).max(255).optional(),
  agentId: z.string().trim().min(1).max(64).optional(),
  auditLimit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()

export const adminCreateAgentDefinitionSchema = z.object({
  agentId: z.string().trim().min(1).max(64),
  version: agentVersionSchema,
  adapterKey: z.enum(['pi', 'claude-code']),
  adapterVersion: z.string().trim().min(1).max(64),
  provider: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(128),
  capabilities: z.array(z.string().trim().min(1).max(64)).min(1).max(64),
  toolPolicyId: z.string().trim().min(1).max(255),
  pricingPolicyId: z.string().trim().min(1).max(255),
  maxBudgetCredits: z.number().int().nonnegative(),
  maxConcurrency: z.number().int().positive().max(1_000),
  dataRegionPolicy: agentDataRegionPolicySchema,
  executionPoolPolicy: agentExecutionPoolPolicySchema,
  displayName: z.string().trim().min(1).max(128),
  description: z.string().trim().max(2_000),
  availability: agentAvailabilitySchema,
}).strict()

export const adminSetAgentDefinitionFrozenSchema = z.object({
  frozen: z.boolean(),
}).strict()

export const adminUpsertSpaceAgentBindingSchema = z.object({
  spaceInstanceId: z.string().trim().min(1).max(255),
  agentId: z.string().trim().min(1).max(64),
  definitionId: z.string().trim().min(1).max(255),
  isDefault: z.boolean(),
  permissionPolicyId: z.string().trim().min(1).max(255),
  toolPolicyId: z.string().trim().min(1).max(255),
  budgetPolicy: agentBudgetPolicySnapshotSchema,
  status: z.enum(['active', 'disabled']),
}).strict()

export const adminAgentAuditEventSchema = z.object({
  eventId: z.string().min(1).max(255),
  spaceInstanceId: z.string().min(1).max(255),
  agentId: z.string().min(1).max(64),
  definitionId: z.string().nullable(),
  sessionId: z.string().nullable(),
  turnId: z.string().nullable(),
  eventType: z.string().min(1).max(255),
  policySnapshotHash: z.string().nullable(),
  result: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
}).strict()

export const adminAgentGovernanceSnapshotSchema = z.object({
  definitions: z.array(agentDefinitionSnapshotSchema),
  bindings: z.array(spaceAgentBindingSnapshotSchema),
  audit: z.array(adminAgentAuditEventSchema),
}).strict()

export type AdminUserRole = z.infer<typeof adminUserRoleSchema>
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>
export type AdminUpdateUser = z.infer<typeof adminUpdateUserSchema>
export type AdminCreditTransactionsQuery = z.infer<typeof adminCreditTransactionsQuerySchema>
export type AdminAgentGovernanceSnapshot = z.infer<typeof adminAgentGovernanceSnapshotSchema>
export type AdminCreateAgentDefinition = z.infer<typeof adminCreateAgentDefinitionSchema>
export type AdminUpsertSpaceAgentBinding = z.infer<typeof adminUpsertSpaceAgentBindingSchema>
