# Space Runtime

Node 22–24、TypeScript ESM 与 Hono 服务。首版从 `chat-app-server` 移植同 Space 串行 turn、跨 Space 有限并行、SSE/command、ProjectStore、agentOS Apps Dev Preview 与 immutable Release。

产品 Backend 完成 Better Auth 和实时 Matrix `m.room.member=join` 校验后才代理到本服务。`SPACE_RUNTIME_INTERNAL_TOKEN` 只作为签名密钥，网络请求携带的是 60 秒、绑定 audience/method/path 的凭证，不再传递静态 bearer token。公共契约使用通用 `agentId`，当前默认注册 `pi` Adapter。

## 本地运行

根目录 `pnpm dev` 或 `pnpm dev:web` 会同时启动 Backend、本服务、仓库托管的 Rivet Engine，以及 Agent/build/serving 三个独立 pool worker；也可以在 Backend 已运行时单独执行 `pnpm dev:space-runtime`，此时 control Runtime 会派生三个独立 worker，Agent worker 拥有开发用 managed Engine。Project、Instance、Turn、Lease 和 Outbox 始终经过 Backend 写入 Product DB/Object Store；AgentOS Actor 与 Release 状态保存在被 git 忽略的 `apps/space-runtime/.data/rivetkit-storage/managed-engine/db`。需要在 `.env` 配置：

- `SPACE_RUNTIME_INTERNAL_TOKEN`：Backend 与 Runtime 共享的内部签名密钥；必须使用长随机值，不能作为 bearer token 直接发送。
- `SPACE_RUNTIME_CALLBACK_ORIGIN`：积分结算回调的 Backend origin，本地默认 `http://localhost:8002`；部署时必须显式配置为 Runtime 可访问的内部 Backend origin。
- `SPACE_AGENT_DEFAULT_ID`：首版默认 `pi`，但公共 API 和队列不依赖 Pi。
- `SPACE_AGENT_MAX_CONCURRENCY`：跨 Space 同时执行的 Agent Turn 上限，默认 `2`，限制为 `1..8`；同一 Space 内仍由单独队列串行执行。
- `SPACE_TURN_BATCH_WINDOW_MS`：同一 Space Turn 的批处理窗口，默认 `350ms`，限制为 `0..2000ms`。
- `PI_MAX_CONCURRENCY` / `PI_BATCH_WINDOW_MS`：上述平台变量缺失时使用的旧名 fallback，仅保留一个兼容周期；新配置优先。
- `PI_MODE`：默认 `auto`；存在本机 Pi CLI 会话时走 `host`，具备 AgentOS provider credential 时可设为 `agentos`。
- `PI_BIN`：可选的 Host Pi 可执行文件绝对路径。根目录 `pnpm dev` 会忽略仓库 `node_modules/.bin` 中的旧版依赖并自动解析仓库外的系统 Pi；部署时建议显式配置和固定版本。
- `SPACE_RUNTIME_TMP_DIR`：可选的 agentOS Apps 工作目录。未指定时使用短且按进程/worker 隔离的 `/tmp/vc-space-runtime[-<workload>]-<pid>`，避免 macOS Unix socket 路径超限。
- `AGENTOS_APPS_DNS_SERVERS`：可选的 Release Build VM DNS，使用逗号分隔。根目录 `pnpm dev` 在本地默认注入 `1.1.1.1,8.8.8.8`，避免 macOS AgentOS `0.2.15` 无法解析系统 resolver；生产运行时若已有正确 DNS 可不设置。
- `SPACE_RUNTIME_ENGINE_MODE`：`managed` 或 `external`。开发环境可使用 `managed`；生产环境必须显式为 `external`，否则 Runtime 启动失败。
- `RIVET_ENDPOINT` / `AGENTOS_ENDPOINT`：外部 Rivet Engine 地址。`external` 模式必须提供；endpoint 禁止携带 URL credential、query 或 fragment。根目录开发启动器管理本地 Engine 时会显式使用 `managed` 并注入本地 endpoint。
- `SPACE_RUNTIME_REPLICA_ID` / `SPACE_RUNTIME_REGION`：Runtime 副本和区域身份。生产环境必须显式配置，后续双副本 lease/fencing、日志与告警使用这两个维度关联。
- `SPACE_RUNTIME_POOL_WORKLOAD`：只用于 pool worker entrypoint，值为 `agentExecution`、`appBuild` 或 `releaseServing`。control Runtime 不设置该变量。生产以三个独立 deployment/process 分别运行 `pnpm --filter @vibechat/space-runtime start:pool-worker`。
- `SPACE_AGENT_EXECUTION_POOL_CLASS`、`SPACE_APP_BUILD_POOL_CLASS`、`SPACE_RELEASE_SERVING_POOL_CLASS`：Agent、Candidate build/dev 与不可变 Release serving 的物理 pool class；external 模式要求三者不同。一个 Node worker 只注册其中一个 pool，不能合并运行。
- `SPACE_AGENT_EGRESS_ALLOWLIST`、`SPACE_APP_BUILD_EGRESS_ALLOWLIST`、`SPACE_RELEASE_EGRESS_ALLOWLIST`：三类 pool 的 `allow`、`deny` 或逗号分隔 network pattern。生产必须显式设置；开发默认 `allow`。
- `SPACE_AGENT_VM_*`、`SPACE_APP_BUILD_VM_*`、`SPACE_RELEASE_VM_*`：分别配置 CPU、最大进程、FD 和 filesystem bytes。完整变量与生产步骤见 [AgentOS 生产部署 Runbook](../../docs/stable/runbooks/space-runtime-agentos-production.md)。
- `RIVET_ENGINE_DATABASE_PATH`：可选的本地 Engine 数据库目录；默认使用上述仓库内持久化路径。

