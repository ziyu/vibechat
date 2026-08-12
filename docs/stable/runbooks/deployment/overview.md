# 部署 Runbook 索引

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：官网、产品 Web 与共享 backend 部署

Vibe Chat 使用三个独立部署单元：

| 目标 | 构建命令 | 运行方式 | Runbook |
| --- | --- | --- | --- |
| 官网 | `pnpm --dir apps/site-app build` | Node artifact / 静态边缘 | [传统部署](./traditional.md) |
| 产品 Web | `pnpm --dir apps/web-app build` | Node artifact | [传统部署](./traditional.md) |
| 共享 backend / Workers | `pnpm --dir apps/backend build:cf` | Wrangler | [Cloudflare Workers](./cloudflare-workers.md) |
| 共享 backend / Node.js | `pnpm --dir apps/backend build:node` | `.output/server/index.mjs` | [传统部署](./traditional.md) |

部署前必须运行 `pnpm boundaries:check`、`pnpm typecheck`、目标构建和相关 E2E。部署后分别检查官网、产品入口、Web 同源 `/api/health`、认证和至少一个依赖数据库的受保护流程。
