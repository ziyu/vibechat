import { config } from '@config';
import { processReferralCommission } from '@libs/affiliate';
import { creditService, TransactionTypeCode } from '@libs/credits';
import { db } from '@libs/database';
import { order, orderStatus } from '@libs/database/schema/order';
import { creditTransaction } from '@libs/database/schema/credit-transaction';
import {
  subscription,
  subscriptionStatus,
  paymentTypes,
} from '@libs/database/schema/subscription';
import { user } from '@libs/database/schema/user';
import { getPlanById } from '@libs/pricing';
import { and, desc, eq } from 'drizzle-orm';
import type { PaymentPlan } from './types';
import type { PaymentProviderType } from './index';

export interface FulfillPaidOrderInput {
  orderId: string;
  providerOrderId?: string | null;
  providerEventId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown>;
  /** Provider-verified amount normalized to the order currency's major unit. */
  paidAmount?: number | null;
  paidCurrency?: string | null;
  /** Provider-signed metadata used to bind a callback to the local owner and plan. */
  reportedUserId?: string | null;
  reportedPlanId?: string | null;
  providerProductId?: string | null;
}

export interface FulfillPaidOrderResult {
  orderId: string;
  kind: 'credits' | 'subscription';
  idempotent: boolean;
}

function objectMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function validDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function addPlanDuration(start: Date, months: number): Date {
  const end = new Date(start);
  if (months >= 9999) end.setUTCFullYear(end.getUTCFullYear() + 100);
  else end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}

function providerSubscriptionFields(
  provider: PaymentProviderType,
  input: FulfillPaidOrderInput,
) {
  if (provider === 'stripe') {
    return { stripeCustomerId: input.customerId || null, stripeSubscriptionId: input.subscriptionId || null };
  }
  if (provider === 'creem') {
    return { creemCustomerId: input.customerId || null, creemSubscriptionId: input.subscriptionId || null };
  }
  if (provider === 'paypal') {
    return { paypalSubscriptionId: input.subscriptionId || null };
  }
  if (provider === 'dodo') {
    return { dodoCustomerId: input.customerId || null, dodoSubscriptionId: input.subscriptionId || null };
  }
  return {};
}

function expectedProviderProductId(provider: PaymentProviderType, plan: PaymentPlan): string | null {
  if (provider === 'stripe') return plan.stripePriceId || null;
  if (provider === 'creem') return plan.creemProductId || null;
  if (provider === 'paypal') return plan.paypalPlanId || null;
  if (provider === 'dodo') return plan.dodoProductId || null;
  return null;
}

async function rememberProviderCustomer(
  provider: PaymentProviderType,
  userId: string,
  customerId: string | null | undefined,
) {
  if (!customerId) return;
  if (provider === 'stripe') {
    await db.update(user).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(user.id, userId));
  } else if (provider === 'creem') {
    await db.update(user).set({ creemCustomerId: customerId, updatedAt: new Date() }).where(eq(user.id, userId));
  } else if (provider === 'dodo') {
    await db.update(user).set({ dodoCustomerId: customerId, updatedAt: new Date() }).where(eq(user.id, userId));
  }
}

async function fulfillSubscription(
  orderRecord: typeof order.$inferSelect,
  provider: PaymentProviderType,
  plan: PaymentPlan,
  input: FulfillPaidOrderInput,
): Promise<boolean> {
  const entitlementId = `entitlement:${orderRecord.id}`;
  const [existingEntitlement] = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(eq(subscription.id, entitlementId))
    .limit(1);
  if (existingEntitlement) {
    const providerFields = providerSubscriptionFields(provider, input);
    await db.update(subscription).set({
      ...providerFields,
      ...(validDate(input.periodStart) ? { periodStart: input.periodStart } : {}),
      ...(validDate(input.periodEnd) ? { periodEnd: input.periodEnd } : {}),
      updatedAt: new Date(),
    }).where(eq(subscription.id, entitlementId));
    return true;
  }

  const now = new Date();
  let periodStart = validDate(input.periodStart) ? input.periodStart : now;
  let periodEnd = validDate(input.periodEnd) ? input.periodEnd : null;

  if (!periodEnd) {
    if (plan.duration.type === 'one_time') {
      const [latest] = await db
        .select({ periodEnd: subscription.periodEnd })
        .from(subscription)
        .where(and(
          eq(subscription.userId, orderRecord.userId),
          eq(subscription.planId, orderRecord.planId),
          eq(subscription.status, subscriptionStatus.ACTIVE),
        ))
        .orderBy(desc(subscription.periodEnd))
        .limit(1);
      if (latest?.periodEnd && latest.periodEnd > periodStart) periodStart = latest.periodEnd;
    }
    periodEnd = addPlanDuration(periodStart, plan.duration.months ?? 1);
  }

  try {
    await db.insert(subscription).values({
      id: entitlementId,
      userId: orderRecord.userId,
      planId: orderRecord.planId,
      status: subscriptionStatus.ACTIVE,
      paymentType: plan.duration.type === 'recurring' ? paymentTypes.RECURRING : paymentTypes.ONE_TIME,
      ...providerSubscriptionFields(provider, input),
      periodStart,
      periodEnd,
      cancelAtPeriodEnd: plan.duration.type !== 'recurring',
      metadata: JSON.stringify({
        fulfillmentOrderId: orderRecord.id,
        provider,
        providerOrderId: input.providerOrderId || null,
        providerEventId: input.providerEventId || null,
        isLifetime: (plan.duration.months ?? 1) >= 9999,
        ...input.metadata,
      }),
      createdAt: now,
      updatedAt: now,
    });
    return false;
  } catch (error) {
    const [concurrent] = await db
      .select({ id: subscription.id })
      .from(subscription)
      .where(eq(subscription.id, entitlementId))
      .limit(1);
    if (concurrent) return true;
    throw error;
  }
}

