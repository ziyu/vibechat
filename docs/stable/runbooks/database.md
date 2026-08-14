# 数据库 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：PostgreSQL、SQLite 与 D1

Vibe Chat 支持多种数据库方言，通过 `DB_DIALECT` 环境变量在部署时切换，无需修改业务代码。

## 🔗 相关页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 快速开始 | [get-started.md](./get-started.md) | 首次安装和数据库初始化 |
| Cloudflare Workers 部署 | [deployment/cloudflare-workers.md](./deployment/cloudflare-workers.md) | Hyperdrive / D1 部署配置 |
| 数据库架构（开发者） | [libs/database/AGENTS.md](../../../libs/database/AGENTS.md) | Schema 结构、代码风格、驱动实现 |

## 📑 目录

- [支持的数据库方言](#支持的数据库方言)
- [方言切换](#方言切换)
- [PostgreSQL 配置](#postgresql-配置)
- [SQLite 配置](#sqlite-配置)
- [Cloudflare D1 配置](#cloudflare-d1-配置)
- [Schema 管理命令](#schema-管理命令)
- [方言之间的差异](#方言之间的差异)
- [常见问题](#常见问题)

## 支持的数据库方言

| 方言 | `DB_DIALECT` | 驱动 | 适用场景 |
|------|-------------|------|----------|
| **PostgreSQL** | `pg`（默认） | `node-postgres` (pg) | 生产环境首选，所有部署方式均支持 |
| **SQLite** | `sqlite` | `better-sqlite3` | 与 D1 兼容的本地方案，适合 All-in Cloudflare 用户 |
| **Cloudflare D1** | `d1` | `drizzle-orm/d1` | Cloudflare Workers 上的托管 SQLite |

> **PostgreSQL 是默认且推荐的数据库**。项目在 PostgreSQL 上经过最完整的测试和验证。
> SQLite / D1 作为补充方案，主要面向希望 All-in Cloudflare 的用户。

## 方言切换

通过 `.env` 文件中的 `DB_DIALECT` 环境变量控制：

```env
# PostgreSQL（默认，可不设置）
DB_DIALECT="pg"

# 本地 SQLite
DB_DIALECT="sqlite"

# Cloudflare D1（仅用于 Workers 部署）
DB_DIALECT="d1"
```

切换方言时需要：

1. 修改 `.env` 中的 `DB_DIALECT`
2. 确保目标数据库已初始化表结构（参见下方各方言的初始化命令）
3. 重启应用

> **注意**：三种方言使用的数据库是独立的（PG 和 SQLite 各有自己的数据），切换方言不会自动迁移数据。

## PostgreSQL 配置

### 环境变量

```env
DB_DIALECT="pg"
DATABASE_URL="postgresql://username:password@localhost:5432/vibechat"
```

### 初始化

```bash
pnpm db:check          # 检查连接
pnpm db:push           # 推送 schema（开发环境）
pnpm db:seed           # 填充测试数据
pnpm db:studio         # 打开 Drizzle Studio 可视化管理
```

### 生产环境迁移

```bash
pnpm db:generate       # 生成迁移文件
pnpm db:migrate        # 应用迁移
```

### 推荐的数据库服务

| 服务 | 说明 |
|------|------|
| **Docker PostgreSQL** | 本地开发首选，简单可控 |
| **Vercel Postgres** | Vercel 部署时无缝集成 |
| **Supabase** | 免费套餐，内置 Auth 和 Storage |
| **Neon** | Serverless PostgreSQL，支持分支 |
| **AWS RDS / 阿里云 RDS** | 企业级托管 |

## SQLite 配置

### 环境变量

```env
DB_DIALECT="sqlite"
# 可选：自定义路径（默认 ./data/local.sqlite）
# SQLITE_DB_PATH="./data/local.sqlite"
```

### 初始化

```bash
pnpm db:check:sqlite   # 检查连接
pnpm db:push:sqlite    # 推送 schema（自动创建 data/ 目录和 .sqlite 文件）
pnpm db:seed:sqlite    # 填充测试数据
pnpm db:studio:sqlite  # 打开 Drizzle Studio 可视化管理
```

`pnpm db:seed:sqlite` 是幂等操作，会创建通用管理/普通用户，并保证以下聊天测试用户具有密码账户和已完成 onboarding 的产品 profile：

| 用户名 | 邮箱 | 用途 |
| --- | --- | --- |
| `alice` | `alice@vibechat.test` | 发起好友请求、创建房间和发送邀请 |
| `bob` | `bob@vibechat.test` | 双人聊天和邀请接受 |
| `carol` | `carol@vibechat.test` | 三人群聊和邀请接受 |

固定本地测试密码会在 seed 命令完成时打印。重复执行会恢复这三名用户的显示名、邮箱验证状态、密码和 onboarding 状态，不会重复创建用户；Matrix identity/device 在真实 session bootstrap 时创建。

### 启动应用

```bash
# 方式 1：在 .env 中设置 DB_DIALECT="sqlite" 后启动
pnpm dev

# 方式 2：临时使用 SQLite（不修改 .env）
DB_DIALECT=sqlite pnpm dev
```

产品 Web 应用默认监听 `http://localhost:8001`。

### 本地 SQLite 管理工具

以下工具可以方便地查看和编辑本地 SQLite 数据库文件：

| 工具 | 类型 | 说明 |
|------|------|------|
| **Drizzle Studio** | Web UI | `pnpm db:studio:sqlite`，项目内置 |
| **DB Browser for SQLite** | 桌面应用 | 免费、跨平台、功能全面 |
| **TablePlus** | 桌面应用 | 现代 UI，支持多种数据库 |
| **SQLite Viewer** (VS Code) | IDE 插件 | 在 VS Code / Cursor 内直接查看 |

## Cloudflare D1 配置

D1 是 Cloudflare 原生的 SQLite 数据库，运行在 Workers 边缘网络上。D1 与本地 SQLite 共用同一套 schema 定义。

> D1 仅用于 TanStack Start 应用的 Cloudflare Workers 部署。
> 完整的 D1 部署步骤请参阅 [Cloudflare Workers Runbook](./deployment/cloudflare-workers.md)。

### 核心流程

```bash
# 1. 创建 D1 数据库
cd apps/backend
npx wrangler d1 create vibechat-db

# 2. 在 wrangler.jsonc 中配置 d1_databases 和 DB_DIALECT=d1

# 3. 生成并应用迁移
pnpm db:generate:sqlite
npx wrangler d1 migrations apply vibechat-db

# 4. 本地预览
DB_DIALECT=d1 pnpm --dir apps/backend dev:cf

# 5. 部署
pnpm --dir apps/backend deploy:cf
```

### D1 与 SQLite 的关系

```
┌──────────────────────────────────────────────────────┐
│              schema/sqlite/  (共享定义)               │
│  user.ts · auth.ts · order.ts · subscription.ts ...  │
├──────────────────┬───────────────────────────────────┤
│  DB_DIALECT=sqlite │         DB_DIALECT=d1            │
│  better-sqlite3    │         drizzle-orm/d1           │
│  本地 .sqlite 文件  │         Cloudflare D1 (云端)     │
│  Node.js 环境      │         Workers V8 Isolate       │
└──────────────────┴───────────────────────────────────┘
```

- 两者使用完全相同的 `sqliteTable` 定义和迁移文件
- `sqlite` 用于本地开发和传统 Node.js 部署
- `d1` 用于 Cloudflare Workers 生产部署
- 在本地开发时使用 `sqlite` 方言，可以验证 D1 兼容性

## Schema 管理命令

| 命令 | PostgreSQL | SQLite |
|------|-----------|--------|
| 检查连接 | `pnpm db:check` | `pnpm db:check:sqlite` |
| 推送 schema | `pnpm db:push` | `pnpm db:push:sqlite` |
| 生成迁移 | `pnpm db:generate` | `pnpm db:generate:sqlite` |
| 应用迁移 | `pnpm db:migrate` | `pnpm db:migrate:sqlite` |
| 填充数据 | `pnpm db:seed` | `pnpm db:seed:sqlite` |
| 可视化管理 | `pnpm db:studio` | `pnpm db:studio:sqlite` |

> 修改 schema 后，需要分别为 PG 和 SQLite 生成迁移（两套 schema 定义需保持同步）。

## 方言之间的差异

### Schema 类型映射

| PostgreSQL | SQLite / D1 |
|-----------|-------------|
| `pgTable(...)` | `sqliteTable(...)` |
| `timestamp('col')` | `integer('col', { mode: 'timestamp' })` |
| `boolean('col')` | `integer('col', { mode: 'boolean' })` |
| `jsonb('col')` | `text('col', { mode: 'json' })` |
| `numeric('col')` | `text('col')` |

### 使用注意事项

- **Drizzle 查询 API 完全兼容**：`db.select()`, `db.insert()`, `eq()`, `and()`, `desc()` 等在所有方言上行为一致
- **避免 PG 特有操作**：不使用 `jsonb` 操作符 (`->`, `->>`, `@>`)，代码库已全部使用兼容写法
- **Date 处理**：SQLite 中时间戳存储为 Unix 秒数，代码库通过 `toSqlDate()` 工具函数自动处理转换
- **事务**：三种方言均支持 Drizzle 的 `db.transaction()` API

## 常见问题

### 如何在 PG 和 SQLite 之间迁移数据？

目前没有内置的数据迁移工具。建议：
1. 使用 `pnpm db:seed` / `pnpm db:seed:sqlite` 重新填充测试数据
2. 生产数据迁移需要导出 SQL 并手动适配方言差异

### 可以在不同部署环境使用不同方言吗？

可以，但它们是独立数据库实例，数据不会自动同步。生产环境切换方言前必须单独设计迁移、校验和回滚。

### SQLite 适合生产环境吗？

- **D1 (Workers)**：适合。Cloudflare D1 提供了生产级的可靠性和全球复制
- **本地 SQLite**：适合轻量场景。对于高并发或需要高可用的生产环境，建议使用 PostgreSQL

### Node.js 与 Workers 必须使用同一种方言吗？

不必须，但同一产品环境应明确唯一事实数据库。若两种运行目标需要共享数据，优先让它们连接同一个 PostgreSQL 实例；D1 与 PostgreSQL 不会自动同步。
