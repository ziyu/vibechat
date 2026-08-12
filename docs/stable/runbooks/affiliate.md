# 佣金与提现运营 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：Admin 佣金查询与已有提现记录审批

当前活动产品只保留已有佣金记录的查询和已有提现记录审批，供独立 Admin App 运营历史/种子数据。推荐归因、注册奖励、用户提现申请与支付 Webhook 佣金写入已经迁入 `legacy/`，不能视为上线能力。

## Admin 操作

1. 以管理员身份打开 `http://localhost:8005/zh-CN/admin/commissions`，核验佣金列表、搜索和状态数据来自 Backend。
2. 打开 `http://localhost:8005/zh-CN/admin/withdrawals`，查看真实提现记录。
3. 处理提现时，Admin 调用 `PATCH /api/admin/withdrawals/:id`；允许 `processing`、`completed`、`rejected`。
4. 拒绝请求会把金额退还至用户 `commissionBalance`；已完成或已拒绝记录不能重复处理。

所有 Admin API 都必须经过 `requireAdminAPI`：未登录返回 `401`，普通用户返回 `403`。

## 审批不变量

- 活动代码不读取 Affiliate 环境变量，也不创建佣金或提现记录。
- 已完成或已拒绝记录不能再次处理。
- 审批通过条件状态更新抢占一次处理权；并发拒绝只能退款一次。
- 拒绝时按记录保存的金额退还至用户 `commissionBalance`，非法金额必须失败关闭。

## 恢复用户链路的条件

若后续恢复推荐注册、用户提现或支付佣金，需要同时恢复并验证用户所有权 API、KYC、订单对账、支付 Webhook、失败补偿、单/多币种决策、公开文档和 E2E。`legacy/libs/affiliate` 与 `legacy/libs/payment` 只能作为历史参考，不能直接复制回活动代码。

## 验证

```bash
API_TEST_BASE_URL=http://localhost:8001 pnpm vitest run --config vitest.api.config.ts tests/api/admin-permission.test.ts
E2E_BASE_URL=http://localhost:8001 ADMIN_E2E_ORIGIN=http://localhost:8005 pnpm exec playwright test --config=playwright.config.ts tests/e2e/specs/admin-app.spec.ts
```

活动实现：`libs/affiliate/withdrawal.ts`、`apps/backend/src/routes/api/admin/commissions.ts` 与 `apps/backend/src/routes/api/admin/withdrawals/*`。
