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
- `Active`：CircleCI 控制面已接入，仍需取得首次云端 CI 结果，并在后续发布阶段配置生产 Context、main 触发器和真实部署。
- `Complete`：`main` 的 CI、人工批准部署和生产健康检查均有 CircleCI 运行证据。

## 工作流与实施追踪

| ID | 工作流 | 状态 | 证据 | 下一出口 |
| --- | --- | --- | --- | --- |
| CC-1 | 文档、类型、产品构建与文档站构建 | Complete | PR #8 的 CircleCI `verify` 已通过 | 合并前持续保持绿色 |
| CC-2 | Web Docker 镜像构建验证 | Complete | PR #8 的 CircleCI `docker-build` 已通过 | 合并前持续保持绿色 |
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

CircleCI GitHub App 已获得 `ziyu/vibechat` 仓库访问权，项目、`vibechat-ci` 流水线定义和 `only-build-prs` trigger 已创建。当前 trigger 只监听已有开放 PR 的分支推送，不监听 `main`，因此生产 Context 尚未配置时不会进入生产审批或部署 job。

首次真实部署前仍必须确认 `APP_BASE_URL`、`BETTER_AUTH_URL` 和健康检查地址均为生产 HTTPS 地址，根据 schema 差异决定是否先应用数据库 migration，并在完成生产前置条件后显式新增或切换 `main` push trigger。

## 2026-08-26 CircleCI 控制面证据

| 项目 | 值或结果 |
| --- | --- |
| CircleCI project ID | `bc28b629-7137-4284-81c0-42e954810e05` |
| Pipeline definition | `vibechat-ci`（ID `2005936e-c87f-4df3-a5af-793b0f3ec214`） |
| Config / checkout source | GitHub App 仓库 `ziyu/vibechat`（repository ID `1330504875`） |
| Config path | `.circleci/config.yml` |
| Trigger | `only-build-prs`（ID `53a78f9f-0590-4c93-9035-df50506071c9`），启用 |
| 首次验证 PR | [#8](https://github.com/ziyu/vibechat/pull/8) |
| 首次绿色 workflow | [CircleCI workflow `682137bb-1718-4672-8cef-5d7890dc058e`](https://app.circleci.com/pipelines/circleci/XEqjDXBwQRciX9D4BXHDjt/QEcTiWQP65XGMdTLBMxa3N/3/workflows/682137bb-1718-4672-8cef-5d7890dc058e) |
| `verify` | [通过](https://app.circleci.com/workflow/682137bb-1718-4672-8cef-5d7890dc058e/job/afb69afa-d15a-4495-b747-5160c8d4dfb0)，完成文档检查、类型检查、产品构建、文档站构建和 whitespace 检查 |
| `docker-build` | [通过](https://app.circleci.com/workflow/682137bb-1718-4672-8cef-5d7890dc058e/job/0b316943-7429-48c3-b75a-ee10f2b350b8)，完成 `linux/amd64` Web production image 构建 |
| 生产控制面 | 未配置 `vibechat-production` Context，未创建 `main` trigger，未执行部署 |

首次云端验证暴露并修复了两个 CircleCI 环境差异：当前套餐不支持 Docker `xlarge` resource class，因此 Node executor 使用已验证可用的 `large`；依赖安装阶段不能设置 `NODE_ENV=production`，否则 pnpm 会跳过包含 Turbo 在内的 devDependencies，因此生产环境变量只在构建步骤注入。

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
| `circleci config validate .circleci/config.yml` | 通过，CircleCI CLI 版本 `1.0.48692` |

CircleCI PR checks 已有云端绿色证据。真实生产部署仍是未覆盖项，因此整体迁移记录继续保持 Active。

## 进度更新规则

只有对应工作流的实际运行 URL 和 job 结果齐备后才能标记 Complete；CC-3 还必须具备生产健康检查结果。本地配置解析或构建成功不能替代云端证据。
