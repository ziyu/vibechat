import DodoPayments from 'dodopayments';
import type { Webhooks } from 'dodopayments/resources/webhooks';
import type { Payment } from 'dodopayments/resources/payments';
import type { Subscription as DodoSubscription } from 'dodopayments/resources/subscriptions';
import { config } from '@config';
import {
  PaymentProvider,
  PaymentParams,
  PaymentResult,
  WebhookVerification,
  OrderQueryResult,
  PaymentPlan
} from '../types';
import { db } from '@libs/database';
import {
  subscription as userSubscription,
  subscriptionStatus,
} from '@libs/database/schema/subscription';
import { order, orderStatus } from '@libs/database/schema/order';
import { user } from '@libs/database/schema/user';
import { eq, and } from 'drizzle-orm';
import { fulfillPaidOrder } from '../fulfillment';
import { summarizePaymentError } from '../error';

export interface DodoWebhookHeaders {
  'webhook-id': string | null;
  'webhook-signature': string | null;
  'webhook-timestamp': string | null;
}

type UnwrapWebhookEvent = Webhooks.UnwrapWebhookEvent;

export class DodoProvider implements PaymentProvider {
  private client: DodoPayments;

  constructor() {
    this.client = new DodoPayments({
      bearerToken: config.payment.providers.dodo.apiKey,
      environment: config.payment.providers.dodo.testMode ? 'test_mode' : 'live_mode',
      webhookKey: config.payment.providers.dodo.webhookSecret,
    });
  }

  async createPayment(params: PaymentParams): Promise<PaymentResult> {
    const plan = params.plan || config.payment.plans[params.planId as keyof typeof config.payment.plans] as PaymentPlan;
    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }
    if (!plan.dodoProductId) {
      throw new Error(`Dodo Payments product ID not configured for plan: ${params.planId}`);
    }

    const customer = await this.getOrCreateCustomer(params.userId);

