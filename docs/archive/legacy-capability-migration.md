# 产品能力迁移完成记录

> 生命周期：已归档
> 状态：已归档
> 更新日期：2026-08-14
> 维护范围：账户中心、定价、上传、积分、推荐返利、提现、支付、AI 与运营回归

## 归档原因

本计划已完成。旧脚手架中仍有业务价值的账户、定价、上传、积分、推荐、提现、六个支付 provider、AI 对话/图片/视频和 Admin 运营能力已经进入当前 app/package/lib 边界；`legacy/` 与 `tests/e2e/legacy` 的第二份源码和测试快照已删除。

当前行为以 [VibeChat MVP 版本产品与技术设计](../stable/designs/vibechat-mvp-product-and-technical-design.md)、[支付 Provider Runbook](../stable/runbooks/payment/providers.md)、[AI Runbook](../stable/runbooks/ai.md)、[积分账本 Runbook](../stable/runbooks/credits.md)和[推荐/提现 Runbook](../stable/runbooks/affiliate.md)为准。本文件只保存迁移范围和完成证据。

## 完成结果

| 工作流 | 结果 | 证据摘要 |
| --- | --- | --- |
| 账户、定价与上传 | Complete | 真实账户/订单/订阅/积分读取，密码修改、账户删除、订阅守卫、上传输入与 provider 失败关闭通过 Chromium |
| 积分、推荐与提现 | Complete | PG/SQLite/D1 原子账本、确定性幂等键、注册双向奖励、佣金、KYC 提现冻结与拒绝单次退款通过单元/API/E2E |
| 支付与对账 | Complete | Stripe、PayPal、Creem、Dodo、微信、支付宝 adapter 进入 Backend；统一履约校验订单、回执用户/计划/商品、金额与币种，重复回执不重复发权益 |
| AI 与计费 | Complete | 对话、图片、视频使用 Backend provider；预留、结算、持久任务与失败退款通过无凭据真实失败路径 |
| Admin 深度运营 | Complete | 用户/KYC、订阅、订单、积分、定价、Blog、佣金、提现读写通过独立 Admin App 与 Backend 权限边界 |
| Legacy 清理 | Complete | 无唯一能力留在 `legacy/`；活动源码和 E2E 只有当前实现；文档与公开用户内容已更新 |

## 验证证据

- 完整 Chromium：53 passed，0 failed，0 skipped；SQLite + 本地 Synapse，覆盖认证、聊天、账户、服务、AI/退款、推荐、提现/KYC 和 Admin。
- Matrix Application Service：真实本地 Synapse 集成 1 passed。
- API：4 files / 20 tests passed，覆盖公开、认证、Admin 和资源 ownership。
- 领域：支付、AI、推荐和账户删除相关单元测试通过；支付履约额外覆盖金额、用户、计划与 provider 商品错绑拒绝。
- 构建：10 个 workspace packages、Web、Backend Node/Workers、Site、Admin 和 Docs 静态导出通过；Workers 本地预览 health `200`，未登录 bootstrap/Admin/payment `401`。

## 外部验收边界

本地没有提交任何支付、AI 或对象存储生产/沙盒密钥。因此已验证无密钥时的显式失败、账本退款、签名算法与统一履约；没有把外部供应商成功调用声明为本次通过。每个 provider 上线前仍按对应 Runbook 使用独立沙盒/测试商户完成 checkout/generation/upload、回调和对账验收。
