# 部署 Runbook 索引

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-26
> 维护范围：官网、产品 Web 与共享 backend 部署

Vibe Chat 使用三个独立部署单元：

| 目标 | 构建命令 | 运行方式 | Runbook |
| --- | --- | --- | --- |
| 官网 | `pnpm --dir apps/site-app build` | Node artifact / 静态边缘 | [传统部署](./traditional.md) |
| 产品 Web | `pnpm --dir apps/web-app build` | Node artifact | [传统部署](./traditional.md) |
| 共享 backend / Workers | `pnpm --dir apps/backend build:cf` | Wrangler | [Cloudflare Workers](./cloudflare-workers.md) |
| 共享 backend / Node.js | `pnpm --dir apps/backend build:node` | `.output/server/index.mjs` | [传统部署](./traditional.md) |

部署前必须运行 `pnpm boundaries:check`、`pnpm typecheck`、目标构建和相关 E2E。部署后分别检查官网、产品入口、Web 同源 `/api/health`、认证和至少一个依赖数据库的受保护流程。

仓库级 CI/CD 统一使用 [CircleCI](../circleci.md)。CircleCI 对所有构建分支执行文档、类型、产品构建、文档站和 Web Docker 验证；当前唯一已自动化的生产部署目标是 `main` 分支经人工批准后的 Backend Cloudflare Workers。其他部署单元在选定生产托管平台并提交发布命令前仍按各自 Runbook 手动交付。
