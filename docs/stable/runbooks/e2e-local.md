# TanStack E2E Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：`apps/web-app` Playwright 回归

## 前置条件

- 依赖和 Playwright 浏览器已安装。
- `.env` 与测试数据库可用。
- 需要支付、AI 或邮件 Provider 的用例已准备对应沙盒凭据。

## 1. 启动产品应用

```bash
pnpm dev
```

确认 `http://localhost:8001/api/health` 返回成功。

## 2. 运行相关用例

```bash
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/<name>.spec.ts
```

全量回归：

```bash
pnpm test:e2e
```

D1/Cloudflare 回归：

```bash
pnpm test:e2e:cf
```

## 3. 调试

```bash
pnpm test:e2e:ui
```

失败时先查看 Playwright trace、截图和服务器日志，再确认测试数据是否被前一次运行污染。不要用任意延长 timeout 掩盖选择器、等待条件或外部依赖问题。

## 4. 记录结果

- 新功能先在 `tests/e2e/TEST-CATALOG.md` 写验收场景。
- UI 完成并由浏览器核验后再编写 `tests/e2e/specs/*.spec.ts`。
- 相关用例通过后更新目录中的结果记录。
- 支付和 AI 用例如果因缺少凭据未运行，交付说明必须明确列出。

详细约定见 `tests/e2e/AGENTS.md`。
