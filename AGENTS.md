# AGENTS.md

## 目的

本文件是 VibeChat 仓库的默认工作协议。无论任务是分析、设计、开发、修复、重构、测试还是维护文档，都必须先阅读与任务相关的文档，再依据文档边界开展工作，并在交付前完成相应的文档治理与验证。

核心顺序是：

```text
阅读文档 → 确认事实与目标 → 更新开发中记录 → 实施 → 验证 → 同步文档
```

不得跳过文档阅读直接按目录名、旧经验或模板能力推断项目现状。

## 一、开始任务前必须阅读文档

### 1. 固定入口

每个任务开始时至少阅读：

1. [`docs/README.md`](docs/README.md)：确认文档入口、生命周期和事实边界。
2. [`docs/governance/lifecycle-policy.md`](docs/governance/lifecycle-policy.md)：确认文档分类、状态流转和维护规则。
3. 与任务直接相关的稳定文档、开发中文档、局部 `AGENTS.md`、包内 README 和测试说明。

涉及产品功能或整体架构时，还必须同时阅读：

- [`docs/stable/designs/vibechat-mvp-product-and-technical-design.md`](docs/stable/designs/vibechat-mvp-product-and-technical-design.md)：MVP 目标、边界和长期约束。
- [`docs/development/current-focus.md`](docs/development/current-focus.md)：当前开发重点。

稳定设计描述目标状态，不代表功能已经实现。判断当前实现必须回到开发中文档、代码、测试和运行结果核验。

### 2. 按任务补充阅读

| 任务范围 | 必读资料 |
| --- | --- |
| 修改某个应用或库 | 目标目录及父目录中适用的 `AGENTS.md`、README、相关稳定设计 |
| 用户可见功能 | 产品设计、相关开发中文档、公开用户文档、`tests/e2e/TEST-CATALOG.md` |
| 认证与权限 | `libs/auth/README*.md`、`libs/permissions/AGENTS.md`、相关设计与 Runbook |
| 计费、支付或积分 | `libs/credits/AGENTS.md`、`libs/payment/AGENTS.md`、`libs/pricing/README*.md`、相关设计与 Runbook |
| AI 能力 | `libs/ai/AGENTS.md`、AI Runbook、积分 Runbook 与相关验收记录 |
| 部署或服务端运行时 | 对应部署 Runbook、`apps/backend/CF-NOTES.md` |
| 测试 | `tests/e2e/AGENTS.md`、`tests/e2e/TEST-CATALOG.md` 和对应测试目录说明 |
| 文档新增、迁移或重写 | 生命周期规范、对应类型模板、文档验证标准 |

如果相关文档缺失、互相冲突或与代码不一致，不得静默选择一个结论继续：

- 以代码和运行结果记录“当前实现事实”。
- 以稳定设计记录“已评审的目标与约束”。
- 在 `docs/development/` 中记录差距、待决策项和完成条件。
- 涉及产品范围或架构取舍时，先请求或完成必要决策，再修改稳定设计。

## 二、必须遵循文档治理原则

### 1. 生命周期与治理区分离

内容文档只有三个生命周期：

- `docs/development/`：开发中，包括提案、RFC、调研、实施记录和仍待核验的操作说明。
- `docs/stable/`：长期稳定，包括已核验并持续维护的设计、Runbook、参考资料、发布说明和计划。
- `docs/archive/`：已归档，包括被替代、已完成、已取消或不再符合当前基线的资料。

`docs/governance/` 是规则、模板、迁移记录和检查标准的控制区，不是内容生命周期，不能把普通文档流转到“文档治理”。

### 2. 稳定文档必须按类型归位

| 类型 | 目录 | 主要职责 |
| --- | --- | --- |
| 设计 | `docs/stable/designs/` | 解释目标、边界、架构、不变量和取舍 |
| Runbook | `docs/stable/runbooks/` | 给出可重复执行的前置条件、步骤、验证和故障处理 |
| 参考资料 | `docs/stable/references/` | 提供参数、接口、兼容性和查表事实 |
| 发布说明 | `docs/stable/release-notes/` | 记录已经发生的交付事实及影响 |
| 计划 | `docs/stable/plans/` | 记录当前认可的目标、阶段、顺序和完成标准 |

不得重新创建 `docs/user-guide/`；操作型文档统一使用 Runbook。目录 `README.md` 是结构索引，不是新的文档类型。

### 3. 文档随工作同步维护

- 新方案、未验证结论和实施记录先进入 `docs/development/`。
- 稳定设计中尚未实现的内容、差距和完成条件必须记录在 `docs/development/`，并链接回对应设计。
- 没有代码、测试或运行证据的工作不得标记为 Complete，也不得写成发布说明。
- 稳定文档发生实质变化时，同步更新相关索引、开发中文档、公开用户文档和迁移记录。
- 用户可见行为变化时，同步更新 `apps/docs-app/content/docs/`；该目录不能自行定义与稳定设计或 Runbook 冲突的契约。
- 被替代或失效的内容迁入 `docs/archive/`，说明归档原因和替代入口；不要继续修正文义。
- 同一事实只保留一个主文档，其他位置使用链接和简短摘要，不复制长段正文。
- 新增或重命名文件使用小写 kebab-case，并更新所有仓库内引用。
- 新建或实质修改正文时，按治理规范补齐生命周期、文档类型或状态、更新时间、维护范围及完成条件。

