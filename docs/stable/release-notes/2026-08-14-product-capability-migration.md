# 2026-08-14 产品能力迁移

> 生命周期：长期稳定
> 文档类型：发布说明
> 状态：生效
> 更新日期：2026-08-14
> 维护范围：Web、Backend、Admin、共享 packages、账户/商业化/AI 领域

## 交付内容

- 产品 Web 新增真实账户中心、服务/定价、上传、支付结果、AI 对话、图片与视频页面；高级功能使用持久订阅权益守卫。
- Backend 新增账户、积分、推荐、佣金、提现、支付和 AI API；Web/Admin 只通过共享 API contract 和 product client 消费。
- 六个支付 provider 使用统一服务端履约，绑定本地订单与签名回执中的用户、计划、商品、金额和币种，权益、积分与佣金使用确定性幂等键。
- AI 对话、图片和视频任务接入真实 provider adapter，覆盖积分预留、结算、持久状态和失败退款；日志不保留 prompt、provider payload、支付凭据或完整上游错误。
- 独立 Admin App 恢复用户/KYC、订阅、订单、积分、动态定价、Blog、佣金与提现运营能力。
- 删除 `legacy/` 与 `tests/e2e/legacy` 的重复实现；历史决策只在归档文档中保留。

## 数据与兼容性

- 新增 AI 生成任务和用户 KYC 字段的 PostgreSQL/SQLite/D1 migration；新用户默认未通过 KYC。
- Seed 会幂等恢复 `admin@example.com` 的管理员角色、已验证状态和密码，并删除后重建 `blank@vibechat.test`，确保该账号没有好友、邀请、会话、账务或 AI 历史。
- 本地端口固定为 Web `8001`、Backend `8002`、Site `8003`、Admin `8005`。
- Docs 依赖对齐到 Fumadocs core/ui `16.14.4`、mdx `15.2.3` 与 Next `16.3.0`，默认使用稳定的 webpack 静态构建。

## 安全与账务影响

- 所有用户订单、积分、推荐和提现接口验证当前 session 与资源归属；Admin mutation 由 Backend 复核角色。
- 支付成功页不是账务权威；只有验签/服务端确认的 provider 回执可以履约。微信 API 响应验签失败会 fail-closed。
- 账户删除会拒绝仍有活动循环订阅的用户；提现要求 KYC，拒绝只释放一次冻结余额。

## 验证与未覆盖项

完整现行 Chromium E2E 53/53 通过，API ownership 20/20、真实 Synapse Application Service、领域单元测试、workspace/app/Workers/Docs 构建和 workerd smoke 通过。外部支付、AI 和存储成功链路因本地无供应商凭据未执行；上线前按稳定 Runbook 逐 provider 完成沙盒验收。