    try {
      const createParams: Parameters<typeof this.client.checkoutSessions.create>[0] = {
        product_cart: [
          {
            product_id: plan.dodoProductId,
            quantity: 1
          }
        ],
        return_url: `${config.app.payment.successUrl}?provider=dodo`,
        metadata: {
          orderId: params.orderId,
          userId: params.userId,
          planId: params.planId
        }
      };

      if (customer.customerId) {
        createParams.customer = { customer_id: customer.customerId };
      } else {
        createParams.customer = { email: customer.email, name: customer.name || undefined };
      }

      const checkoutSession = await this.client.checkoutSessions.create(createParams);

      if (!checkoutSession?.checkout_url) {
        throw new Error('Failed to create Dodo checkout session: No URL returned');
      }

      return {
        paymentUrl: checkoutSession.checkout_url,
        providerOrderId: checkoutSession.session_id,
        metadata: {
          sessionId: checkoutSession.session_id,
          customerId: customer.customerId
        }
      };
    } catch (error) {
      console.error('Dodo Payments payment creation failed:', summarizePaymentError(error));
      throw new Error(`Failed to create Dodo payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleWebhook(payload: string | Record<string, any>, signature: string): Promise<WebhookVerification> {
    try {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      let headers: DodoWebhookHeaders;
      try {
        headers = JSON.parse(typeof signature === 'string' ? signature : '{}');
      } catch {
        console.error('Invalid Dodo webhook headers format');
        return { success: false };
      }

      let webhookEvent: UnwrapWebhookEvent;
      try {
        webhookEvent = this.client.webhooks.unwrap(payloadString, {
          headers: {
            'webhook-id': headers['webhook-id'] || '',
            'webhook-signature': headers['webhook-signature'] || '',
            'webhook-timestamp': headers['webhook-timestamp'] || '',
          },
        });
      } catch (error) {
        console.error('Dodo webhook signature verification failed:', summarizePaymentError(error));
        return { success: false };
      }

      switch (webhookEvent.type) {
        case 'payment.succeeded':
          return this.handlePaymentSucceeded(webhookEvent.data);
        case 'payment.failed':
          return this.handlePaymentFailed(webhookEvent.data);
        case 'subscription.active':
          return this.handleSubscriptionActive(webhookEvent.data);
        case 'subscription.renewed':
          return this.handleSubscriptionRenewed(webhookEvent.data);
        case 'subscription.cancelled':
          return this.handleSubscriptionCancelled(webhookEvent.data);
        case 'subscription.expired':
          return this.handleSubscriptionExpired(webhookEvent.data);
        case 'subscription.on_hold':
          return this.handleSubscriptionOnHold(webhookEvent.data);
        case 'subscription.plan_changed':
        case 'subscription.updated':
          return this.handleSubscriptionUpdated(webhookEvent.data);
        default:
          console.log(`Unhandled Dodo webhook event: ${(webhookEvent as any).type}`);
          return { success: true };
      }
    } catch (error) {
      console.error('Error handling Dodo webhook:', summarizePaymentError(error));
      return { success: false };
    }
  }

  private async handlePaymentSucceeded(paymentData: Payment): Promise<WebhookVerification> {
    const metadata = paymentData.metadata;
    if (!metadata?.orderId || !metadata?.userId || !metadata?.planId) {
      console.error('Missing required metadata in Dodo payment webhook');
      return { success: false };
    }
    const providerProductId = paymentData.product_cart?.[0]?.product_id;
    if (!providerProductId) return { success: false };

    const { orderId } = metadata;
    await fulfillPaidOrder({
      orderId,
      providerOrderId: paymentData.payment_id,
      providerEventId: paymentData.payment_id,
      customerId: paymentData.customer?.customer_id,
      paidAmount: paymentData.total_amount / 100,
      paidCurrency: paymentData.currency,
      reportedUserId: metadata.userId,
      reportedPlanId: metadata.planId,
      providerProductId,
      metadata: { paymentId: paymentData.payment_id },
    });

    return { success: true, orderId };
  }

  private async handlePaymentFailed(paymentData: Payment): Promise<WebhookVerification> {
    const metadata = paymentData.metadata;
    if (!metadata?.orderId) {
      console.warn('No orderId in failed payment webhook');
      return { success: true };
    }

    await db.update(order)
      .set({
        status: orderStatus.FAILED,
        metadata: {
          paymentId: paymentData.payment_id,
          failureReason: paymentData.status
        }
      })
      .where(and(eq(order.id, metadata.orderId), eq(order.status, orderStatus.PENDING)));

    return { success: true, orderId: metadata.orderId };
  }

  private async handleSubscriptionActive(subData: DodoSubscription): Promise<WebhookVerification> {
    const metadata = subData.metadata;

    if (!metadata?.orderId || !metadata?.userId || !metadata?.planId) {
      console.warn('Missing metadata in Dodo subscription.active webhook');
      return { success: true };
    }

    await fulfillPaidOrder({
      orderId: metadata.orderId,
      providerOrderId: subData.subscription_id,
      providerEventId: `dodo-subscription-active:${subData.subscription_id}`,
      customerId: subData.customer?.customer_id,
      subscriptionId: subData.subscription_id,
      periodStart: new Date(subData.previous_billing_date),
      periodEnd: new Date(subData.next_billing_date),
      reportedUserId: metadata.userId,
      reportedPlanId: metadata.planId,
      providerProductId: subData.product_id,
      metadata: { productId: subData.product_id },
    });

    return { success: true, orderId: metadata.orderId };
  }

  private async handleSubscriptionRenewed(subData: DodoSubscription): Promise<WebhookVerification> {
    const subscription = await db.query.subscription.findFirst({
      where: eq(userSubscription.dodoSubscriptionId, subData.subscription_id)
    });

    if (!subscription) {
      console.warn(`No local subscription found for Dodo subscription ${subData.subscription_id}`);
      return { success: true };
    }

    const periodStart = new Date(subData.previous_billing_date);
    const periodEnd = new Date(subData.next_billing_date);

    await db.update(userSubscription)
      .set({
        status: subscriptionStatus.ACTIVE,
        periodStart,
        periodEnd,
        updatedAt: new Date()
      })
      .where(eq(userSubscription.id, subscription.id));

    console.log(`Dodo subscription renewed: ${subData.subscription_id}, period: ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
    return { success: true };
  }

  private async handleSubscriptionCancelled(subData: DodoSubscription): Promise<WebhookVerification> {
    const subscription = await db.query.subscription.findFirst({
      where: eq(userSubscription.dodoSubscriptionId, subData.subscription_id)
    });

    if (!subscription) {
      console.warn(`No local subscription found for Dodo subscription ${subData.subscription_id}`);
      return { success: false };
    }

    await db.update(userSubscription)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      })
      .where(eq(userSubscription.id, subscription.id));