本服务依赖的 `isolated-vm` 尚不支持 Node 26；开发和构建使用仓库约定的 Node 22–24。仅有 Claude Code credential 而没有 AgentOS provider credential 时，使用 Host Pi 模式。

生产 external control 不读取、保存或通过 `openSession` 请求发送 Agent provider secret；session 请求只包含 provider-neutral identity 和工作参数。provider credential 由 `agentExecution` worker 内的 AgentOS session environment resolver 注入，并覆盖任何同名 client 输入。生产 control 检测到 provider key、生产 Agent worker 缺少全部 provider credential，或 build/serving worker 检测到任一 provider credential 时，都会在 Engine probe/Registry 启动前失败关闭。

本地启动器拒绝复用占用 `6420` 的未知 Engine，避免把 Space Release 意外写入另一个项目的数据库。Engine ready 后，启动器先等待三个 pool worker 通过 IPC 报告 Registry ready，再启动应用；任一 worker 意外退出会停止整组开发进程。正常退出 `pnpm dev` 会同时停止它拥有的 worker 与 Engine，Synapse 容器则继续保留以便复用。单独执行 `pnpm dev:space-runtime` 且未配置 endpoint 时也会使用三个子进程，只有 Agent worker 启动 RivetKit managed Engine。external 或由开发启动器管理的 endpoint 会在 worker Registry 前做真实 `/health` 探测；不可达或 payload 不健康时 worker/control 均失败关闭，不开始 claim Turn。

Agent 与 App 执行使用独立的 Runtime 接口：Agent execution runtime 负责按 `Space × Agent` 取得 session VM；App execution runtime 负责 Revision Dev VM 与不可变 Release 部署。当前默认实现连接同一环境/区域级 AgentOS/Rivet Engine，但分别通过 Agent、build 和 serving worker pool 执行；业务编排不直接依赖 AgentOS client/deploy API，也不持有 worker credential。Pi 继续使用原有 `space-<spaceId>` actor key，Dev Revision actor key 和 Release scaling 也保持兼容。

## S1 代码结构与维护边界

Space Runtime 的 S1 结构拆分已完成。`server.ts` 只创建 Runtime、创建 HTTP app 和监听端口；后续功能不得重新把路由、Turn 或 provider 逻辑堆回入口。

```text
server.ts
├── agentos-pool-worker.ts # 单一 workload Registry 的生产/开发 worker 入口
├── composition/        # concrete dependency 组装、配置和错误归一化
├── transport/http/     # health、instance、project、turn、App proxy 路由
├── scheduler/          # claim、batch、并发和 Turn dispatch
├── turn-processor/     # Agent、Publish、Restore 三类 Turn
├── adapters/           # provider-neutral contract/registry 与 Pi/fake 实现
├── agent-runtime/      # Agent execution port 与 AgentOS concrete runtime
├── app-runtime/        # Candidate/Release port 与 AgentOS concrete runtime
├── release-manager/    # Dev Preview、Release policy 和部署编排
└── infrastructure/     # AgentOS actor、单 pool Registry 与 worker 启动基础设施
```

维护时遵循以下方向：HTTP route 只做输入/输出适配；composition root 是唯一同时装配应用接口与 Pi/AgentOS concrete 实现的位置；Turn processor 只通过注入端口调用 Adapter、Project、Release、SpaceInstance 和 control plane；Adapter 不读取 Backend、credits、Matrix 或数据库实现。`@rivet-dev/agentos*` 与 `@agentos-software/*` 只能出现在 `agent-runtime/agentos/`、`app-runtime/agentos/` 和 `infrastructure/actors.ts`。Runtime 应用核心统一使用 `spaceInstanceId`，HTTP/AgentOS Apps 兼容边界才保留 `appId`。

