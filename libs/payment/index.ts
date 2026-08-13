import type { StripeProvider } from './providers/stripe';
import type { WechatPayProvider } from './providers/wechat';
import type { CreemProvider } from './providers/creem';
import type { AlipayProvider } from './providers/alipay';
import type { PayPalProvider } from './providers/paypal';
import type { DodoProvider } from './providers/dodo';

export type PaymentProviderType = 'stripe' | 'wechat' | 'creem' | 'alipay' | 'paypal' | 'dodo';

type PaymentProviderFor<T extends PaymentProviderType> =
  T extends 'stripe' ? StripeProvider
    : T extends 'wechat' ? WechatPayProvider
      : T extends 'creem' ? CreemProvider
        : T extends 'alipay' ? AlipayProvider
          : T extends 'paypal' ? PayPalProvider
            : T extends 'dodo' ? DodoProvider
              : never;

/** Load only the selected provider SDK so optional providers stay isolated. */
export async function createPaymentProvider<T extends PaymentProviderType>(
  provider: T,
): Promise<PaymentProviderFor<T>> {
  switch (provider) {
    case 'stripe': {
      const { StripeProvider } = await import('./providers/stripe');
      return new StripeProvider() as PaymentProviderFor<T>;
    }
    case 'wechat': {
      const { WechatPayProvider } = await import('./providers/wechat');
      return new WechatPayProvider() as PaymentProviderFor<T>;
    }
    case 'creem': {
      const { CreemProvider } = await import('./providers/creem');
      return new CreemProvider() as PaymentProviderFor<T>;
    }
    case 'alipay': {
      const { AlipayProvider } = await import('./providers/alipay');
      return new AlipayProvider() as PaymentProviderFor<T>;
    }
    case 'paypal': {
      const { PayPalProvider } = await import('./providers/paypal');
      return new PayPalProvider() as PaymentProviderFor<T>;
    }
    case 'dodo': {
      const { DodoProvider } = await import('./providers/dodo');
      return new DodoProvider() as PaymentProviderFor<T>;
    }
    default:
      throw new Error(`Unsupported payment provider: ${String(provider)}`);
  }
}

export * from './types';
export { summarizePaymentError } from './error';
export { fulfillPaidOrder } from './fulfillment';
export type { FulfillPaidOrderInput, FulfillPaidOrderResult } from './fulfillment';
export type {
  StripeProvider,
  WechatPayProvider,
  CreemProvider,
  AlipayProvider,
  PayPalProvider,
  DodoProvider,
};
export type { CreemRedirectParams, ReturnUrlVerification } from './providers/creem';
