# 云平台部署 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：托管构建平台上的 `apps/web-app`

## 选择运行目标

- Cloudflare Workers：使用[Cloudflare Workers Runbook](./cloudflare-workers.md)。
- 支持长驻 Node.js 进程的平台：使用 Node.js 构建目标。
- 只支持 Next.js 专用构建的平台不能直接按 Next.js 项目导入；产品应用是 TanStack Start。

## Node.js 平台配置

仓库根目录作为构建上下文：

```text
Install command: pnpm install --frozen-lockfile
Build command: pnpm --dir apps/web-app build:node
Start command: node apps/web-app/.output/server/index.mjs
```

至少配置 `APP_BASE_URL`、`BETTER_AUTH_SECRET`、数据库变量，以及已启用 Provider 所需密钥。平台健康检查指向 `/api/health`。

## 验证

1. 构建日志没有缺失环境变量或原生依赖错误。
2. 应用监听平台提供的端口。
3. `APP_BASE_URL` 与公开 HTTPS 域名一致。
4. OAuth callback、支付回跳和 Webhook 使用公开域名。
5. 数据库迁移在发布前以独立步骤完成。

平台特有的零配置声明只有在仓库实际提交对应配置后才能写入本 Runbook。
