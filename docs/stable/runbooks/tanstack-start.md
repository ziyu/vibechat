# TanStack Start 应用 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：`apps/web-app`

## 目录约定

| 内容 | 位置 |
| --- | --- |
| 路由 | `apps/web-app/src/routes` |
| 产品组件 | `apps/web-app/src/components` |
| 应用 hooks | `apps/web-app/src/hooks` |
| 应用服务端适配 | `apps/web-app/src/lib` |
| 共享 React UI | `libs/react-shared` |
| 业务逻辑 | `libs/*` |
| 配置 | `config/*`、`config.ts` |

## 页面路由

- 多语言页面位于 `src/routes/$lang/**`。
- 普通页面放在 `(root)` route group，认证页放 `(auth)`，管理页面放 `admin`。
- 保护页面通过 `beforeLoad` 调用 `src/lib/auth-guard.ts`。
- 用户可见字符串使用 `libs/i18n`，页面不得硬编码文案。

## API 与 Server Function

- 原始 HTTP、Webhook、上传和认证 handler 使用 `src/routes/api/**`。
- 页面数据 RPC 可以使用 `createServerFn`。
- 两者都只负责编排；共享业务逻辑放 `libs/*`。
- Cloudflare 数据库绑定通过 `withCfDb` 或 `withDbContext` 接入。

## 常用命令

```bash
pnpm dev
pnpm typecheck
pnpm build
```

应用内 Node.js 和 Cloudflare 目标：

```bash
cd apps/web-app
pnpm build:node
pnpm preview:cf
```

## 新增页面检查

1. 文件路径和 route ID 符合 TanStack Router 约定。
2. `beforeLoad` 与 API 权限保持一致。
3. 英文、中文翻译 key 同步。
4. SSR 首次加载与客户端导航都能工作。
5. 验收场景、浏览器核验和 E2E 完成。

Cloudflare 已知问题见 `apps/web-app/CF-NOTES.md`。
