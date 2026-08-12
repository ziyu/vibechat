# 积分账本 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：`libs/credits`、积分数据库字段与 Admin 积分查询

当前积分能力是 Backend 内部的只读历史账本查询，不是已上线的购买或 AI 消耗产品。活动代码只保留 Admin 全局查询；余额写入、推荐奖励、用户购买 API 与 AI token/image/video 计费已经迁入 `legacy/`。

## 前置条件

- 数据库 schema 已包含 `user.creditBalance` 与 `credit_transaction`。
- Backend 运行在 `8002`，Admin 运行在 `8005`。
- 查询全局账本的会话必须具有 `admin` 角色。

## Admin 查询

1. 使用管理员账号登录产品 Web，随后打开 `http://localhost:8005/zh-CN/admin/credits`。
2. Admin 通过自身同源 `/api/admin/credits/transactions` 网关读取 Backend。
3. 核验分页、搜索、类型筛选、金额、交易后余额和创建时间均来自真实数据库，不使用 fixture。

未登录请求必须返回 `401`，普通用户请求必须返回 `403`：

```bash
curl -i http://localhost:8002/api/admin/credits/transactions
```

## 查询不变量

- `limit` 范围为 1–100；页码必须大于等于 1。
- 搜索字段、交易类型与排序字段由共享 API schema 枚举，不接受任意列名。
- 查询返回交易记录当时保存的余额快照，不重新计算历史余额。
- 全局账本数据只对 Admin 开放，不能恢复为无所有权边界的用户 API。

## 当前未启用

- 用户充值、订阅、结账和支付 Webhook。
- AI 模型 token、图片或视频生成计费。
- 用户端余额/交易记录页面。

恢复上述任一能力前，需要先进入产品稳定设计，补齐权限、计费失败退款、对账元数据、provider 集成和真实 E2E，不得仅恢复 `legacy/` 代码。

## 验证

```bash
API_TEST_BASE_URL=http://localhost:8001 pnpm vitest run --config vitest.api.config.ts tests/api/admin-permission.test.ts
E2E_BASE_URL=http://localhost:8001 ADMIN_E2E_ORIGIN=http://localhost:8005 pnpm exec playwright test --config=playwright.config.ts tests/e2e/specs/admin-app.spec.ts
```

活动实现：`libs/credits/service.ts`；共享输入契约：`packages/api-contracts/src/admin.ts`；Admin API：`apps/backend/src/routes/api/admin/credits/transactions/index.ts`。
