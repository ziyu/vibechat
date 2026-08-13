# 支付 Provider Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-14
> 维护范围：Stripe、PayPal、Creem、Dodo、微信支付、支付宝与统一履约

## 前置条件

- 在 `config/payment.ts` 或动态定价中配置方案；方案 provider 与 provider-specific product/price ID 保持一致。
- 只配置需要启用的 provider 密钥，变量名以根 `env.example` 为准。
- Webhook/notify URL 指向公开 Backend 路径 `/api/payment/webhook/:provider`；本地测试需要 provider CLI 或安全隧道。
- 使用测试/沙盒账号，微信支付没有通用沙盒时只能在明确授权的小额商户环境验证。

## 支持范围

| Provider | 主要模式 | 回执权威 |
| --- | --- | --- |
| Stripe | 单次、订阅、积分、Portal | 签名 Webhook / 服务端 Session 查询 |
| PayPal | 单次 capture、订阅、积分 | 服务端 capture + Webhook 验签 |
| Creem | 单次、订阅、积分 | 签名 Webhook / 服务端 checkout 查询 |
| Dodo | 单次、订阅、积分 | 签名 Webhook |
| 微信支付 | 单次、积分 | 平台签名通知 |
| 支付宝 | 单次、积分 | 支付宝签名通知 |

## 结账与履约

1. 用户从 `/$lang/services` 选择方案，Web 仅提交 `planId`、provider 和 request ID。
2. Backend 从服务端方案读取金额/币种，创建 `pending` 订单，再创建 provider checkout。
3. 相同 request ID 只返回同一 checkout；创建失败将订单置为 `failed`，重试需要新 ID。
4. `/payment-success` 和 `/payment-cancel` 只展示 UX，不确认到账。
5. 可信回执进入 `fulfillPaidOrder`，校验订单、provider、签名回执中的用户/计划/provider 商品、金额和币种，然后幂等更新订单、订阅/终身权益、积分和推荐佣金。

## 验证

```bash
pnpm vitest run tests/unit/payment tests/unit/affiliate tests/unit/credits
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/account-services-ai.spec.ts
```

每个计划上线前还要在对应 sandbox 完成：创建 checkout、付款/取消、回跳、Webhook、订单状态、权益或积分入账、重复通知不重复履约。没有外部凭据时只能声明本地失败关闭、签名单元测试和履约幂等已通过。

## 故障处理

- checkout 503：检查 provider 密钥、方案 ID 和环境；失败订单不得重用 request ID。
- Webhook 400：保留原始请求字节，核对签名 secret、时钟和 endpoint 环境。
- 支付成功但未履约：按订单 ID 查询 provider 回执与 fulfillment 日志；不要从成功页手工确认。
- 重复入账风险：检查所有积分与佣金交易 ID 是否从订单 ID 派生，再使用原 Webhook 重放验证。
