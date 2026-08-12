/**
 * Payment Configuration
 */
import { getEnv } from './utils';

export const paymentConfig = {
  /**
   * Pricing Mode
   * - 'static': Plans are read from the config below (default, no DB needed)
   * - 'dynamic': Plans are read from the pricing_plan database table (admin-managed)
   */
  pricingMode: (getEnv('PRICING_MODE') || 'static') as 'static' | 'dynamic',

  /**
   * Subscription Plans
   */
  plans: {
    monthlyWechat: {
      provider: 'wechat',
      id: 'monthlyWechat',
      amount: 0.01,
      currency: 'CNY',
      duration: {
        months: 1,
        type: 'one_time'
      },
      i18n: {
        'en': {
          name: 'Wechat Monthly Plan',
          description: 'Monthly one time pay via WeChat Pay',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: '微信支付月度',
          description: '通过微信支付的月度一次性支付',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
  
    // Alipay plans
    monthlyAlipay: {
      provider: 'alipay',
      id: 'monthlyAlipay',
      amount: 0.01,
      currency: 'CNY',
      duration: {
        months: 1,
        type: 'one_time'
      },
      i18n: {
        'en': {
          name: 'Alipay Monthly Plan',
          description: 'Monthly one time pay via Alipay',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: '支付宝月度',
          description: '通过支付宝的月度一次性支付',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
    monthly: {
      provider: 'stripe',
      id: 'monthly',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'recurring'
      },
      // When using Stripe, subscription duration and price are determined by stripePriceId
      // Duration and amount here are for display and calculation only
      stripePriceId: 'price_1RL2GgDjHLfDWeHDBHjoZaap',
      i18n: {
        'en': {
          name: 'Stripe Monthly Plan',
          description: 'Monthly recurring subscription via Stripe',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: 'Stripe 月度订阅',
          description: '通过 Stripe 的月度循环订阅',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
    lifetime: {
      provider: 'stripe',
      id: 'lifetime',
      amount: 999,
      currency: 'USD',
      recommended: true,
      duration: {
        months: 999999,
        type: 'one_time'
      },
      stripePriceId: 'price_1RL2IcDjHLfDWeHDMCmobkzb',
      i18n: {
        'en': {
          name: 'Stripe Lifetime',
          description: 'One-time payment for permanent access',
          duration: 'lifetime',
          features: [
            'All premium features',
            'Priority support',
            'Free lifetime updates'
          ]
        },
        'zh-CN': {
          name: 'Stripe 终身会员',
          description: '一次性付费永久访问',
          duration: '终身',
          features: [
            '所有高级功能',
            '优先支持',
            '终身免费更新'
          ]
        }
      }
    },
    // PayPal plans - Global market, supports USD
    monthlyPaypal: {
      provider: 'paypal',
      id: 'monthlyPaypal',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'recurring'
      },
      // PayPal Plan ID created in PayPal Dashboard
      // Create at: https://www.sandbox.paypal.com/billing/plans (sandbox)
      // Or: https://www.paypal.com/billing/plans (production)
      paypalPlanId: 'P-5BS42806151539909NF3VZMQ',
      i18n: {
        'en': {
          name: 'PayPal Monthly Plan',
          description: 'Monthly recurring subscription via PayPal',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support',
            'Cancel anytime'
          ]
        },
        'zh-CN': {
          name: 'PayPal 月度订阅',
          description: '通过 PayPal 的月度循环订阅',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持',
            '随时取消'
          ]
        }
      }
    },
    monthlyPaypalOneTime: {
      provider: 'paypal',
      id: 'monthlyPaypalOneTime',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'one_time'
      },
      i18n: {
        'en': {
          name: 'PayPal Monthly (One Time)',
          description: 'One-time payment for monthly access via PayPal',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: 'PayPal 月度 (一次性)',
          description: '通过 PayPal 的一次性月度付费',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
    monthlyCreem: {
      provider: 'creem',
      id: 'monthlyCreem',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'recurring'
      },
      creemProductId: 'prod_1M1c4ktVmvLgrNtpVB9oQf',
      i18n: {
        'en': {
          name: 'Creem Monthly Plan',
          description: 'Monthly recurring subscription via Creem',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: 'Creem 月度订阅',
          description: '通过Creem的月度循环订阅',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
    monthlyCreemOneTime: {
      provider: 'creem',
      id: 'monthlyCreemOneTime',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'one_time'
      },
      creemProductId: 'prod_5BeCtf2LS6KcOvtLuPIpHz',
      i18n: {
        'en': {
          name: 'Creem Monthly Plan (One Time)',
          description: 'One-time payment for monthly access via Creem',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: 'Creem 月度订阅 (一次性)',
          description: '通过Creem的一次性月度付费',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },

    // Credit pack plans - Token-based consumption model
    credits100: {
      provider: 'stripe',
      id: 'credits100',
      amount: 5,
      currency: 'USD',
      duration: { type: 'credits' },
      credits: 100,
      stripePriceId: 'price_1SiVbxDjHLfDWeHDQ4BNtUNT',
      i18n: {
        'en': {
          name: '100 Credits Stripe',
          description: 'Purchase 100 AI credits for on-demand usage',
          duration: 'one-time',
          features: [
            '100 AI conversations',
            'Credits never expire',
            'Pay as you go'
          ]
        },
        'zh-CN': {
          name: '100 积分包 Stripe',
          description: '通过 Stripe 购买的 100 个 AI 积分，按需使用',
          duration: '一次性',
          features: [
            '100 次 AI 对话',
            '积分永不过期',
            '按需付费'
          ]
        }
      }
    },
    credits500: {
      provider: 'wechat',
      id: 'credits500',
      amount: 0.01,
      currency: 'CNY',
      recommended: true,
      duration: { type: 'credits' },
      credits: 550,  // 500 + 50 bonus
      i18n: {
        'en': {
          name: '500 Credits + 50 Bonus Wechat Pay',
          description: 'Best value! Get 550 credits for the price of 500',
          duration: 'one-time',
          features: [
            '550 AI conversations (50 bonus)',
            'Credits never expire',
            'Best value package'
          ]
        },
        'zh-CN': {
          name: '500 积分包 + 50 赠送 微信支付',
          description: '超值优惠！以 500 积分的价格获得 550 积分',
          duration: '一次性',
          features: [
            '550 次 AI 对话 (含 50 赠送)',
            '积分永不过期',
            '最超值套餐'
          ]
        }
      }
    },

    creditsPaypal: {
      provider: 'paypal',
      id: 'creditsPaypal',
      amount: 5,
      currency: 'USD',
      duration: { type: 'credits' },
      credits: 100,
      i18n: {
        'en': {
          name: '100 Credits PayPal',
          description: 'Purchase 100 AI credits via PayPal',
          duration: 'one-time',
          features: [
            '100 AI conversations',
            'Credits never expire',
            'Pay as you go'
          ]
        },
        'zh-CN': {
          name: '100 积分包 PayPal',
          description: '通过 PayPal 购买的 100 个 AI 积分',
          duration: '一次性',
          features: [
            '100 次 AI 对话',
            '积分永不过期',
            '按需付费'
          ]
        }
      }
    },

    // Dodo Payments plans - Global market, Merchant of Record
    monthlyDodo: {
      provider: 'dodo',
      id: 'monthlyDodo',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'recurring'
      },
      dodoProductId: 'pdt_0Nfs0wseuWrL3JU1oDb7q',
      i18n: {
        'en': {
          name: 'Dodo Monthly Plan',
          description: 'Monthly recurring subscription via Dodo Payments',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: 'Dodo 月度订阅',
          description: '通过 Dodo Payments 的月度循环订阅',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
    monthlyDodoOneTime: {
      provider: 'dodo',
      id: 'monthlyDodoOneTime',
      amount: 10,
      currency: 'USD',
      duration: {
        months: 1,
        type: 'one_time'
      },
      dodoProductId: 'pdt_0Nfs1N0wskciXrN3Oo82c',
      i18n: {
        'en': {
          name: 'Dodo Monthly Plan (One Time)',
          description: 'One-time payment for monthly access via Dodo Payments',
          duration: 'month',
          features: [
            'All premium features',
            'Priority support'
          ]
        },
        'zh-CN': {
          name: 'Dodo 月度 (一次性)',
          description: '通过 Dodo Payments 的一次性月度付费',
          duration: '月',
          features: [
            '所有高级功能',
            '优先支持'
          ]
        }
      }
    },
    creditsDodo: {
      provider: 'dodo',
      id: 'creditsDodo',
      amount: 5,
      currency: 'USD',
      duration: { type: 'credits' },
      credits: 100,
      dodoProductId: 'pdt_0Nfs1WwY1J0Vz4KYZNlEi',
      i18n: {
        'en': {
          name: '100 Credits Dodo',
          description: 'Purchase 100 AI credits via Dodo Payments',
          duration: 'one-time',
          features: [
            '100 AI conversations',
            'Credits never expire',
            'Pay as you go'
          ]
        },
        'zh-CN': {
          name: '100 积分包 Dodo',
          description: '通过 Dodo Payments 购买的 100 个 AI 积分',
          duration: '一次性',
          features: [
            '100 次 AI 对话',
            '积分永不过期',
            '按需付费'
          ]
        }
      }
    },
  } as const,
} as const;
