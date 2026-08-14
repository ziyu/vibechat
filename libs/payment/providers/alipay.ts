import { AlipaySdk } from 'alipay-sdk';
import { PaymentProvider, PaymentParams, PaymentResult, WebhookVerification, PaymentPlan } from '../types';
import { config } from '@config';
import type { Plan } from '@config';
import { db } from '@libs/database';
import { order, orderStatus } from '@libs/database/schema/order';
import { eq, and } from 'drizzle-orm';
import { fulfillPaidOrder } from '../fulfillment';
import { summarizePaymentError } from '../error';

// Alipay notification parameters
interface AlipayNotification {
  // Signature fields (required for verification)
  sign: string;
  sign_type: 'RSA' | 'RSA2';
  // Trade info
  out_trade_no: string;
  trade_no: string;
  trade_status: 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED';
  total_amount: string;
  receipt_amount?: string;
  buyer_pay_amount?: string;
  // Buyer info
  buyer_id?: string;
  buyer_logon_id?: string;
  // Time info
  gmt_create?: string;
  gmt_payment?: string;
  gmt_close?: string;
  // Other fields
  app_id: string;
  seller_id?: string;
  notify_id: string;
  notify_type: string;
  notify_time: string;
  subject?: string;
  body?: string;
  // Additional fields
  charset?: string;
  version?: string;
  auth_app_id?: string;
  [key: string]: any;
}

// Alipay precreate response (for QR code payment - requires "当面付" permission)
interface AlipayPrecreateResponse {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
  out_trade_no: string;
  qr_code: string;
}

// Alipay page pay response (for PC website payment - uses pageExecute)
// pageExecute returns a URL string (GET) or HTML form string (POST)
type AlipayPagePayResponse = string;

// Alipay query response
interface AlipayQueryResponse {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
  trade_status?: 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED';
  out_trade_no?: string;
  trade_no?: string;
  buyer_logon_id?: string;
  total_amount?: string;
  receipt_amount?: string;
}

export class AlipayProvider implements PaymentProvider {
  private sdk: AlipaySdk;
  private notifyUrl: string;
  private isSandbox: boolean;

  constructor() {
    this.notifyUrl = config.payment.providers.alipay.notifyUrl;
    this.isSandbox = config.payment.providers.alipay.sandbox;
    
    const gateway = config.payment.providers.alipay.gateway;
    const alipayPublicKey = config.payment.providers.alipay.alipayPublicKey;
    
    console.log(`Initializing Alipay SDK (${this.isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode)`);
    
    this.sdk = new AlipaySdk({
      appId: config.payment.providers.alipay.appId,
      privateKey: config.payment.providers.alipay.appPrivateKey,
      alipayPublicKey: alipayPublicKey,
      // Set gateway for sandbox or production environment
      // Reference: https://opendocs.alipay.com/open/00dn7o
      gateway: gateway,
    });
    
    console.log('Alipay SDK initialized successfully');
  }

  async createPayment(params: PaymentParams): Promise<PaymentResult> {
    const plan = (params.plan || config.payment.plans[params.planId as keyof typeof config.payment.plans]) as Plan | undefined;
    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }
    const description = params.metadata?.description || 
      `${plan.i18n['zh-CN']?.name} - ${plan.i18n['zh-CN']?.description}`;
    
