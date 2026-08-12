# Vibe Chat 开发 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：日常功能开发与交付

## 应用边界

仓库有三个活动运行应用：`apps/site-app`（官网）、`apps/web-app`（产品 Web/PWA）和 `apps/backend`（共享后端）。`apps/docs-app` 是独立文档站，不是产品实现。

| 内容 | 放置位置 |
| --- | --- |
| 共享业务与 Provider 逻辑 | `libs/*` |
| 静态选项和默认配置 | `config/*`、`config.ts` |
| React 共享组件与 hooks | `packages/react-shared/src` |
| 官网页面 | `apps/site-app/src/routes/$lang/**` |
| 产品页面 | `apps/web-app/src/routes/$lang/**` |
| 产品 API、Auth 与上传 | `apps/backend/src/routes/**` |
| Web 同源网关 | `apps/web-app/src/routes/api/$.ts`、`v1/$.ts` |
| 旧 SaaS 快照 | `legacy/*`（不参与构建） |
| 翻译 | `packages/i18n/src/locales/en.ts`、`zh-CN.ts` |

## 标准开发流程

1. 在 `tests/e2e/TEST-CATALOG.md` 写清验收场景。
2. 先实现共享库与配置，再接 TanStack 页面/API。
3. 为页面增加 `beforeLoad` 守卫，为 backend API 独立增加认证与权限检查。
4. 用户可见文本先加英文 key，再同步中文。
5. 用浏览器走通实际流程后再写 Playwright selector。
6. 运行 `pnpm boundaries:check`、相关 E2E、`pnpm typecheck`、`pnpm build` 和 `pnpm docs:check`。

## API 规则

- 路由只解析请求、调用共享逻辑并构造响应。
- 使用明确的 schema 校验输入；不要信任 query、body 或 Provider 回调。
- 错误日志记录 Provider、模型、请求 ID 等调试上下文，但不记录密钥和完整用户数据。
- 金钱或积分流程必须有幂等、扣费、失败退款与对账 metadata。

## 文档规则

- 临时方案、调研和待核验说明放 `docs/development/`。
- 稳定内容按类型进入 `docs/stable/designs`、`runbooks`、`references`、`release-notes` 或 `plans`。
- 操作步骤一律写成 Runbook，包含前置条件、步骤、验证和故障处理。
- 被替代内容进入 `docs/archive/`；治理规则不作为生命周期。

## 分支与提交

- 分支使用简短主题，例如 `codex/auth-session-guard`。
- 提交保持单一目的，不混入无关格式化或用户已有改动。
- 提交前运行 `git diff --check` 并查看最终 diff。
