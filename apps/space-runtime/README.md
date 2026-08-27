# Space Runtime

Node 22–24、TypeScript ESM 与 Hono 服务。首版从 `chat-app-server` 移植同 Space 串行 turn、跨 Space 有限并行、SSE/command、ProjectStore、agentOS Apps Dev Preview 与 immutable Release。

产品 Backend 完成 Better Auth 和实时 Matrix `m.room.member=join` 校验后才代理到本服务。`SPACE_RUNTIME_INTERNAL_TOKEN` 只作为签名密钥，网络请求携带的是 60 秒、绑定 audience/method/path 的凭证，不再传递静态 bearer token。公共契约使用通用 `agentId`，当前默认注册 `pi` Adapter。

## 本地运行

根目录 `pnpm dev` 或 `pnpm dev:web` 会同时启动 Backend、本服务和仓库托管的 Rivet Engine；也可以在 Backend 已运行时单独执行 `pnpm dev:space-runtime`。Project、Instance、Turn、Lease 和 Outbox 始终经过 Backend 写入 Product DB/Object Store；AgentOS Actor 与 Release 状态保存在被 git 忽略的 `apps/space-runtime/.data/rivetkit-storage/managed-engine/db`。需要在 `.env` 配置：

- `SPACE_RUNTIME_INTERNAL_TOKEN`：Backend 与 Runtime 共享的内部签名密钥；必须使用长随机值，不能作为 bearer token 直接发送。
- `SPACE_RUNTIME_CALLBACK_ORIGIN`：积分结算回调的 Backend origin，本地默认 `http://localhost:8002`；部署时必须显式配置为 Runtime 可访问的内部 Backend origin。
- `SPACE_AGENT_DEFAULT_ID`：首版默认 `pi`，但公共 API 和队列不依赖 Pi。
- `SPACE_AGENT_MAX_CONCURRENCY`：跨 Space 同时执行的 Agent Turn 上限，默认 `2`，限制为 `1..8`；同一 Space 内仍由单独队列串行执行。
- `SPACE_TURN_BATCH_WINDOW_MS`：同一 Space Turn 的批处理窗口，默认 `350ms`，限制为 `0..2000ms`。
- `PI_MAX_CONCURRENCY` / `PI_BATCH_WINDOW_MS`：上述平台变量缺失时使用的旧名 fallback，仅保留一个兼容周期；新配置优先。
- `PI_MODE`：默认 `auto`；存在本机 Pi CLI 会话时走 `host`，具备 AgentOS provider credential 时可设为 `agentos`。
- `PI_BIN`：可选的 Host Pi 可执行文件绝对路径。根目录 `pnpm dev` 会忽略仓库 `node_modules/.bin` 中的旧版依赖并自动解析仓库外的系统 Pi；部署时建议显式配置和固定版本。
- `SPACE_RUNTIME_TMP_DIR`：可选的 agentOS Apps 工作目录。未指定时使用短且按进程隔离的 `/tmp/vc-space-runtime-<pid>`，避免 macOS Unix socket 路径超限。
- `AGENTOS_APPS_DNS_SERVERS`：可选的 Release Build VM DNS，使用逗号分隔。根目录 `pnpm dev` 在本地默认注入 `1.1.1.1,8.8.8.8`，避免 macOS AgentOS `0.2.15` 无法解析系统 resolver；生产运行时若已有正确 DNS 可不设置。
- `RIVET_ENDPOINT` / `AGENTOS_ENDPOINT`：可选的外部 Rivet Engine 地址。未设置时，根目录启动器负责启动和停止本地 Engine；设置后只连接指定 Engine，不再创建本地进程。
- `RIVET_ENGINE_DATABASE_PATH`：可选的本地 Engine 数据库目录；默认使用上述仓库内持久化路径。

本服务依赖的 `isolated-vm` 尚不支持 Node 26；开发和构建使用仓库约定的 Node 22–24。仅有 Claude Code credential 而没有 AgentOS provider credential 时，使用 Host Pi 模式。

本地启动器拒绝复用占用 `6420` 的未知 Engine，避免把 Space Release 意外写入另一个项目的数据库。正常退出 `pnpm dev` 会同时停止它拥有的 Engine，Synapse 容器则继续保留以便复用。单独执行 `pnpm dev:space-runtime` 且未配置 endpoint 时，Space Runtime 仍会使用 RivetKit managed mode 启动 Engine。

Agent 与 App 执行使用独立的 Runtime 接口：Agent execution runtime 负责按 `Space × Agent` 取得 session VM；App execution runtime 负责 Revision Dev VM 与不可变 Release 部署。当前默认实现都连接同一环境/区域级 AgentOS/Rivet Engine，但业务编排不再直接依赖 AgentOS client/deploy API，后续可以分别配置 worker pool、credential 和 quota。Pi 继续使用原有 `space-<spaceId>` actor key，Dev Revision actor key 和 Release scaling 也保持兼容。

