# TanStack E2E Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-14
> 维护范围：`apps/site-app`、`apps/web-app`、`apps/backend`、`apps/admin-app` Playwright 回归

## 前置条件

- 依赖和 Playwright 浏览器已安装。
- `.env` 与测试数据库可用。
- 需要支付、AI 或邮件 Provider 的用例已准备对应沙盒凭据。

## 1. 启动活动应用

首次运行或需要恢复测试数据时执行：

```bash
pnpm db:migrate:sqlite
pnpm db:seed:sqlite
```

Seed 会恢复以下本地账号：

| 用途 | 邮箱 | 密码 |
| --- | --- | --- |
| Admin | `admin@example.com` | `admin123` |
| 普通产品账号 | `user@example.com` | `user123456` |
| 双向聊天 | `alice@vibechat.test`、`bob@vibechat.test`、`carol@vibechat.test` | `VibeChatTest2026!` |
| 全白账号 | `blank@vibechat.test` | `VibeChatTest2026!` |

每次 seed 都会删除并重建全白账号，同时生成新的 Matrix localpart，确保它不会重新关联旧 Synapse 房间，并且没有好友、邀请、房间、Matrix 身份、订单、订阅、积分交易、提现或 AI 任务；不要在需要保留该账号人工测试进度时重新 seed。

```bash
pnpm dev
```

该命令同时启动 Web `8001`、Backend `8002`、官网 `8003` 和 Admin `8005`。确认 `http://localhost:8001/api/health` 返回 Backend 健康状态，`http://localhost:8003/` 可访问，Admin 登录后能打开 `http://localhost:8005/admin`。

## 2. 运行相关用例

```bash
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/<name>.spec.ts
```

全量回归：

```bash
pnpm test:e2e
```

本地 Synapse ready profile 的完整回归：

```bash
E2E_MATRIX_EXPECT_READY=1 pnpm test:e2e
```

如果 Playwright 下载的 Chrome for Testing 在 macOS 上以 `SIGBUS (BUS_ADRALN)` 退出，可显式使用本机 Chrome；该变量只替换测试浏览器，不改变应用运行时：

```bash
E2E_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
E2E_MATRIX_EXPECT_READY=1 \
pnpm test:e2e
```

D1/Cloudflare backend 回归：

```bash
pnpm test:e2e:cf
```

## 3. 调试

```bash
pnpm test:e2e:ui
```

失败时先查看 Playwright trace、截图和服务器日志，再确认测试数据是否被前一次运行污染。不要用任意延长 timeout 掩盖选择器、等待条件或外部依赖问题。

## 4. 记录结果

- 新功能先在 `tests/e2e/TEST-CATALOG.md` 写验收场景；所有活动用例都位于 `tests/e2e/specs` 并进入默认产品回归。
- UI 完成并由浏览器核验后再编写 `tests/e2e/specs/*.spec.ts`。
- 相关用例通过后更新目录中的结果记录。
- 支付和 AI 用例如果因缺少凭据未运行，交付说明必须明确列出。

详细约定见 `tests/e2e/AGENTS.md`。