/**
 * Retry-safe paid-order fulfillment shared by every payment provider.
 * Provider callbacks only authenticate and normalize provider facts; plan,
 * amount, user, credits, and entitlement duration are loaded server-side.
 */
export async function fulfillPaidOrder(input: FulfillPaidOrderInput): Promise<FulfillPaidOrderResult> {
  const [orderRecord] = await db.select().from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!orderRecord) throw new Error(`Paid order not found: ${input.orderId}`);

  const provider = orderRecord.provider as PaymentProviderType;
  if (!['stripe', 'wechat', 'creem', 'alipay', 'paypal', 'dodo'].includes(provider)) {
    throw new Error(`Unsupported order provider: ${orderRecord.provider}`);
  }

  const plan = (await getPlanById(orderRecord.planId)
    || (config.payment.plans as Record<string, PaymentPlan>)[orderRecord.planId]) as PaymentPlan | undefined;
  if (!plan) throw new Error(`Plan not found for paid order: ${orderRecord.planId}`);
  if (plan.id !== orderRecord.planId || (plan as PaymentPlan & { provider?: string }).provider !== provider) {
    throw new Error(`Paid order plan/provider mismatch: ${input.orderId}`);
  }
  if (input.reportedUserId && input.reportedUserId !== orderRecord.userId) {
    throw new Error(`Paid order user mismatch: ${input.orderId}`);
  }
  if (input.reportedPlanId && input.reportedPlanId !== orderRecord.planId) {
    throw new Error(`Paid order reported plan mismatch: ${input.orderId}`);
  }
  const expectedProductId = expectedProviderProductId(provider, plan);
  if (expectedProductId && input.providerProductId !== expectedProductId) {
    throw new Error(`Paid order provider product mismatch: ${input.orderId}`);
  }
  if (input.paidAmount != null) {
    const expected = Number(orderRecord.amount);
    if (!Number.isFinite(input.paidAmount) || !Number.isFinite(expected) || Math.abs(input.paidAmount - expected) > 0.000001) {
      throw new Error(`Paid order amount mismatch: ${input.orderId}`);
    }
  }
  if (input.paidCurrency && input.paidCurrency.toUpperCase() !== orderRecord.currency.toUpperCase()) {
    throw new Error(`Paid order currency mismatch: ${input.orderId}`);
  }

  const existingMetadata = objectMetadata(orderRecord.metadata);
  const previousFulfillment = objectMetadata(existingMetadata.fulfillment);
  const previouslyComplete = previousFulfillment.status === 'complete';
  const processingMetadata = {
    ...existingMetadata,
    ...input.metadata,
    fulfillment: {
      ...previousFulfillment,
      version: 1,
      status: 'processing',
      lastAttemptAt: new Date().toISOString(),
      providerEventId: input.providerEventId || previousFulfillment.providerEventId || null,
    },
  };

  await db.update(order).set({
    status: orderStatus.PAID,
    providerOrderId: input.providerOrderId || orderRecord.providerOrderId,
    metadata: processingMetadata,
    updatedAt: new Date(),
  }).where(eq(order.id, orderRecord.id));

  let idempotent = previouslyComplete;
  let kind: FulfillPaidOrderResult['kind'];
  if (plan.duration.type === 'credits') {
    if (!plan.credits || plan.credits <= 0) throw new Error(`Credit plan has no credits: ${plan.id}`);
    const [existed] = await db.select({ id: creditTransaction.id })
      .from(creditTransaction)
      .where(eq(creditTransaction.id, `purchase:${orderRecord.id}`))
      .limit(1);
    await creditService.addCredits({
      userId: orderRecord.userId,
      amount: plan.credits,
      type: 'purchase',
      orderId: orderRecord.id,
      description: TransactionTypeCode.PURCHASE,
      transactionId: `purchase:${orderRecord.id}`,
      metadata: {
        provider,
        planId: orderRecord.planId,
        providerOrderId: input.providerOrderId || orderRecord.providerOrderId,
        providerEventId: input.providerEventId || null,
      },
    });
    idempotent = idempotent || !!existed;
    kind = 'credits';
  } else {
    idempotent = (await fulfillSubscription(orderRecord, provider, plan, input)) || idempotent;
    kind = 'subscription';
  }

  await rememberProviderCustomer(provider, orderRecord.userId, input.customerId);
  const commissionResult = await processReferralCommission(orderRecord.id);

  await db.update(order).set({
    status: orderStatus.PAID,
    providerOrderId: input.providerOrderId || orderRecord.providerOrderId,
    metadata: {
      ...processingMetadata,
      fulfillment: {
        ...objectMetadata(processingMetadata.fulfillment),
        status: 'complete',
        completedAt: new Date().toISOString(),
        kind,
        commissionId: commissionResult.commissionId || null,
        commissionResult: commissionResult.created ? 'created' : commissionResult.error || 'not_applicable',
      },
    },
    updatedAt: new Date(),
  }).where(eq(order.id, orderRecord.id));

  return { orderId: orderRecord.id, kind, idempotent };
}
