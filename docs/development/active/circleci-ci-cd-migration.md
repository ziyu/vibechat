# CircleCI CI/CD 迁移实施记录

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-26
> 维护范围：仓库级持续集成、Web 容器构建验证与 Backend Cloudflare Workers 持续部署
> 稳定来源：[CircleCI CI/CD Runbook](../../stable/runbooks/circleci.md)

## 当前结论

仓库自动化统一由 [`.circleci/config.yml`](../../../.circleci/config.yml) 定义。原 GitHub Actions 文件仅包含产品构建、文档构建和 Web Docker 镜像构建验证，没有生产部署 job；迁移后这些门槛由 CircleCI 接管，并补齐仓库治理要求的文档检查和类型检查。

仓库当前唯一具有明确生产部署命令与稳定 Runbook 的目标是 `apps/backend` 的 Cloudflare Workers。CircleCI 在 `main` 分支的 CI 和 Docker 验证全部通过后提供人工批准关卡，批准后使用受限生产 Context 部署 Backend 并检查生产健康地址。Web、Site、Admin、Docs 和 Space Runtime 尚未声明统一托管平台或生产发布命令，因此本次不创建无法验证的部署动作。

## 状态定义

- `Implemented`：仓库配置和文档已经迁移并通过本地验证。
- `Active`：仍需在 CircleCI 控制面完成项目接入、生产 Context 配置和首次真实运行。
- `Complete`：`main` 的 CI、人工批准部署和生产健康检查均有 CircleCI 运行证据。

## 工作流与实施追踪

| ID | 工作流 | 状态 | 证据 | 下一出口 |
| --- | --- | --- | --- | --- |
| CC-1 | 文档、类型、产品构建与文档站构建 | Implemented | 本地四项命令通过；`.circleci/config.yml` 的 `verify` job | CircleCI 首次绿色运行 |
| CC-2 | Web Docker 镜像构建验证 | Implemented | 本地等价 `docker build` 通过；`.circleci/config.yml` 的 `docker-build` job | CircleCI remote Docker 首次绿色运行 |
| CC-3 | Backend Cloudflare Workers 生产部署 | Active | Wrangler dry-run 通过；`hold-production` 与 `deploy-backend-production` job | 配置生产 Context，批准并验证首次部署 |
| CC-4 | GitHub Actions 退出 | Implemented | `.github/workflows/ci.yml` 已删除 | 确认仓库保护规则改用 CircleCI checks |

## 当前 Active 切片

### 目标

在不改变产品运行时和业务契约的前提下，让 CircleCI 成为仓库唯一的 CI/CD 流水线定义来源。

### 非目标

- 不在没有平台契约时替 Web、Site、Admin、Docs 或 Space Runtime 选择生产托管商。
- 不自动执行 D1 或 PostgreSQL schema migration；数据库变更仍按对应 Runbook 在批准部署前独立执行和核验。
- 不把 Cloudflare、Provider 或数据库密钥写入仓库。

### 完成条件

- CircleCI 能解析仓库配置。
- `pnpm docs:check`、`pnpm typecheck`、`pnpm build`、`pnpm build:docs` 和 Web Docker build 通过。
- CircleCI 项目已连接仓库，分支保护的 required checks 已从 GitHub Actions 名称切换为 CircleCI job。
- `vibechat-production` Context 已按 Runbook 配置并限制访问。
- 一次 `main` 流水线经过人工批准，Cloudflare Workers 部署和生产 `/api/health` 检查成功。

## 当前差距与下一步

仓库内迁移完成后仍需要 CircleCI/代码托管平台管理员执行控制面配置。首次真实部署前必须确认 `APP_BASE_URL`、`BETTER_AUTH_URL` 和健康检查地址均为生产 HTTPS 地址，并根据本次 schema 差异决定是否先应用数据库 migration。

## 2026-08-26 本地验证证据

以下验证使用兼容 Node 24 和仓库固定的 pnpm 9.4.0 执行：

| 命令或检查 | 结果 |
| --- | --- |
| `pnpm docs:check` | 通过，非归档文档链接和生命周期检查通过 |
| `pnpm typecheck` | 通过，边界检查及 19/19 workspace package typecheck 成功 |
| `pnpm build` | 通过，19/19 workspace build 成功；保留既有 chunk、动态 import 和依赖告警 |
| `pnpm build:docs` | 通过，文档站 16 个静态页面生成成功；保留既有 Fumadocs cache 告警 |
| `docker build --build-arg BUILD_TIME=true --file apps/web-app/Dockerfile --platform linux/amd64 --shm-size 2g --tag vibechat-web:circleci-migration-test .` | 通过，生成与 CircleCI 目标架构一致的 Web production image |
| `wrangler deploy --dry-run ... --var APP_BASE_URL:... --var BETTER_AUTH_URL:...` | 通过，确认 D1、Hyperdrive、R2、`DB_DIALECT`、`VITE_STORAGE_PROVIDER` 和两个生产 URL binding 同时保留 |
| YAML 解析与 `git diff --check` | 通过 |
| GitNexus `detect-changes --scope all` | 低风险，0 个受影响程序流程；CI/CD YAML 和新增文档不属于业务符号 |

本机未安装 CircleCI CLI，因此尚无 `circleci config validate` 结果；CircleCI 云端配置解析、项目 checks 和真实生产部署仍是外部未覆盖项，不能标记 Complete。

## 进度更新规则

只有 CircleCI 的实际运行 URL、job 结果和生产健康检查结果齐备后，CC-1 至 CC-3 才能标记 Complete；本地配置解析或构建成功不能替代云端部署证据。
