# Node.js 部署 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：传统服务器上的 `apps/web-app`

## 前置条件

- 64 位 Linux 或兼容 Node.js 22 的服务器
- PostgreSQL 或受支持的 SQLite 数据库
- HTTPS 反向代理和进程管理器

## 构建

```bash
pnpm install --frozen-lockfile
pnpm typecheck
cd apps/web-app
pnpm build:node
```

## 启动

从仓库根目录运行：

```bash
NODE_ENV=production node apps/web-app/.output/server/index.mjs
```

生产环境应使用 systemd、PM2 或平台进程管理器，并把 HTTPS、压缩和请求大小限制放在反向代理层。

## 必要环境变量

- `APP_BASE_URL` 使用公开 HTTPS 地址。
- `BETTER_AUTH_SECRET` 和 Provider 密钥通过进程环境或密钥管理器注入。
- `DB_DIALECT`、`DATABASE_URL` 与部署数据库一致。
- 不在服务器镜像或 Git 中保存 `.env` 明文副本。

## 发布后验证

```bash
curl -fsS https://your-domain.example/api/health
```

继续验证首页、登录、数据库读写和本次发布涉及的功能。失败时同时查看应用进程、反向代理和数据库日志。
