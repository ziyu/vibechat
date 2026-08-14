# TanStack Start 应用 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：`apps/site-app`、`apps/web-app`、`apps/backend`

## 目录约定

| 内容 | 位置 |
| --- | --- |
| 官网页面与 Blog 网关 | `apps/site-app/src/routes` |
| 产品页面与同源 backend 网关 | `apps/web-app/src/routes` |
| 产品 API、Auth 与上传 | `apps/backend/src/routes` |
| 产品组件 | `apps/web-app/src/components`、`src/features` |
| 应用 hooks | `apps/web-app/src/hooks` |
| 应用服务端适配 | `apps/web-app/src/lib` |
| 共享 React UI | `packages/react-shared/src` |
| 业务逻辑 | `libs/*` |
| 配置 | `config/*`、`config.ts` |

## 页面路由

- 多语言页面位于 `src/routes/$lang/**`。
- 官网页面位于 `site-app`；产品 Web 的活动页面只包含 `(auth)`、`(chat)`、onboarding 和产品根入口。
- 保护页面通过 `beforeLoad` 调用 `src/lib/auth-guard.ts`。
- 用户可见字符串使用 `packages/i18n`，页面不得硬编码文案。

## API 与 Server Function

- 原始 HTTP、上传和认证 handler 使用 `apps/backend/src/routes/**`。
- Web 的 `/api/$` 与 `/v1/$` 只做同源透传，不包含业务逻辑。
- 页面数据 RPC 可以使用 `createServerFn`。
- 两者都只负责编排；共享业务逻辑放 `libs/*`。
- backend 的 Cloudflare 数据库绑定通过 `withCfDb` 接入。

## 常用命令

```bash
pnpm dev
pnpm dev:web
pnpm dev:site
pnpm typecheck
pnpm build
```

独立应用构建：

```bash
pnpm --dir apps/site-app build
pnpm --dir apps/web-app build:node
pnpm --dir apps/backend build:node
pnpm --dir apps/backend preview:cf
```

## 新增页面检查

1. 文件路径和 route ID 符合 TanStack Router 约定。
2. `beforeLoad` 与 API 权限保持一致。
3. 英文、中文翻译 key 同步。
4. SSR 首次加载与客户端导航都能工作。
5. 验收场景、浏览器核验和 E2E 完成。

Cloudflare 已知问题见 `apps/backend/CF-NOTES.md`。
