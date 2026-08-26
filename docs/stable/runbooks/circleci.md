# CircleCI CI/CD Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-26
> 维护范围：仓库级持续集成、Web 容器构建验证与 Backend Cloudflare Workers 持续部署

## 当前边界

仓库以 [`.circleci/config.yml`](../../../.circleci/config.yml) 作为 CI/CD 流水线的唯一配置源。实施状态和首次云端运行证据见 [CircleCI CI/CD 迁移实施记录](../../development/active/circleci-ci-cd-migration.md)。

当前流水线包含：

| Job | 触发范围 | 职责 | 是否获得生产密钥 |
| --- | --- | --- | --- |
| `verify` | CircleCI 构建的所有分支 | 文档检查、类型检查、产品构建、文档站构建和 whitespace 检查 | 否 |
| `docker-build` | CircleCI 构建的所有分支 | 使用 `apps/web-app/Dockerfile` 验证 Web 生产镜像 | 否 |
| `hold-production` | 仅 `main` | 在所有 CI job 成功后等待人工批准 | 否 |
| `deploy-backend-production` | 仅 `main`，且批准后 | 部署 Backend Cloudflare Worker 并检查生产健康地址 | 是，仅 `vibechat-production` Context |

Web、Site、Admin、Docs 和 Space Runtime 当前只有构建或容器契约，没有统一的生产托管平台发布命令。为这些目标选定平台并提交可验证的部署契约前，不把它们描述为自动部署。

## 前置条件

1. 在 CircleCI 中连接本仓库并使用仓库根目录的配置。
2. 确认 CircleCI 使用的 Node 镜像版本与 `.node-version` 的 Node 24.19 基线一致。
3. 创建名为 `vibechat-production` 的 CircleCI Context，并限制为生产发布维护者可使用。
4. 在该 Context 配置以下变量：

| 变量 | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Wrangler 非交互部署令牌；只授予目标账号和 Worker 所需最小权限 |
| `CLOUDFLARE_ACCOUNT_ID` | 目标 Cloudflare 账号 |
| `APP_BASE_URL` | 生产产品 Web HTTPS origin |
| `BETTER_AUTH_URL` | 生产 Better Auth HTTPS origin，通常与产品 Web 一致 |
| `VIBECHAT_BACKEND_HEALTHCHECK_URL` | 部署后直接请求的完整 HTTPS 健康检查 URL，例如 `https://api.example.com/api/health` |

Better Auth、OAuth、支付、AI、邮件、短信和数据库敏感值继续使用 Cloudflare Worker Secrets 管理，不复制到 CircleCI。非敏感生产变量由部署命令显式覆盖 `wrangler.jsonc` 中的本地默认 URL。

## 启用 CI

连接项目后推送普通分支，确认 `verify` 和 `docker-build` 同时运行。CI 使用 pnpm lockfile 与 Turbo cache；任何 job 失败都不得进入生产批准关卡。

在代码托管平台的 `main` 分支保护中：

1. 移除已经不存在的 GitHub Actions required check 名称。
2. 添加 CircleCI 的 `verify` 和 `docker-build` checks。
3. 要求分支在合并前保持最新，并禁止绕过失败 checks。

## 执行生产部署

1. 将已验证变更合并到 `main`。
2. 等待 `verify` 和 `docker-build` 成功。
3. 如果变更包含数据库 schema，先按[数据库 Runbook](./database.md)和 [Cloudflare Workers Runbook](./deployment/cloudflare-workers.md)生成、审查并应用目标环境 migration。
4. 在 CircleCI 中打开 `hold-production`，核对 commit SHA、变更范围、生产变量和回滚方案后批准。
5. 等待 `deploy-backend-production` 完成。该 job 会重新冻结安装依赖、构建 Cloudflare 目标、通过 Wrangler 部署，并请求 `VIBECHAT_BACKEND_HEALTHCHECK_URL`。
6. 继续验证登录、数据库读取和本次发布涉及的受保护流程。健康检查成功不能替代业务走查。

## 验证配置

安装 CircleCI CLI 的维护者可在仓库根目录运行：

```bash
circleci config validate .circleci/config.yml
```

仓库级交付门槛仍按[构建验证 Runbook](./build-verification.md)执行。CircleCI 云端首次运行结果必须记录到 Active 实施文档，不能只用本地 YAML 解析代替。

## 回滚

1. 在 Cloudflare 中确认上一可用 Worker version 和本次数据库 migration 的兼容性。
2. 优先使用 Cloudflare 版本回滚恢复 Worker；若需要代码修复，创建 revert commit，让它重新通过 CircleCI CI 和生产批准关卡。
3. 回滚后再次请求生产健康地址，并走查认证、数据库和受影响流程。
4. 数据库 migration 不随 Worker 代码自动回滚；只有存在已审查的反向 migration 且确认不会丢失数据时才单独执行。

## 故障处理

- pnpm 激活失败：确认 CircleCI Node 镜像和 `packageManager` 仍支持 pnpm 9.4.0。
- Context 不可用：检查 Context 名称、组织权限和安全组限制，不把密钥改写到 YAML。
- Wrangler 鉴权失败：检查 API token 的账号范围和最小部署权限，轮换后重跑批准后的部署 job。
- 部署成功但健康检查失败：保持 job 失败状态，查看 Worker 日志、binding、生产 URL 和数据库状态；按回滚流程恢复上一版本。
- Docker build 与本机结果不同：确认构建上下文是仓库根目录，并检查 workspace、`patches/` 和 lockfile 是否完整。
