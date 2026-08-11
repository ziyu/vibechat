# Cloudflare Workers 部署 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：`apps/web-app` 的 Cloudflare Workers 构建与部署

## 前置条件

- Cloudflare 账号和可部署 Workers 的权限。
- 已安装仓库依赖。
- 已决定数据库方案：D1，或 Hyperdrive + PostgreSQL。
- 已准备生产域名和所有启用 Provider 的密钥。

仓库当前使用 `apps/web-app/wrangler.jsonc` 作为 Workers 配置源，并通过 `CF_DEPLOY=1` 启用 Cloudflare Vite plugin。Cloudflare 官方也建议把 Wrangler 配置文件作为 Worker 配置的事实来源，敏感值则使用 Secret，不写入 `vars`。

官方参考：

- [Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Hyperdrive 入门](https://developers.cloudflare.com/hyperdrive/get-started/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

## 1. 登录并核对配置

```bash
cd apps/web-app
pnpm exec wrangler login
```

部署前检查 `wrangler.jsonc`：

- `name` 是目标 Worker 名称。
- `compatibility_date` 和 `nodejs_compat` 符合当前依赖要求。
- `APP_BASE_URL`、`BETTER_AUTH_URL` 使用生产 HTTPS 域名，不保留 localhost。
- D1、R2、Hyperdrive 的 ID 和名称属于目标 Cloudflare 账号与环境。
- 本地数据库地址只出现在 `localConnectionString` 或未提交的本地变量中。

当前仓库文件包含项目环境 ID，复制部署到其他账号时必须替换，不能直接沿用。

## 2A. 配置 D1

创建数据库：

```bash
pnpm exec wrangler d1 create vibechat-db
```

把返回的 `database_id` 写入 `wrangler.jsonc` 的 `d1_databases`，保持 binding 为 `DB`，并设置：

```jsonc
"vars": {
  "DB_DIALECT": "d1"
}
```

生成 SQLite/D1 migration：

```bash
cd ../..
pnpm db:generate:sqlite
cd apps/web-app
```

先应用到本地预览数据库，再应用到远端：

```bash
pnpm exec wrangler d1 migrations apply vibechat-db --local
pnpm exec wrangler d1 migrations apply vibechat-db --remote
```

`migrations_dir` 必须与仓库的 Drizzle 输出目录一致。修改 schema 后，先生成并审查 SQL，再运行远端 migration。

## 2B. 配置 Hyperdrive + PostgreSQL

如果使用 PostgreSQL，创建 Hyperdrive：

```bash
pnpm exec wrangler hyperdrive create vibechat-db \
  --connection-string="postgresql://user:password@host:5432/database"
```

把返回的 ID 写入 `wrangler.jsonc`：

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "<hyperdrive-id>",
    "localConnectionString": "postgresql://user:password@localhost:5432/database"
  }
]
```

同时把 `DB_DIALECT` 设置为 `pg`。产品运行时通过 `apps/web-app/src/lib/with-request-db.ts` 将 `HYPERDRIVE` binding 注入数据库层。

D1 与 Hyperdrive 二选一作为当前环境的事实数据库；不要让两套数据库同时承载同一生产数据。

## 3. 配置 R2（如启用上传）

创建目标 bucket，并在 `r2_buckets` 中配置：

```jsonc
"r2_buckets": [
  {
    "binding": "R2_BUCKET",
    "bucket_name": "vibechat"
  }
]
```

当上传使用原生 R2 binding 时，将公开的存储 Provider 选择与服务端 binding 配置保持一致。

## 4. 配置 Secrets

从 `apps/web-app` 目录逐项设置敏感变量：

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put DATABASE_URL
```

继续设置实际启用的 OAuth、支付、AI、邮件和短信 Provider 密钥。非敏感值可以放 `vars`；API key、token、数据库密码必须使用 Secret。

本地开发使用 `.dev.vars` 或 `.env`，二选一并确保未被 Git 跟踪。

## 5. 本地 Workers 预览

```bash
pnpm preview:cf
```

验证：

1. 首页和 SSR 正常。
2. `/api/health` 返回成功。
3. 登录、数据库读取和一个受保护 API 正常。
4. 选择 D1 时实际使用 `DB` binding；选择 PostgreSQL 时实际使用 `HYPERDRIVE`。
5. R2 上传和 Provider 调用只在已配置对应 binding/Secret 时启用。

## 6. 部署

```bash
pnpm deploy:cf
```

部署后用实际域名检查：

```bash
curl -fsS https://your-domain.example/api/health
```

继续验证 OAuth callback、支付 Webhook、上传和本次发布涉及的业务流程。

## 回滚与故障处理

- 缺少 binding：核对 `wrangler.jsonc` 的 binding 名与代码读取名完全一致。
- `require is not defined`：检查 CJS 依赖和 `nodejs_compat`，不要在 Workers 服务端引入原生 Node addon。
- 数据库失败：确认 `DB_DIALECT` 与 D1/Hyperdrive 选择一致，并确认 migration 已应用到正确环境。
- SSR 出现重复 React：查看 `apps/web-app/CF-NOTES.md` 中的依赖预构建说明。
- Secret 缺失：使用 `pnpm exec wrangler secret list` 只核对名称，不输出或记录 Secret 值。
- 回滚代码前先判断 schema 是否向后兼容；数据库 migration 不能假设随 Worker 版本自动回滚。