旧入口 `agent-adapter.ts`、`agent-execution-runtime.ts`、`app-execution-runtime.ts`、`dev-preview.ts`、`generator.ts` 和 `actors.ts` 只作兼容 re-export；新代码直接引用上述责任目录。`pnpm boundaries:check` 会阻止 AgentOS import/invocation、Adapter 产品域依赖和新的核心 `appId` 参数越界。

## 请求链路

1. Web 先把真人消息写入 Matrix；只有显式 `@agent` 才把 Matrix event ID 作为幂等键提交给 Backend。
2. Backend 校验 Better Auth、`room_index` 与实时 Matrix Space membership，完成积分预留，再签发短期、请求范围内的 Runtime 凭证。
3. Product DB Turn queue、短 lease 与单调 fencing token 保证同一 Space 单写，不同 Space 在配额内并行。owner 中断后，下一副本会把旧 fencing token 的 active Turn 恢复到队首；Runtime 不提供本地文件控制面回退。
4. Agent 写入 Project 后，agentOS Apps 在独立版本实例中构建 Candidate；成功后该固定 revision 成为新的 ready App，Web iframe 按 `version` 精确加载。
5. 只有可信 Kernel 发布 API 可以创建 Publish Turn，并必须提交用户看到的 `expectedReadyRevisionId`；自然语言“发布”仍是普通 Agent Turn。发布只固化该 ready Revision，Live 不会被后续 Draft 自动覆盖。
6. 成员也可以从可信 Kernel 菜单显式恢复 Default Chat App；Backend 校验身份和 Matrix membership，Runtime 用请求中的 expected ready Revision 做并发保护，再从官方固定 Template Artifact 构建隔离 Candidate。只有 Candidate ready 才保存新的 ready Revision，已有 Release、Matrix timeline 与 App State 不变；该 Turn 不进入 Agent Adapter 或 AI credits。
7. 空白 Space 以 Default Chat 作为首个 ready Project，但 Product DB/Matrix 创建 lineage 保持为空；后续应用市场 Template 复用 Restore Turn 和 Candidate 屏障，只切 ready Project，不改 Matrix timeline、App State 或已有 Release。

Runtime 的 Instance snapshot 与 Project pointer 使用同一 Product DB lease/fencing 代次。Backend 在空队列 claim 后可以提前释放 lease，因此两个远程写客户端在复用缓存 token 前必须先续租复核；不能只根据本地 `expiresAt` 判断所有权，也不能捕获 409 后绕过 fencing。

Dev Preview Manager 不用单个可变进程代表整个 Space。Candidate 与 ready Revision 使用不同 actor key，启动 Candidate 不会停止成员正在使用的 ready App；当前进程保留最近三个 ready 版本供 iframe 重载和页面刷新按 revision 读取。Candidate 构建或启动失败只更新诊断，不改变最后 ready 指针。

## Project 与模板血缘

- 官方 Template Version 来自 `@vibechat/space-templates`，包含不可变源码快照、SHA-256 `sourceHash`、content-bound `integrity`、SDK/Runtime 兼容性和 provenance。
- 创建 Space 时，本服务把固定版本复制为实例独享的 Project，并同时记录模板源 hash 与当前 Project hash。后续 Agent 修改只改变当前 Project hash，不回写模板。
- Project 是完整的受限多文件树，不是三个字符串字段：`package.json`、`tsconfig.json`、`src/index.ts` 为必需入口，Agent 可在 `src/` 下按职责拆分或新增模块；Project Store、Dev Preview、Revision 与 Release 始终按完整树排序、校验和计算 hash。
- 从 Object Store 加载 Project 时会重新计算 source hash；内容与 Product DB 指针不一致会拒绝加载，避免静默运行损坏或绕过记录修改源码。
- 已存在的 Space Project 始终按独立 Revision 原样加载，初始化不会隐式升级到模板当前版本。模板升级必须创建、验证并显式切换 Candidate。

## Managed Space App 依赖

Space Project 以普通 package import 消费平台包，并在 `package.json` 使用精确版本、在 `space-app-dependencies.json` 使用精确 `sha256:` integrity。Runtime 不执行在线 npm resolution：`@vibechat/space-app-dependencies` 向注入的 managed Registry 请求固定 artifact，校验 package name/version/Project format/files/integrity 后，仅在 prepared build 中生成 `vendor/vibechat-packages`、resolved manifest 和 revision-local `file:` dependency。