## S1 代码结构与维护边界

Space Runtime 的 S1 结构拆分已完成。`server.ts` 只创建 Runtime、创建 HTTP app 和监听端口；后续功能不得重新把路由、Turn 或 provider 逻辑堆回入口。

```text
server.ts
├── composition/        # concrete dependency 组装、配置和错误归一化
├── transport/http/     # health、instance、project、turn、App proxy 路由
├── scheduler/          # claim、batch、并发和 Turn dispatch
├── turn-processor/     # Agent、Publish、Restore 三类 Turn
├── adapters/           # provider-neutral contract/registry 与 Pi/fake 实现
├── agent-runtime/      # Agent execution port 与 AgentOS concrete runtime
├── app-runtime/        # Candidate/Release port 与 AgentOS concrete runtime
├── release-manager/    # Dev Preview、Release policy 和部署编排
└── infrastructure/     # AgentOS actor/registry 启动基础设施
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

Dev Preview Manager 不用单个可变进程代表整个 Space。Candidate 与 ready Revision 使用不同 actor key，启动 Candidate 不会停止成员正在使用的 ready App；当前进程保留最近三个 ready 版本供 iframe 重载和页面刷新按 revision 读取。Candidate 构建或启动失败只更新诊断，不改变最后 ready 指针。

## Project 与模板血缘

- 官方 Template Version 来自 `@vibechat/space-templates`，包含不可变源码快照、SHA-256 `sourceHash`、content-bound `integrity`、SDK/Runtime 兼容性和 provenance。
- 创建 Space 时，本服务把固定版本复制为实例独享的 Project，并同时记录模板源 hash 与当前 Project hash。后续 Agent 修改只改变当前 Project hash，不回写模板。
- Project 是完整的受限多文件树，不是三个字符串字段：`package.json`、`tsconfig.json`、`src/index.ts` 为必需入口，Agent 可在 `src/` 下按职责拆分或新增模块；Project Store、Dev Preview、Revision 与 Release 始终按完整树排序、校验和计算 hash。
- 从 Object Store 加载 Project 时会重新计算 source hash；内容与 Product DB 指针不一致会拒绝加载，避免静默运行损坏或绕过记录修改源码。
- 已存在的 Space Project 始终按独立 Revision 原样加载，初始化不会隐式升级到模板当前版本。模板升级必须创建、验证并显式切换 Candidate。

官方模板维护流程和生产存储边界见 [`packages/space-templates/README.md`](../../packages/space-templates/README.md)。

内部 `/runtime/*` 与 `/api/apps/*` 不应直接暴露到浏览器。公开 SDK 由 Backend 的 `/v1/space-app-sdk` 提供，App bridge 只开放经过 Host 和 Backend 校验的命令。

## 当前限制与验证边界

- Product control plane、PG/SQLite/D1 migration、内容寻址 source store、租约/fencing、interrupted Turn 恢复和 outbox/reconciler 已实现，并且是唯一 Runtime 状态路径。生产部署仍需执行迁移，并完成真实 Cloudflare D1/R2 preview 与两个独立 Runtime 进程的 Synapse/AgentOS 故障演练。
- Matrix Agent reply、credits settlement/refund 和 `io.vibechat.space.instance.v2` 都先进入幂等 outbox；callback HTTP 202 只表示控制面已接受，Runtime 的周期 reconciler 会重试投影。下游以 Turn/transaction/state key 去重。
- 当前 ready Preview 仍只在单进程内保留最近三个版本；Project source 与指针可以跨副本恢复，但 AgentOS Apps 的 build artifact/Release 生命周期仍由稳定 App actor 管理，真实跨宿主 artifact 恢复尚需运行验证。
- 本地 Engine 会持久化 Actor 与 Release 状态，但 VM 进程不能跨宿主进程存活。仓库的 agentOS Apps `0.2.15` 兼容补丁为每次 Runtime boot 标记新的实例代次；Scaler 恢复时清除上一代 replica/admission 租约，再从同一不可变 Release 启动新副本，不删除 Release 或 App 数据。这是本地单 Runtime 恢复，不等同于生产多副本 lease 接管。
- agentOS Apps `0.2.15` 停止 Dev/Release worker 时可能输出 guest metadata/RPC timeout 噪声；普通 Dev/Live HTML 已可正常读取，升级前仍保留为已知问题。仓库补丁还为 Build VM 补齐 `dns` options 透传并移除 macOS 不稳定的 host-dir artifact mount；补丁只影响隔离构建 VM，不改变 App 或 Agent 协议。
