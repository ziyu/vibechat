# `@libs/payment`

Backend 内部统一支付库，活动 provider 为 Stripe、PayPal、Creem、Dodo、微信支付和支付宝。它负责创建 provider checkout、验证回调/Webhook，并把可信结果交给统一履约服务；订单、订阅、终身权益、积分充值与推荐佣金都以订单 ID 幂等结算。

用户结账入口为 `POST /api/payment/initiate`，provider 回调位于 `apps/backend/src/routes/api/payment/*`，Web 定价与支付结果页位于 `apps/web-app/src/features/services` 和 `features/payment`。配置键见根 `env.example`，操作步骤见 [`docs/stable/runbooks/payment/providers.md`](../../docs/stable/runbooks/payment/providers.md)。

浏览器不能提交金额；Return URL 不能确认到账；缺少 provider 凭据时 checkout 必须关闭失败并终止本地订单。