## 三、仓库与实现边界

### 1. 当前范围

- `apps/site-app`：官网与公开内容。
- `apps/web-app`：产品 Web/PWA，使用 TanStack Start、React、TanStack Router 和 Vite。
- `apps/admin-app`：运营管理与后续空间审核，使用独立 TanStack Start runtime。
- `apps/backend`：共享认证、产品 API、上传与健康检查。
- `apps/docs-app`：Fumadocs 文档站。
- `packages/*`：有独立 exports、依赖和构建门槛的跨应用产品契约与客户端能力。
- `libs/*`：尚未升级为 workspace package 的共享领域实现与通用能力。
- `config/*`：共享静态选项和默认配置。
- `packages/react-shared`：React 共享组件与 hooks。

不要依据旧 TinyShip、多框架或已归档文档恢复不存在的应用结构。当前仓库结构和 MVP 产品边界以现行文档与代码为准。

### 2. 工程规则

1. 跨 app/运行时复用且需要稳定 exports、独立依赖与构建门槛的能力放在 `packages/*`；单一 Backend 内部领域实现和 provider 逻辑可继续放在 `libs/*`，静态选项与默认值放在 `config/*`。
2. TanStack 页面、路由处理器和 `createServerFn` 负责组合与适配，不复制共享域逻辑。
3. 页面和组件中的用户可见文本必须使用 i18n key；先更新 `packages/i18n/src/locales/en.ts`，再同步 `zh-CN.ts`。
4. 所有用户可访问的页面和 API 都要核验认证、权限与资源归属。
5. 消耗积分或资金的流程必须覆盖计费、失败退款、规范交易代码、翻译文案和对账元数据。
6. 上传与存储复用 `libs/storage`，明确大小、类型、数量、尺寸和下游输入限制。
7. 只新增确有必要的环境变量；同步 `env.example`，避免别名和废弃 fallback。
8. API 输入必须校验，响应形状保持稳定；日志包含必要上下文但不得泄露密钥或个人数据。
9. 修改前复用现有抽象，修改后同步共享库、配置、产品应用、测试和文档契约。

## 四、功能交付流程

用户功能按以下阶段推进：

### 1. 文档与范围

- 阅读相关稳定设计和开发中文档。
- 确认目标、非目标、支持模式、权限、计费和部署影响。
- 若目标尚未进入文档，在 `docs/development/` 建立或更新提案与实施记录。

### 2. Spec

- 在 `tests/e2e/TEST-CATALOG.md` 先写明验收场景，不提前猜测 Playwright DOM 选择器。
- 定义页面、流程、URL 参数、权限边界、错误状态和完成证据。

### 3. Code

- 按 `packages/*` / `libs/*` → `config/*` → `apps/*` → i18n → 权限与计费的依赖方向实现。
- 保持 API、服务端函数和客户端契约一致。

### 4. Verify

- 在运行中的 TanStack 应用里走查核心用户流程。
- 检查加载、空状态、错误状态、响应式布局、权限拒绝和可恢复性。

### 5. Test 与 Green

- 基于真实 DOM 编写 `tests/e2e/specs/*.spec.ts`。
- 运行相关 Playwright 用例；功能完成或大型重构时按要求运行完整 TanStack E2E。
- 只有相关 E2E 通过并在 `TEST-CATALOG.md` 记录结果后，用户功能才可标记完成。

### 6. 文档闭环

- 将实现证据、测试结果、差距和待决策项同步到相关开发中文档。
- 只有经过核验、准备持续维护的内容才能提升到 `docs/stable/`。
- 更新用户文档、Runbook、参考资料或发布说明时，严格按其文档类型写作。

## 五、验证要求

验证标准以 [`docs/governance/verification-standard.md`](docs/governance/verification-standard.md) 为准。

### 仅文档变更

```bash
pnpm docs:check
pnpm build:docs
```

### 代码或配置变更

```bash
pnpm docs:check
pnpm typecheck
pnpm build
```

此外：

- 用户可见功能运行相关 TanStack E2E。
- 修改 backend 服务端代码或共享库时，按 `apps/backend/CF-NOTES.md` 验证 Cloudflare 预览。
- 发布前或大型重构后运行完整 `pnpm test:e2e`。
- 外部凭据、支付 CLI 或 provider key 缺失导致无法验证时，明确记录未覆盖项，不得声称通过。
- 交付说明只记录实际执行的命令与结果，不用“应当通过”代替验证。

