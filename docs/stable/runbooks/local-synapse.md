# 本地 Synapse 开发环境

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：本地 Synapse、Application Service adapter、真实 Matrix bootstrap 验证

## 用途与边界

此环境只用于验证 VibeChat 产品服务与 Synapse 的 Application Service 合约。它固定使用 Synapse `v1.157.0`、SQLite、`localhost` server name 和仓库内公开的本地 token，禁止暴露到公网或复用到生产。

默认 `docker compose up` 不会启动 Synapse；Matrix 服务位于显式 profile 中。

## 首次初始化

```bash
npm run matrix:dev:init
npm run matrix:dev:up
```

初始化会在被 git 忽略的 `docker-volumes/synapse` 下生成本地 signing key。确认 homeserver 可用：

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

随后使用隔离 SQLite 启动 Web app；产品默认地址是 `http://localhost:8001`。服务端内部地址使用 `127.0.0.1` 避免本机 IPv4/IPv6 解析差异，浏览器公开地址继续使用 `localhost`。设置 `E2E_MATRIX_EXPECT_READY=1` 可运行 `chat-auth-bootstrap.spec.ts`；正常无 Matrix 配置的 E2E 仍断言 unavailable。

## 停止与清理

```bash
npm run matrix:dev:down
```

需要全新 homeserver 时，停止服务后删除 `docker-volumes/synapse`，再重新执行首次初始化。该目录包含 signing key、Matrix access token 数据和消息数据库，不应提交或随意分享。