组件源码使用 `/foundation`、`/user`、`/agent`、`/chat` 等语义化 package subpath；当前返回自包含 HTML 的 `agentos-app-v1` 可按需使用明确的 `/user/inline`、`/chat/inline` 或 `/recipes/inline` delivery adapter。inline entry 仍绑定同一个 exact package version 与 integrity，只解决自包含 HTML 的交付形态，不建立第二套 API。Registry 的 object key、`/artifacts/*` 和版本目录均不得进入 Project import。Git 不保存组件的逐版本编译目录；每个可供 Space 使用的版本必须先把规范化 managed package object 发布到 Registry/Object Store，并登记不可变的 `name + version + integrity + projectFormats + objectKey/objectHash`。公共 npm tarball 仅可作为同一 package 的可选 mirror，不是 Runtime 准备 Project 的线上依赖。

生产 Runtime 使用 `SPACE_RUNTIME_CALLBACK_ORIGIN` 与 `SPACE_RUNTIME_INTERNAL_TOKEN` 签发短期、method/path/audience scoped 的只读请求，从 Backend 精确解析 Project lock。`NODE_ENV=production` 时远程 Registry 是唯一 provider，缺少记录、对象或任一 hash/envelope/file 校验失败都会 fail closed；不会回退到 workspace package 或 `dist`。非生产模式只有在远程 Registry 返回未命中时，才可使用 gitignored 的多版本开发缓存。发布器使用独立 `SPACE_APP_PACKAGE_PUBLISHING_TOKEN`，该 secret 不进入 Runtime。

stored source 与 prepared artifact 分别写入 Project pointer 的 `sourceObjectKey/sourceHash` 和 `artifactObjectKey/artifactHash`。Dev Preview、Publish、`deploy:project` 与冷启动都复用同一 prepared artifact；已存在且验证通过的 prepared artifact 不需要 Registry 在线。只有新 Candidate 解析依赖，缺 lock、范围版本、未知 release、hash 漂移、生成路径碰撞或缓存损坏都会 fail closed，并保留当前 ready Revision 和 Published Release。

没有 managed lock 的历史 Space 保持原文件内容和 Revision ID 算法。任意现有 Space 都可以在后续 Agent/人工 Revision 中同时增加普通 dependency 和 lock，验证成功后才形成新的 ready Revision。Agent 不能自行创建 generated vendor/resolved manifest，也不能安装 package。

官方模板维护流程和生产存储边界见 [`packages/space-templates/README.md`](../../packages/space-templates/README.md)。

内部 `/runtime/*` 与 `/api/apps/*` 不应直接暴露到浏览器。公开 SDK 由 Backend 的 `/v1/space-app-sdk` 提供，App bridge 只开放经过 Host 和 Backend 校验的命令。

## 当前限制与验证边界

- Product control plane、PG/SQLite/D1 migration、内容寻址 source store、租约/fencing、interrupted Turn 恢复和 outbox/reconciler 已实现，并且是唯一 Runtime 状态路径。两个独立 Node Runtime replica 的 deterministic harness 已覆盖接管、旧 owner fencing、session rebuild、Release pointer 和 outbox ACK 丢失重放；真实 Cloudflare D1/R2 + Synapse + external Engine 的跨宿主演练仍需目标环境。
- Matrix Agent reply、credits settlement/refund 和 `io.vibechat.space.instance.v2` 都先进入幂等 outbox；callback HTTP 202 只表示控制面已接受，Runtime 的周期 reconciler 会重试投影。下游以 Turn/transaction/state key 去重。
- Agent、build、serving 已是三个独立 OS worker pool；真实 Engine 验证中每类两个 Envoy 可同时在线，停止一个 build worker 不影响另外两类。Project source 与指针可以跨副本恢复，但 AgentOS Apps 的真实 D1/R2 跨宿主 artifact/Release 恢复仍需云环境运行验证。
- 本地 Engine 会持久化 Actor 与 Release 状态，但 VM 进程不能跨宿主进程存活。仓库的 agentOS Apps `0.2.15` 兼容补丁为每次 Runtime boot 标记新的实例代次；Scaler 恢复时清除上一代 replica/admission 租约，再从同一不可变 Release 启动新副本，不删除 Release 或 App 数据。这是本地单 Runtime 恢复，不等同于生产多副本 lease 接管。
- 仓库的 agentOS Apps/Core `0.2.15` 兼容补丁为公共 process spawn 补齐 `streamStdin` 透传，并让 Release guest 以 `streamStdin: true` 启动；RivetKit callback 不再因 guest stdin 启动后关闭而在 30 秒超时。补丁还为 Build VM 补齐 `dns` options 透传并移除 macOS 不稳定的 host-dir artifact mount，不改变 App 或 Agent 协议。停止或滚动替换 Dev/Release worker 时仍可能出现 exit `143`、`transaction_closed` 或 actor stop 噪声；若本地高强度连续 E2E 后 build pool 对全新 Dev actor 持续返回 `internal_error`，滚动替换 build worker 即可恢复，不能删除 Engine/App/Release 数据绕过恢复。
