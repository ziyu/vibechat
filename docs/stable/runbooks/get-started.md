# Vibe Chat 快速开始 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：本地安装、数据库初始化与产品应用启动

## 前置条件

- Node.js `>=22.0.0`
- pnpm `9.4.0`（以根目录 `packageManager` 为准）
- PostgreSQL、SQLite 或 Cloudflare D1 中的一种数据库

## 1. 获取代码

```bash
git clone git@github.com:ziyu/vibechat.git
cd vibechat
```

## 2. 安装依赖

```bash
pnpm install --frozen-lockfile
```

## 3. 准备环境变量

```bash
cp env.example .env
```

本地最小配置至少需要确认：

- `APP_BASE_URL=http://localhost:8001`
- `BETTER_AUTH_SECRET` 使用足够长的随机值
- `DB_DIALECT` 与所选数据库一致
- PostgreSQL 使用 `DATABASE_URL`；SQLite/D1 按[数据库 Runbook](./database.md)配置

不要把 `.env`、密钥或真实支付凭据提交到 Git。

## 4. 初始化数据库

PostgreSQL：

```bash
pnpm db:check
pnpm db:push
```

本地 SQLite：

```bash
pnpm db:check:sqlite
pnpm db:push:sqlite
```

需要示例数据时再运行相应的 `db:seed` 或 `db:seed:sqlite`。

## 5. 启动产品应用

```bash
pnpm dev
```

访问：

- 产品应用：`http://localhost:8001/zh-CN`
- 健康检查：`http://localhost:8001/api/health`

文档站单独启动：

```bash
pnpm dev:docs
```

## 6. 验证

```bash
pnpm typecheck
pnpm build
pnpm docs:check
```

确认首页、注册/登录页和健康检查可访问。涉及用户流程的功能还需按 `tests/e2e/TEST-CATALOG.md` 运行对应 E2E。

## 故障处理

- 依赖安装失败：确认 Node 与 pnpm 版本符合根目录约束。
- 数据库错误：确认方言、连接串和 schema 初始化命令属于同一种数据库。
- 端口占用：检查 Web `8001`、backend `8002`、官网 `8003` 和 Synapse `8008`。
- SSR 或 Workers 构建失败：查看 `apps/backend/CF-NOTES.md`。

下一步可阅读[配置系统设计](../designs/configuration-system.md)、[认证 Runbook](./auth/overview.md)和[部署 Runbook](./deployment/overview.md)。