## 六、完成与交付

任务交付前确认：

- 已阅读并遵循所有相关文档和局部 `AGENTS.md`。
- 当前实现与稳定目标的差距已显式记录，没有把目标状态冒充为完成状态。
- 代码、配置、i18n、权限、计费、测试与文档按任务影响同步完成。
- 新文档位置、类型、元数据和链接符合治理规范。
- 已执行适用的文档检查、类型检查、构建、运行走查和 E2E。
- 交付说明列出变更范围、验证结果、剩余警告与未覆盖项。

## 七、关键入口

- 文档中心：[`docs/README.md`](docs/README.md)
- 文档生命周期与维护规范：[`docs/governance/lifecycle-policy.md`](docs/governance/lifecycle-policy.md)
- 文档与交付验证标准：[`docs/governance/verification-standard.md`](docs/governance/verification-standard.md)
- VibeChat MVP 产品与技术设计：[`docs/stable/designs/vibechat-mvp-product-and-technical-design.md`](docs/stable/designs/vibechat-mvp-product-and-technical-design.md)
- 当前开发重点：[`docs/development/current-focus.md`](docs/development/current-focus.md)
- 项目结构约束：[`.cursor/rules/project-structure.mdc`](.cursor/rules/project-structure.mdc)
- E2E 约束：[`tests/e2e/AGENTS.md`](tests/e2e/AGENTS.md)
- E2E 目录：[`tests/e2e/TEST-CATALOG.md`](tests/e2e/TEST-CATALOG.md)
- Cloudflare 注意事项：[`apps/backend/CF-NOTES.md`](apps/backend/CF-NOTES.md)

当本文件与更深层目录中的 `AGENTS.md` 同时适用时，本文件规定仓库级文档治理和交付底线，更深层文件补充局部实现约束；两者都必须遵守。

## Cursor Cloud specific instructions

These notes are for future Cloud Agents. The startup update script already runs `pnpm install` (Node 22, pnpm 9.4.0). Standard commands live in `README.md`, root `package.json` scripts, and `libs/database/AGENTS.md`; the notes below only capture the non-obvious setup for this environment.

### Local dev uses SQLite (not Postgres)

- The default `env.example` sets `DB_DIALECT="pg"`, which requires a running Postgres. This VM has no Postgres. The local `.env` is configured with `DB_DIALECT="sqlite"` + `SQLITE_DB_PATH="./data/local.sqlite"` so the whole stack runs with zero external services.
- `.env` and `data/local.sqlite` are gitignored but persist in the environment snapshot. If `.env` is missing on a fresh pod, recreate it: `cp env.example .env` then set `DB_DIALECT="sqlite"`. Then initialize the DB: `pnpm db:push:sqlite` and (optional but recommended) `pnpm db:seed:sqlite`.
- Seeded login accounts (from `pnpm db:seed:sqlite`): `admin@example.com` / `admin123`, `user@example.com` / `user123456`, chat users `alice|bob|carol@vibechat.test` / `VibeChatTest2026!`. Email verification and captcha are disabled in dev, so email/password signup and signin work without any email/OTP delivery.

### Running services

- `pnpm dev` starts backend (8002), web (8001), site (8003), admin (8005) together; `pnpm dev:web` runs just backend + web. Docs is separate: `pnpm dev:docs`. Entry points: web/chat `http://localhost:8001/messages`, site `http://localhost:8003/`, admin `http://localhost:8005/admin`. The web/site/admin apps proxy `/api` and `/v1` to the backend on `BACKEND_ORIGIN` (8002), so the backend must be up for authed screens to work.

### Chat backend (Matrix/Synapse) is optional and fails closed

- Without Synapse configured, `/messages` intentionally shows "消息服务尚未配置" (message service not configured) instead of loading fixtures — this is expected, not a bug. Auth, onboarding, product profile, account/billing, admin, and site all work without Synapse.
- To exercise real chat messaging you must run local Synapse, which needs Docker (NOT installed here) plus the `MATRIX_*` env values. Follow [`docs/stable/runbooks/local-synapse.md`](docs/stable/runbooks/local-synapse.md) (`npm run matrix:dev:init` / `matrix:dev:up`).

### Lint / test gotchas

- There is no ESLint. The lint-equivalent gates are `pnpm boundaries:check`, `pnpm docs:check`, and `pnpm typecheck`.
- `pnpm test` (vitest) has 3 pre-existing failures on `main` unrelated to environment setup: `tests/unit/validators/user.test.ts` (1) and `tests/unit/email/cloudflare.test.ts` (2). Everything else passes.
- `pnpm test:api` requires the dev servers to already be running (it hits `http://localhost:8001`); it fails with "Server not reachable" otherwise.
- `pnpm test:e2e` needs Playwright + Chromium installed globally (`npm i -g playwright @playwright/test && npx playwright install chromium`) and the dev servers running (see `tests/e2e/AGENTS.md`).
