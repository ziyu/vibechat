# Creem Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：Creem 支付

Creem 是新兴的支付平台，提供灵活的定价和订阅管理功能。它比 Stripe 的要求更简单，是非常适合独立开发者出海的平台。

## 📑 目录

- [📋 申请流程](#-申请流程)
- [🔑 环境变量配置](#-环境变量配置)
- [✨ 特性](#-特性)
- [🛠️ 计划配置示例](#️-计划配置示例)

## 📋 申请流程

1. **注册 Creem 账号**
   - 访问 [Creem 官网](https://creem.io/)
   - 注册账号并完成验证

2. **获取 API 密钥**
   - 登录 Creem Dashboard
   - 前往 API 设置页面
   - 生成 API Key 和 Webhook Secret

3. **创建产品**
   - 使用 API 或 Dashboard 创建产品
   - 配置价格和订阅周期
   - 记录产品ID，用于配置 `creemProductId`

4. **配置 Webhook**
   - 前往 "Developers" → "Webhooks"
   - 添加 Webhook URL：`https://yourdomain.com/api/payment/webhook/creem`

## 🔑 环境变量配置

在 `.env` 文件中添加：

```env
# Creem 配置
CREEM_API_KEY=creem_xxxxxxxx             # API 密钥
CREEM_SERVER_URL=https://api.creem.io    # 服务器地址 (可选，默认为测试环境)
CREEM_WEBHOOK_SECRET=whsec_xxxxxxxx      # Webhook 签名秘钥
```

## ✨ 特性

- 支持多种币种
- 灵活的定价模型
- 支持单次付费和订阅模式
- 现代化的 API 设计
- 审核要求比 Stripe 更简单
- 适合独立开发者出海

## 🛠️ 计划配置示例

```typescript
monthlyCreem: {
  provider: 'creem',
  id: 'monthlyCreem',
  amount: 10,
  currency: 'USD',
  duration: {
    months: 1,
    type: 'recurring'
  },
  creemProductId: 'prod_1M1c4ktVmvLgrNtpVB9oQf', // Creem 产品 ID
  i18n: {
    'en': {
      name: 'Monthly Plan (Creem)',
      description: 'Perfect for short-term projects via Creem',
      duration: 'month',
      features: ['All premium features', 'Priority support']
    },
    'zh-CN': {
      name: '月度订阅 (Creem)',
      description: '每月订阅，通过Creem支付',
      duration: '月',
      features: ['所有高级功能', '优先支持']
    }
  }
}
```

---

返回 [支付配置概览](./overview.md)
