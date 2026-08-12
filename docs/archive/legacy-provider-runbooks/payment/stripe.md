# Stripe Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：Stripe 支付

Stripe 是全球领先的在线支付平台，支持多种币种和支付方式，特别适合国际业务。

## 📑 目录

- [📋 申请流程](#-申请流程)
- [🔑 环境变量配置](#-环境变量配置)
- [✨ 特性](#-特性)
- [🔗 获取价格 ID](#-获取价格-id)
- [🛠️ 计划配置示例](#️-计划配置示例)

## 📋 申请流程

1. **注册 Stripe 账号**
   - 访问 [Stripe 官网](https://stripe.com/)
   - 使用邮箱注册账号
   - 完成身份验证（需要提供企业或个人信息）

2. **获取 API 密钥**
   - 登录 Stripe Dashboard
   - 前往 "开发者" → "API 密钥"
   - 获取可发布密钥 (Publishable Key) 和秘密密钥 (Secret Key)

3. **创建产品和价格**
   - 在 Dashboard 创建产品 (Products)
   - 为每个产品创建价格 (Prices)
   - 记录价格ID，用于配置 `stripePriceId`

4. **配置 Webhook（生产环境）**

   > **开发环境提示（历史）**：如果是本地开发测试，可以先跳过此步骤，使用 Stripe CLI 进行 webhook 转发即可。详见[归档支付测试 Runbook](./testing.md)。

   **生产环境配置：**
   - 前往 "开发者" → "Webhooks"
   - 添加端点：`https://yourdomain.com/api/payment/webhook/stripe`
   - 选择事件：`checkout.session.completed`, `payment_intent.succeeded`
   - 记录 Webhook 签名秘钥，用于环境变量 `STRIPE_WEBHOOK_SECRET`

## 🔑 环境变量配置

在 `.env` 文件中添加：

```env
# Stripe 配置
STRIPE_SECRET_KEY=sk_test_xxxxxxxx        # 秘密密钥 (生产环境用 sk_live_)
STRIPE_PUBLIC_KEY=pk_test_xxxxxxxx        # 可发布密钥 (生产环境用 pk_live_)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx      # Webhook 签名秘钥 (本地开发用 Stripe CLI 时会自动生成)
```

> 📝 **开发环境说明**：
> - 使用 Stripe CLI 进行本地开发时，`STRIPE_WEBHOOK_SECRET` 会在运行 `stripe listen` 命令时自动生成
> - 生产环境部署时，需要在 Stripe Dashboard 创建 Webhook 端点并获取签名秘钥

## ✨ 特性

- 支持全球多种币种 (USD, EUR, CNY, JPY 等)
- 支持单次付费和订阅模式
- 支持信用卡、借记卡、数字钱包等多种支付方式
- 个人和企业均可申请

## 🔗 获取价格 ID

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 前往 "产品" → "产品目录"
3. 创建产品并设置价格
4. 复制价格 ID (以 `price_` 开头)

## 🛠️ 计划配置示例

### 订阅方案

```typescript
monthly: {
  provider: 'stripe',
  id: 'monthly',
  // 当使用 Stripe 支付时，订阅的时长和价格将由 stripePriceId 决定
  // 这里的 duration 和 amount 仅用于显示和计算，实际订阅周期和价格以 Stripe 后台配置为准
  amount: 10,                   // 显示金额
  currency: 'CNY',
  duration: {
    months: 1,
    type: 'recurring'           // 支持订阅模式
  },
  stripePriceId: 'price_1RL2GgDjHLfDWeHDBHjoZaap', // Stripe 价格 ID
  recommended: true,            // 推荐标记
  i18n: {
    'en': {
      name: 'Monthly Plan',
      description: 'Perfect for short-term projects',
      duration: 'month',
      features: ['All premium features', 'Priority support']
    },
    'zh-CN': {
      name: '月度订阅',
      description: '每月订阅，灵活管理',
      duration: '月',
      features: ['所有高级功能', '优先支持']
    }
  }
}
```

### 终身方案（单次付费）

```typescript
lifetime: {
  provider: 'stripe',
  id: 'lifetime',
  amount: 999,
  currency: 'CNY',
  recommended: true,            // 设为推荐
  duration: {
    months: 999999,             // 表示终身 plan.duration.months >= 9999; 会被定义为终生会员
    type: 'one_time'           // 单次付费
  },
  stripePriceId: 'price_1RL2IcDjHLfDWeHDMCmobkzb',
  i18n: {
    'en': {
      name: 'Lifetime',
      description: 'One-time payment, lifetime access',
      duration: 'lifetime',
      features: ['All premium features', 'Priority support', 'Free lifetime updates']
    },
    'zh-CN': {
      name: '终身会员',
      description: '一次付费，永久使用',
      duration: '终身',
      features: ['所有高级功能', '优先支持', '终身免费更新']
    }
  }
}
```

---

返回 [支付配置概览](./overview.md)