    return { success: true };
  }

  private async handleSubscriptionExpired(subData: DodoSubscription): Promise<WebhookVerification> {
    const subscription = await db.query.subscription.findFirst({
      where: eq(userSubscription.dodoSubscriptionId, subData.subscription_id)
    });

    if (!subscription) {
      console.warn(`No local subscription found for Dodo subscription ${subData.subscription_id}`);
      return { success: false };
    }

    await db.update(userSubscription)
      .set({
        status: subscriptionStatus.EXPIRED,
        updatedAt: new Date()
      })
      .where(eq(userSubscription.id, subscription.id));

    return { success: true };
  }

  private async handleSubscriptionOnHold(subData: DodoSubscription): Promise<WebhookVerification> {
    const subscription = await db.query.subscription.findFirst({
      where: eq(userSubscription.dodoSubscriptionId, subData.subscription_id)
    });

    if (!subscription) {
      console.warn(`No local subscription found for Dodo subscription ${subData.subscription_id}`);
      return { success: false };
    }

    await db.update(userSubscription)
      .set({
        status: subscriptionStatus.EXPIRED,
        updatedAt: new Date()
      })
      .where(eq(userSubscription.id, subscription.id));

    return { success: true };
  }

  private async handleSubscriptionUpdated(subData: DodoSubscription): Promise<WebhookVerification> {
    const subscription = await db.query.subscription.findFirst({
      where: eq(userSubscription.dodoSubscriptionId, subData.subscription_id)
    });

    if (!subscription) {
      console.warn(`No local subscription found for Dodo subscription ${subData.subscription_id}`);
      return { success: false };
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      status: this.mapDodoStatus(subData.status),
      periodStart: new Date(subData.previous_billing_date),
      periodEnd: new Date(subData.next_billing_date),
      cancelAtPeriodEnd: subData.cancel_at_next_billing_date ?? false,
    };

    await db.update(userSubscription)
      .set(updateData)
      .where(eq(userSubscription.id, subscription.id));

    return { success: true };
  }

  private mapDodoStatus(status: string): string {
    switch (status) {
      case 'active':
        return subscriptionStatus.ACTIVE;
      case 'cancelled':
      case 'canceled':
        return subscriptionStatus.CANCELED;
      case 'expired':
        return subscriptionStatus.EXPIRED;
      case 'on_hold':
      case 'failed':
        return subscriptionStatus.EXPIRED;
      default:
        return subscriptionStatus.INACTIVE;
    }
  }

  private async getOrCreateCustomer(userId: string): Promise<{ customerId: string; email: string; name: string | null }> {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId)
    });

    if (!userRecord) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!userRecord.email) {
      throw new Error(`User email not found for user: ${userId}`);
    }

    if (userRecord.dodoCustomerId) {
      return {
        customerId: userRecord.dodoCustomerId,
        email: userRecord.email,
        name: userRecord.name
      };
    }

    // Let Dodo Payments create the customer during checkout
    return {
      customerId: '',
      email: userRecord.email,
      name: userRecord.name
    };
  }

  async queryOrder(orderId: string): Promise<OrderQueryResult> {
    try {
      const orders = await db.select().from(order).where(eq(order.id, orderId));

      if (orders.length === 0) {
        return { status: 'failed' };
      }

      const orderData = orders[0];
      if (orderData.status === orderStatus.PAID) {
        return { status: 'paid' };
      } else if (orderData.status === orderStatus.FAILED) {
        return { status: 'failed' };
      }
      return { status: 'pending' };
    } catch (error) {
      console.error('Error querying Dodo order:', summarizePaymentError(error));
      return { status: 'failed' };
    }
  }

  async closeOrder(orderId: string): Promise<boolean> {
    try {
      await db.update(order)
        .set({ status: orderStatus.FAILED })
        .where(and(eq(order.id, orderId), eq(order.status, orderStatus.PENDING)));
      return true;
    } catch (error) {
      console.error('Error closing Dodo order:', summarizePaymentError(error));
      return false;
    }
  }

  /**
   * Create a Dodo Payments customer portal session for managing subscriptions and billing
   */
  async createDodoCustomerPortal(customerId: string, returnUrl: string): Promise<{ url: string }> {
    try {
      const portalSession = await this.client.customers.customerPortal.create(
        customerId,
        { send_email: false, return_url: returnUrl }
      );

      return {
        url: portalSession?.link || returnUrl
      };
    } catch (error) {
      console.error('Error creating Dodo customer portal:', summarizePaymentError(error));
      throw error;
    }
  }
}
