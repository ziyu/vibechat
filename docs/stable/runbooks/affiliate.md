# 推荐、佣金与提现 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-13
> 维护范围：推荐归因、注册奖励、支付佣金、KYC 与提现运营

活动链路覆盖推荐链接捕获、注册后领取、双方积分奖励、支付后佣金、用户提现申请和 Admin 审批。所有用户查询绑定当前 session，所有 Admin 操作经过 `requireAdminAPI`。

## 配置与前置条件

在服务端设置 `AFFILIATE_ENABLED=true`，并确认佣金比例、统一币种、最低提现额、Cookie 天数和双方奖励值。所有产生佣金的方案必须与 `AFFILIATE_CURRENCY` 使用同一币种。

新用户 `kycVerified` 默认是 `false`。运营人员在 `http://localhost:8005/zh-CN/admin/users/:id` 完成身份资料线下审核后，才能打开“提现身份已审核”；前端注册请求不能自行写入该字段。

## 推荐归因

1. 推荐人在 `/$lang/account` 获取 `/referral/:code` 链接。
2. 访问链接后，Web 重定向到本地化注册页并写入 `SameSite=Lax` 推荐 Cookie。
3. 新用户注册/登录后调用 `POST /api/affiliate/claim`。
4. Backend 拒绝无效码、自荐和改绑；成功后按被推荐用户 ID 生成双方奖励幂等键。

重复 claim 不得重复发放奖励。当前用户可通过 `/api/affiliate/stats`、`commissions`、`referrals` 和提现历史接口读取自己的数据。

## 支付佣金

支付发起时把可信推荐归因写入订单 metadata；只有验签或服务端查询确认后的统一履约服务才能创建佣金。一个订单只能生成一条佣金，金额基于服务端订单金额和配置比例，不能由浏览器传入。

## 提现生命周期

1. 用户必须通过 KYC，余额不低于最低提现额。
2. `POST /api/withdrawal/request` 以 request ID 幂等地原子冻结佣金余额并创建 `pending` 记录。
3. Admin 在 `/$lang/admin/withdrawals` 将记录置为 `processing`、`completed` 或 `rejected`。
4. `completed` 和 `rejected` 是终态；拒绝会原子退还冻结余额，重复或并发拒绝不能退款两次。

## 验证

```bash
pnpm vitest run tests/unit/affiliate tests/unit/payment/fulfillment.test.ts
API_TEST_BASE_URL=http://localhost:8001 pnpm vitest run --config vitest.api.config.ts tests/api/ownership-boundary.test.ts tests/api/admin-permission.test.ts
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/account-services-ai.spec.ts tests/e2e/specs/admin-app.spec.ts
```

关键 E2E 必须覆盖双方奖励一次、默认 KYC 拒绝、Admin 审核、提现冻结、拒绝退款和重复拒绝失败。

## 故障处理

- 奖励部分失败：用相同 claim 重试；账本幂等键会补齐缺失方，不重复已成功方。
- 佣金未产生：核对订单推荐 metadata、支付回执金额/币种和 fulfillment 日志。
- 提现无法申请：依次检查开关、KYC、最低金额、币种和可用佣金余额。
- Admin 拒绝失败：终态记录不得人工再次触发；先查记录和余额，避免手工重复退款。

活动实现：`libs/affiliate`、`apps/backend/src/routes/api/affiliate/*`、`api/withdrawal/*` 和 `api/admin/withdrawals/*`。
