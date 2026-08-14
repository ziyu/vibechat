import { z } from 'zod'

const dateValueSchema = z.union([z.string(), z.date()])
const moneyValueSchema = z.union([z.string(), z.number()])

export const pricingPlanSchema = z.object({
  id: z.string(),
  provider: z.enum(['stripe', 'wechat', 'creem', 'alipay', 'paypal', 'dodo']),
  amount: z.number().finite().nonnegative(),
  currency: z.string().min(3).max(3),
  recommended: z.boolean().optional(),
  duration: z.object({
    type: z.enum(['recurring', 'one_time', 'credits']),
    months: z.number().int().positive().optional(),
  }),
  credits: z.number().int().positive().optional(),
  i18n: z.record(z.string(), z.object({
    name: z.string(),
    description: z.string(),
    duration: z.string().optional(),
    features: z.union([z.array(z.string()), z.string()]).optional(),
  })),
  originalPrice: z.number().nullable().optional(),
  sortOrder: z.number().optional(),
  stripePriceId: z.string().optional(),
  creemProductId: z.string().optional(),
  paypalPlanId: z.string().optional(),
  dodoProductId: z.string().optional(),
})

export const pricingPlansResponseSchema = z.object({ plans: z.array(pricingPlanSchema) })

export const creditStatusResponseSchema = z.object({
  credits: z.object({
    balance: z.number(),
    totalPurchased: z.number(),
    totalConsumed: z.number(),
  }),
  hasSubscription: z.boolean(),
  canAccess: z.boolean(),
})

export const creditTransactionSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: moneyValueSchema,
  balance: moneyValueSchema,
  orderId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: dateValueSchema,
})

export const creditTransactionsResponseSchema = z.object({
  transactions: z.array(creditTransactionSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const orderSchema = z.object({
  id: z.string(),
  amount: moneyValueSchema,
  currency: z.string(),
  planId: z.string(),
  status: z.string(),
  provider: z.string(),
  providerOrderId: z.string().nullable().optional(),
  createdAt: dateValueSchema,
  updatedAt: dateValueSchema,
})

export const ordersResponseSchema = z.object({
  orders: z.array(orderSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const subscriptionStatusResponseSchema = z.object({
  hasSubscription: z.boolean(),
  isLifetime: z.boolean(),
  subscription: z.object({
    id: z.string(),
    planId: z.string(),
    status: z.string(),
    paymentType: z.string(),
    periodStart: dateValueSchema,
    periodEnd: dateValueSchema,
    cancelAtPeriodEnd: z.boolean().nullable(),
  }).nullable(),
})

export const affiliateStatsResponseSchema = z.object({
  referralCode: z.string(),
  referralLink: z.string(),
  commissionBalance: z.number(),
  commissionRate: z.number(),
  totalCommission: z.number(),
  totalPaidReferrals: z.number().int(),
  totalRegisteredReferrals: z.number().int(),
  currency: z.string(),
  referrerSignupBonus: z.number(),
  refereeSignupBonus: z.number(),
  minWithdrawalAmount: z.number(),
  enabled: z.boolean(),
})

export const commissionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  buyerId: z.string(),
  orderAmount: moneyValueSchema,
  currency: z.string(),
  commissionAmount: moneyValueSchema,
  status: z.string(),
  createdAt: dateValueSchema,
  buyer: z.object({ name: z.string().nullable(), email: z.string() }).nullable(),
}).passthrough()

export const commissionsResponseSchema = z.object({
  commissions: z.array(commissionSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const referralSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  createdAt: dateValueSchema,
})

export const referralsResponseSchema = z.object({
  referrals: z.array(referralSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const withdrawalSchema = z.object({
  id: z.string(),
  amount: moneyValueSchema,
  currency: z.string(),
  paymentMethod: z.string(),
  paymentAccount: z.string(),
  status: z.string(),
  adminNote: z.string().nullable().optional(),
  createdAt: dateValueSchema,
  updatedAt: dateValueSchema,
}).passthrough()

export const withdrawalsResponseSchema = z.object({
  withdrawals: z.array(withdrawalSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export const withdrawalRequestInputSchema = z.object({
  amount: z.number().finite().positive(),
  paymentMethod: z.enum(['alipay', 'paypal', 'bank_transfer']),
  paymentAccount: z.string().trim().min(1).max(200),
  requestId: z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/).optional(),
})

export const withdrawalRequestResponseSchema = z.object({
  success: z.literal(true),
  withdrawalId: z.string(),
  idempotent: z.boolean().optional(),
})

export const paymentInitiateInputSchema = z.object({
  planId: z.string().min(1),
  provider: pricingPlanSchema.shape.provider,
  requestId: z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/).optional(),
})

export const paymentInitiateResponseSchema = z.object({
  paymentUrl: z.string().min(1),
  providerOrderId: z.string().min(1),
  idempotent: z.boolean().optional(),
})

export const subscriptionPortalResponseSchema = z.object({ url: z.string().url() })

export type PricingPlan = z.infer<typeof pricingPlanSchema>
export type CreditStatusResponse = z.infer<typeof creditStatusResponseSchema>
export type CreditTransactionsResponse = z.infer<typeof creditTransactionsResponseSchema>
export type OrdersResponse = z.infer<typeof ordersResponseSchema>
export type SubscriptionStatusResponse = z.infer<typeof subscriptionStatusResponseSchema>
export type AffiliateStatsResponse = z.infer<typeof affiliateStatsResponseSchema>
export type CommissionsResponse = z.infer<typeof commissionsResponseSchema>
export type ReferralsResponse = z.infer<typeof referralsResponseSchema>
export type WithdrawalsResponse = z.infer<typeof withdrawalsResponseSchema>
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestInputSchema>
export type PaymentInitiateInput = z.infer<typeof paymentInitiateInputSchema>
