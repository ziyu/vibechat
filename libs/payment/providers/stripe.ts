import Stripe from 'stripe';
import { config } from '@config';
import { 
  PaymentProvider, 
  PaymentParams, 
  PaymentResult, 
  WebhookVerification,
  PaymentPlan
} from '../types';
import { db } from '@libs/database';
import { 
  subscription as userSubscription, 
  subscriptionStatus, 
} from '@libs/database/schema/subscription';
import { order, orderStatus } from '@libs/database/schema/order';
import { eq } from 'drizzle-orm';
import { user } from '@libs/database/schema/user';
import { fulfillPaidOrder } from '../fulfillment';
import { summarizePaymentError } from '../error';

export class StripeProvider implements PaymentProvider {
  public stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.payment.providers.stripe.secretKey, {
      apiVersion: '2025-04-30.basil',
    });
  }

  async createPayment(params: PaymentParams): Promise<PaymentResult> {
    const plan = params.plan || config.payment.plans[params.planId as keyof typeof config.payment.plans] as PaymentPlan;
    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }
    
    if (plan.duration.type === 'recurring') {
      return this.createSubscription(params, plan);
    } else {
      // Both 'one_time' and 'credits' use the same payment mode
      return this.createOneTimePayment(params, plan);
    }
  }

  private async createSubscription(params: PaymentParams, plan: PaymentPlan): Promise<PaymentResult> {
    // 1. 获取或创建客户
    const customer = await this.getOrCreateCustomer(params.userId);

    // 2. 创建 Checkout Session
    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [{
        price: plan.stripePriceId!,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${config.app.payment.successUrl}?session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancel_url: config.app.payment.cancelUrl,
      metadata: {
        orderId: params.orderId,
        userId: params.userId,
        planId: params.planId
      }
    });

    return {
      paymentUrl: session.url || '',
      providerOrderId: session.id,
      metadata: {
        customerId: customer.id,
        sessionId: session.id
      }
    };
  }

  private async createOneTimePayment(params: PaymentParams, plan: PaymentPlan): Promise<PaymentResult> {
    const customer = await this.getOrCreateCustomer(params.userId);
    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [{
        price: plan.stripePriceId!,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${config.app.payment.successUrl}?session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancel_url: config.app.payment.cancelUrl,
      metadata: {
        orderId: params.orderId,
        userId: params.userId,
        planId: params.planId
      }
    });

    return {
      paymentUrl: session.url || '',
      providerOrderId: session.id,
      metadata: {
        sessionId: session.id
      }
    };
  }

  async handleWebhook(payload: any, signature: string): Promise<WebhookVerification> {
    try {
      const event = await this.stripe.webhooks.constructEventAsync(
        payload,
        signature,
        config.payment.providers.stripe.webhookSecret
      );
      console.log('Stripe webhook received:', { eventId: event.id, type: event.type })
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === 'subscription') {
            return this.handleSubscriptionCreated(session);
          } else {
            return this.handleOneTimePayment(session);
          }
        }

        case 'customer.subscription.updated': {
          // 处理订阅更新事件（包括计划变更、续订等）
          const subscription = event.data.object as Stripe.Subscription;
          return this.handleSubscriptionUpdated(subscription);
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          return this.handleSubscriptionDeleted(subscription);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error verifying Stripe webhook:', summarizePaymentError(err));
      return { success: false };
    }
  }

  private async handleSubscriptionCreated(session: Stripe.Checkout.Session): Promise<WebhookVerification> {
    if (!session.subscription || !session.metadata?.orderId || !session.metadata.userId || !session.metadata.planId) {
      return { success: false };
    }

    const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string, {
      expand: ['latest_invoice']
    });    
    // 使用 Stripe 的订阅周期（Unix时间戳转UTC）
    const subscriptionItem = subscription.items.data[0];
    const periodStart = new Date(subscriptionItem.current_period_start * 1000);
    const periodEnd = new Date(subscriptionItem.current_period_end * 1000);
    
    await fulfillPaidOrder({
      orderId: session.metadata.orderId,
      providerOrderId: session.id,
      providerEventId: session.id,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      paidAmount: session.amount_total == null ? null : session.amount_total / 100,
      paidCurrency: session.currency,
      reportedUserId: session.metadata.userId,
      reportedPlanId: session.metadata.planId,
      providerProductId: subscriptionItem.price.id,
      metadata: { checkoutSessionId: session.id },
    });

    return { success: true, orderId: session.metadata.orderId };
  }

  private async handleOneTimePayment(session: Stripe.Checkout.Session): Promise<WebhookVerification> {
    if (!session.metadata?.orderId || !session.metadata.userId || !session.metadata.planId) return { success: false };
    const lineItems = await this.stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const providerProductId = lineItems.data[0]?.price?.id;
    if (!providerProductId) return { success: false };

    await fulfillPaidOrder({
      orderId: session.metadata.orderId,
      providerOrderId: session.id,
      providerEventId: session.id,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      paidAmount: session.amount_total == null ? null : session.amount_total / 100,
      paidCurrency: session.currency,
      reportedUserId: session.metadata.userId,
      reportedPlanId: session.metadata.planId,
      providerProductId,
      metadata: { checkoutSessionId: session.id },
    });

    return { success: true, orderId: session.metadata.orderId };
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<WebhookVerification> {
    // 获取 Stripe 客户 ID
    const stripeCustomerId = stripeSubscription.customer as string;
    
    // 通过 Stripe 客户 ID 查找订阅记录，而不是通过 subscription ID
    const existingSubscription = await db.query.subscription.findFirst({
      where: eq(userSubscription.stripeCustomerId, stripeCustomerId)
    });
    if (!existingSubscription) {
      console.error(`找不到对应的订阅记录，Stripe 客户 ID: ${stripeCustomerId}`);
      return { success: false };
    }

    // 使用 Stripe 的订阅周期（Unix时间戳转UTC）
    const subscriptionItem = stripeSubscription.items.data[0];
    const periodStart = new Date(subscriptionItem.current_period_start * 1000);
    const periodEnd = new Date(subscriptionItem.current_period_end * 1000);
    
    console.log(`Stripe subscription updated - Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    // 获取 price ID，用于确定当前计划
    const priceId = subscriptionItem.price.id;
    
    // 查找对应的计划 ID
    let newPlanId = existingSubscription.planId; // 默认保持原计划
    
    
    // 遍历所有计划，查找匹配当前 price ID 的计划
    for (const [planId, planDetails] of Object.entries(config.payment.plans)) {
      if (planDetails.provider === 'stripe' && planDetails.stripePriceId === priceId) {
        newPlanId = planId;
        break;
      }
    }

    // 更新订阅记录
    await db.update(userSubscription)
      .set({
        status: this.mapStripeStatus(stripeSubscription.status),
        planId: newPlanId, // 更新计划 ID
        stripeSubscriptionId: stripeSubscription.id, // 更新为新的订阅 ID
        periodStart: periodStart,
        periodEnd: periodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        updatedAt: new Date()
      })
      .where(eq(userSubscription.stripeCustomerId, stripeCustomerId));

    return { success: true };
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<WebhookVerification> {
    await db.update(userSubscription)
      .set({
        status: subscriptionStatus.CANCELED,
        updatedAt: new Date()
      })
      .where(eq(userSubscription.stripeSubscriptionId, stripeSubscription.id));

    return { success: true };
  }

  private mapStripeStatus(status: string): string {
    switch (status) {
      case 'active':
        return subscriptionStatus.ACTIVE;        // 活跃订阅
      case 'canceled':
        return subscriptionStatus.CANCELED;      // 用户主动取消
      case 'past_due':
        return subscriptionStatus.EXPIRED;       // 付款逾期 → 统一为过期
      case 'unpaid':
        return subscriptionStatus.EXPIRED;       // 付款失败 → 统一为过期
      case 'trialing':
        return subscriptionStatus.TRIALING;      // 试用期
      case 'incomplete_expired':
        return subscriptionStatus.EXPIRED;       // 不完整订阅过期
      default:
        return subscriptionStatus.ACTIVE;
    }
  }

  private async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
    // 1. 先从数据库中查找用户
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId)
    });

    if (!userRecord) {
      throw new Error('User not found');
    }

    // 2. 如果用户已有 Stripe Customer ID，直接返回
    if (userRecord.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(userRecord.stripeCustomerId);
        if (!customer.deleted) {
          return customer as Stripe.Customer;
        }
        // 如果客户已被删除，继续创建新客户
      } catch (error) {
        console.error('Error retrieving Stripe customer:', summarizePaymentError(error));
        // 如果获取失败（比如客户被删除），继续创建新客户
      }
    }

    // 3. 创建新的 Stripe Customer
    const customer = await this.stripe.customers.create({
      email: userRecord.email,
      name: userRecord.name || undefined,
      phone: userRecord.phoneNumber || undefined,
      metadata: {
        userId: userId
      }
    });

    // 4. 更新用户记录
    await db.update(user)
      .set({ 
        stripeCustomerId: customer.id,
        updatedAt: new Date()
      })
      .where(eq(user.id, userId));

    return customer;
  }

  /**
   * 创建 Stripe 客户门户会话
   * @param customerId Stripe 客户 ID
   * @param returnUrl 完成后返回的 URL
   * @returns 门户会话对象，包含重定向 URL
   */
  async createCustomerPortal(customerId: string, returnUrl: string) {
    const portalSession = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    return portalSession;
  }

  /**
   * 关闭订单 (目前Stripe不支持)
   * @param orderId 订单ID
   * @returns 是否成功关闭
   */
  async closeOrder(orderId: string): Promise<boolean> {
    console.warn('Stripe does not support canceling orders via API. This is a no-op.');
    return false;
  }
}
