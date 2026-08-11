# 部署 Runbook 索引

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：`apps/web-app` 部署

Vibe Chat 产品应用支持两个构建目标：

| 目标 | 构建命令 | 运行方式 | Runbook |
| --- | --- | --- | --- |
| Cloudflare Workers | 根目录 `pnpm build` | Wrangler | [Cloudflare Workers](./cloudflare-workers.md) |
| Node.js | `cd apps/web-app && pnpm build:node` | `.output/server/index.mjs` | [传统部署](./traditional.md) |
| Docker | 基于 Node.js 构建目标 | 容器运行 Node artifact | [Docker](./docker.md) |
| 其他云平台 | 选择 Workers 或 Node.js 目标 | 平台构建/启动命令 | [云平台](./cloud.md) |

部署前必须运行 `pnpm typecheck`、目标构建和相关 E2E。部署后检查首页、`/api/health`、认证和至少一个依赖数据库的受保护流程。