    try {
      // Use pageExecute to call alipay.trade.page.pay for PC website payment
      // Reference: https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay?pathHash=e26b497f&scene=22
      // This generates a URL that redirects user to Alipay payment page
      // After payment, user is redirected back to return_url
      const bizContent = {
        out_trade_no: params.orderId,
        total_amount: (params.amount as number).toFixed(2),
        subject: description,
        product_code: 'FAST_INSTANT_TRADE_PAY', // Required for PC website payment
      };

      // Use pageExecute with 'GET' to generate a redirect URL
      // The user will be redirected to Alipay's payment page
      const paymentUrl = this.sdk.pageExecute('alipay.trade.page.pay', 'GET', {
        bizContent,
        notifyUrl: this.notifyUrl,
        returnUrl: `${config.app.payment.successUrl}?provider=alipay`,
      });

      console.log('Alipay page pay URL generated:', { orderId: params.orderId });

      if (paymentUrl) {
        return {
          paymentUrl: paymentUrl,
          providerOrderId: params.orderId,
          metadata: { 
            method: 'pageExecute',
            productCode: 'FAST_INSTANT_TRADE_PAY'
          }
        };
      } else {
        throw new Error('Alipay order creation failed: No payment URL generated');
      }
    } catch (error: any) {
      console.error('Alipay payment creation failed:', summarizePaymentError(error));
      throw error;
    }
  }

  async handleWebhook(payload: string | Record<string, any>, signature: string): Promise<WebhookVerification> {
    try {      
      // Parse notification data with URL decoding for signature verification
      // checkNotifySignV2 does NOT decode values, so we must pass decoded values
      // The signature is computed on decoded values, not URL-encoded values
      const notifyData: AlipayNotification = typeof payload === 'string' 
        ? this.parseNotifyData(payload)  // Decode values for checkNotifySignV2
        : payload as AlipayNotification;
      
      console.log('Alipay notification received:', { tradeStatus: notifyData.trade_status });
      
      // Check if required fields for signature verification exist
      if (!notifyData.sign) {
        console.error('ERROR: sign field is missing from notification');
        return { success: false };
      }
      if (!notifyData.sign_type) {
        console.error('ERROR: sign_type field is missing from notification');
        return { success: false };
      }

      // Verify signature using SDK's built-in method
      // checkNotifySignV2 expects decoded values (doesn't do URL decoding internally)
      // Signature is computed on decoded parameter values
      
      const isValid = this.sdk.checkNotifySignV2(notifyData);
      
      console.log('Signature verification result:', isValid);
      
      if (!isValid) {
        console.error('=== Alipay Signature Verification Failed ===');
        console.error('Possible causes:');
        console.error('1. ALIPAY_PUBLIC_KEY is incorrect or not set');
        console.error('2. Using wrong public key (sandbox vs production)');
        console.error('3. Public key format issue (should be PEM format)');
        console.error('4. Signature mismatch - check if values are correctly decoded');
        console.error('============================================');
        return { success: false };
      }

      // Process based on trade status
      // TRADE_SUCCESS: Payment completed, applicable for instant payment
      // TRADE_FINISHED: Transaction completed, no refund allowed
      if (notifyData.trade_status === 'TRADE_SUCCESS' || notifyData.trade_status === 'TRADE_FINISHED') {
        const orderId = notifyData.out_trade_no;

        // Load order info first for idempotency
        const orderRecord = await db.query.order.findFirst({
          where: eq(order.id, orderId)
        });

        if (!orderRecord) {
          console.error('Alipay webhook received for unknown order:', orderId);
          return { success: false };
        }

        await fulfillPaidOrder({
          orderId,
          providerOrderId: notifyData.trade_no,
          providerEventId: notifyData.notify_id,
          paidAmount: Number(notifyData.total_amount),
          paidCurrency: orderRecord.currency,
          metadata: {
            tradeStatus: notifyData.trade_status,
            paymentTime: notifyData.gmt_payment || null,
          },
        });
        
        return { success: true, orderId };
      }
      
      // For other statuses (WAIT_BUYER_PAY, TRADE_CLOSED), just acknowledge
      return { success: true };
    } catch (err) {
      console.error('Alipay webhook processing failed:', summarizePaymentError(err));
      return { success: false };
    }
  }

  /**
   * Close an unpaid Alipay order
   * @param orderId Merchant order number
   * @returns Whether the order was closed successfully
   */
  async closeOrder(orderId: string): Promise<boolean> {
    try {
      // Use curl method to call alipay.trade.close
      const result = await this.sdk.curl<{ code: string; msg: string; sub_code?: string; sub_msg?: string }>(
        'POST', 
        '/v3/alipay/trade/close', 
        {
          body: {
            out_trade_no: orderId,
          }
        }
      );
      
      console.log('Alipay close order request completed:', { success: result.data?.code === '10000' });
      
      // code "10000" means success
      if (result.data?.code === '10000') {
        // Update local order status
        try {
          await db.update(order)
            .set({ 
              status: orderStatus.CANCELED,
              updatedAt: new Date()
            })
            .where(and(eq(order.id, orderId), eq(order.status, orderStatus.PENDING)));
        } catch (dbError) {
          console.error('Failed to update order status:', summarizePaymentError(dbError));
          // Even if DB update fails, Alipay side is closed, return true
        }
        
        return true;
      }
      
      // ACQ.TRADE_NOT_EXIST means order doesn't exist on Alipay side, consider as success
      if (result.data?.sub_code === 'ACQ.TRADE_NOT_EXIST') {
        console.log('Order does not exist on Alipay side, marking as closed');
        await db.update(order)
          .set({ 
            status: orderStatus.CANCELED,
            updatedAt: new Date()
          })
          .where(and(eq(order.id, orderId), eq(order.status, orderStatus.PENDING)));
        return true;
      }
      
      console.error('Failed to close Alipay order:', result.data?.sub_msg || result.data?.msg);
      return false;
    } catch (error) {
      console.error('Alipay close order failed:', summarizePaymentError(error));
      return false;
    }
  }

  /**
   * Query order status from Alipay
   * @param orderId Merchant order number
   * @returns Order status
   */
  async queryOrder(orderId: string): Promise<import('../types').OrderQueryResult> {
    try {
      const result = await this.sdk.curl<AlipayQueryResponse>('POST', '/v3/alipay/trade/query', {
        body: {
          out_trade_no: orderId,
        }
      });

      console.log('Alipay query order request completed:', { success: result.data?.code === '10000' });

      if (result.data?.code === '10000' && result.data?.trade_status) {
        switch (result.data.trade_status) {
          case 'TRADE_SUCCESS':
          case 'TRADE_FINISHED':
            return { status: 'paid' };
          case 'WAIT_BUYER_PAY':
            return { status: 'pending' };
          case 'TRADE_CLOSED':
          default:
            return { status: 'failed' };
        }
      }

      return { status: 'pending' };
    } catch (err) {
      console.error('Alipay query order failed:', summarizePaymentError(err));
      return { status: 'failed' };
    }
  }

  /**
   * Parse URL-encoded notification data to object (with URL decoding)
   * The decoded values are used for:
   * 1. Signature verification with checkNotifySignV2 (expects decoded values)
   * 2. Business logic processing
   * 
   * Note: Alipay computes signatures on decoded/original values, so checkNotifySignV2
   * (which doesn't decode internally) expects already-decoded input.
   * 
   * IMPORTANT: In application/x-www-form-urlencoded format:
   * - '+' represents a space character (not %20)
   * - decodeURIComponent() does NOT decode '+' to space
   * - We must replace '+' with space before decoding
   */
  private parseNotifyData(data: string): AlipayNotification {
    const result: Record<string, string> = {};
    const pairs = data.split('&');
    
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const key = pair.substring(0, idx);
        const value = pair.substring(idx + 1);
        // Replace + with space before decoding (form-urlencoded spec)
        result[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
      }
    }
    
    return result as unknown as AlipayNotification;
  }
}
