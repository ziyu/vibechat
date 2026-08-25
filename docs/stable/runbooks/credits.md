# 积分账本 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-24
> 维护范围：`libs/credits`、用户积分 API、AI 计费、支付履约与 Admin 账本

积分是用户购买、AI 消耗、失败退款和推荐奖励的统一账本。余额是当前快照，`credit_transaction` 是不可重复写入的审计记录；服务端始终以交易 ID 保证幂等。

## 前置条件

- 数据库迁移已应用，包含 `user.creditBalance`、`credit_transaction` 和 AI task 表。
- Backend 运行在 `8002`，Web 运行在 `8001`，Admin 运行在 `8005`。
- 修改余额的调用方已经生成可重试的稳定 `transactionId`。

## 用户与 Admin 查询

- 当前用户：`GET /api/credits/status`、`GET /api/credits/transactions?page=1&limit=10`。
- Admin：`GET /api/admin/credits/transactions`，支持有界分页、搜索、类型和排序。
- 未登录用户接口返回 `401`；非 Admin 请求全局账本返回 `403`。

Web 的 `/account` 展示当前用户余额与流水，Admin 的 `/admin/credits` 展示全局账本。两者都读取真实数据库，不使用 fixture。

## 新账号欢迎积分

- Better Auth 成功创建用户后由服务端 hook 调用统一积分账本，默认发放 100 credits；通过 `CREDITS_NEW_USER_GRANT` 调整，设为 `0` 时关闭。
- 交易 ID 固定为 `signup:welcome:<userId>`，类型为 `bonus`，交易代码为 `new_user_bonus`。账号创建重试或 hook 重放只会命中同一交易，不重复增加余额。
- 欢迎积分与推荐奖励是两笔独立交易。启用推荐后，被推荐人余额是欢迎积分加推荐奖励，不能把推荐 claim 当作欢迎积分实现。
- 测试“余额不足”时必须显式把余额设置为 `0`；新注册账号不再天然表示零余额。

## 写入不变量

1. `addCredits` 与 `consumeCredits` 都要求交易 ID；重复调用只返回第一次结果。
2. PostgreSQL、SQLite 与 D1 的余额变更和账本插入保持原子；条件扣减不能把余额降到零以下。
3. 支付购买使用订单派生交易 ID；AI 预留、结算与退款使用请求派生交易 ID；推荐奖励使用被推荐用户派生交易 ID。
4. 新账号欢迎积分使用用户 ID 派生的稳定交易 ID；hook 或账本写入失败必须记录为注册错误，并用同一 helper/交易 ID 安全重试，不能人工生成第二个补偿 ID。
5. 退款记录携带原交易 ID、provider、模型或订单等对账 metadata，不覆盖原交易。
6. 金额必须是有限正数；服务端拒绝 `NaN`、`Infinity`、零和负数。

## 验证

```bash
pnpm vitest run tests/unit/credits tests/unit/ai tests/unit/payment tests/unit/affiliate tests/unit/auth/account-deletion.test.ts
API_TEST_BASE_URL=http://localhost:8001 pnpm vitest run --config vitest.api.config.ts tests/api/ownership-boundary.test.ts tests/api/admin-permission.test.ts
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/account-services-ai.spec.ts tests/e2e/specs/admin-app.spec.ts
```

无 AI/provider key 时，聊天、图片和视频失败路径必须验证余额恢复且退款只发生一次；这不替代配置凭据后的真实 provider 成功链路。

## 故障处理

- 余额与流水不一致：按用户 ID 和交易 ID查账，先停止重复补偿，不要直接改余额。
- 退款失败：保留原 consume 记录与任务/订单状态，用相同退款交易 ID重试。
- 重复交易返回不同内容：视为幂等冲突，检查调用方是否复用了错误的 request/order ID。

活动实现：`libs/credits`；用户 API：`apps/backend/src/routes/api/credits/*`；Admin API：`apps/backend/src/routes/api/admin/credits/transactions/index.ts`。
