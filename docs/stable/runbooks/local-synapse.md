# 本地 Synapse 开发环境

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-26
> 维护范围：本地 Synapse、Rivet Engine、Application Service adapter、真实 Matrix/Space App bootstrap 验证

## 用途与边界

此环境只用于验证 VibeChat 产品服务与 Synapse 的 Application Service 合约。它固定使用 Synapse `v1.157.0`、SQLite、`localhost` server name 和仓库内公开的本地 token，禁止暴露到公网或复用到生产。

默认 `docker compose up` 不会启动 Synapse；Matrix 服务位于显式 profile 中。仓库根目录的 `pnpm dev` 和 `pnpm dev:web` 会自动完成下述初始化与启动，并向所有子进程注入本 Runbook 的本地 Matrix 配置。相同启动器还会运行一个仓库托管的本地 Rivet Engine，供 Space Runtime 恢复 App、Draft 与不可变 Release。

## 日常启动

确保 Docker Desktop 或 OrbStack 已启动，然后运行：

```bash
pnpm dev
```

仓库 `.node-version` 声明 Node `24.19.0`，供版本管理器和 IDE 自动选择；`.npmrc` 的 `scripts-prepend-node-path=true` 保证 pnpm 子脚本继续使用启动 pnpm 的 Node。即使当前 shell 使用 Node 26，`pnpm dev` 也会自动改用本机 Node 24/22 重新执行，因此无需手工修改 `PATH`。其他受控环境可通过 `VIBECHAT_NODE_BIN` 指定兼容 executable。该方案不会让普通 pnpm 命令为了选择 Node 而依赖网络。

该命令会先验证 `better-sqlite3` native binding 与当前 Node ABI；发现已有 `node_modules` 使用其他 Node 编译时，会用已经选定的兼容 Node 自动 rebuild 一次。随后按照 `libs/database/drizzle-sqlite/meta` 的最新 snapshot 校验本地 SQLite 表与列，缺失时自动执行 schema push；只有原数据库没有任何应用表时才自动 seed，已有数据的增量补表不会重置 seed。之后启动 Synapse 并等待 `http://localhost:8008/_matrix/client/versions` 就绪，再启动持久化到 `apps/space-runtime/.data/rivetkit-storage/managed-engine/db` 的 Rivet Engine 并等待 `http://127.0.0.1:6420/health` 就绪，最后启动 Backend、Web、Site、Admin 和 Space Runtime。`pnpm dev:web` 使用相同前置流程，只启动 Backend、Web 和 Space Runtime。

本地 Synapse 容器在应用进程退出后保持运行，以便重启和 E2E 复用；使用 `pnpm matrix:dev:down` 显式停止。Rivet Engine 的进程由本次 `pnpm dev` 独占管理，正常退出时一并停止，但数据库保留供下次恢复。启动前若 `6420` 已有未知 Engine，启动器会拒绝继续，先停止该进程或通过 `RIVET_ENDPOINT` / `AGENTOS_ENDPOINT` 明确连接外部 Engine；它不会擅自终止未知进程。只有在确实不需要 Matrix 的诊断任务中才可设置 `VIBECHAT_DEV_SKIP_SYNAPSE=1`。

## 手动初始化与故障恢复

```bash
npm run matrix:dev:init
npm run matrix:dev:up
```

自动流程失败时可手动执行以上命令。初始化会在被 git 忽略的 `docker-volumes/synapse` 下生成本地 signing key。确认 homeserver 可用：

```bash
curl http://localhost:8008/_matrix/client/versions
```

## Adapter 合约测试

```bash
npm run test:matrix:integration
```

测试会注册随机 `@vibe_*:localhost` 无密码用户，创建真实 device/scoped token，调用 `whoami` 验证绑定，再通过标准 `/logout` 验证 token 失效。

## Web bootstrap 联调变量

将以下本地值放入临时 shell 或未提交的 `.env.local`：

```dotenv
MATRIX_HOMESERVER_URL="http://127.0.0.1:8008"
MATRIX_PUBLIC_HOMESERVER_URL="http://localhost:8008"
MATRIX_SERVER_NAME="localhost"
MATRIX_APPSERVICE_TOKEN="vibechat-local-appservice-token"
MATRIX_TOKEN_ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
MATRIX_USER_PREFIX="vibe_"
```

`pnpm dev` 会在环境未显式配置时自动使用这些值。产品默认地址是 `http://localhost:8001`。服务端内部地址使用 `127.0.0.1` 避免本机 IPv4/IPv6 解析差异，浏览器公开地址继续使用 `localhost`。默认 `pnpm test:e2e` 和 `pnpm test:e2e:ui` 已设置 `E2E_MATRIX_EXPECT_READY=1`，与默认开发环境保持一致；Cloudflare E2E 仍保留独立配置。

## 停止与清理

```bash
npm run matrix:dev:down
```

需要全新 homeserver 时，停止服务后删除 `docker-volumes/synapse`，再重新执行首次初始化。该目录包含 signing key、Matrix access token 数据和消息数据库，不应提交或随意分享。

需要全新 Space App Engine 时，应先正常退出开发进程，再备份并显式移走 `apps/space-runtime/.data/rivetkit-storage/managed-engine/db`。该操作会清除本机 Runtime Actor、App 与 Release 状态，不能作为普通故障恢复步骤；启动器不会自动删除旧数据库。历史版本曾使用的 `.rivetkit/var/engine/db` 也不会被自动迁移或删除。
