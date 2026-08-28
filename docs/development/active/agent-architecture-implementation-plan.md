# Agent 架构实施结构计划

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-28
> 维护范围：Agent 领域、Agent Adapter、Space Runtime 结构、AgentOS 执行边界、数据迁移、部署与验证顺序
> 稳定来源：[Agent 架构与 AgentOS 部署设计](../../stable/designs/agent-architecture-and-agentos-deployment.md)
> 总体实施入口：[VibeChat MVP 产品与技术设计 Active 实施跟踪](./product-and-technical-implementation.md)
> 事实边界：稳定设计定义长期不变量；本文固定实现结构、依赖方向、迁移批次和门禁，不代表未完成阶段已经交付。

## 1. 目标

本文把 Agent/AgentOS 稳定设计转换成可执行的仓库结构和实施顺序，防止后续按单个需求临时堆叠，重点解决以下问题：

1. Agent 产品领域、Runtime 编排、Provider Adapter 和 AgentOS 基础设施各自放在哪里。
2. 当前扁平的 `apps/space-runtime/src` 如何渐进拆分，而不同时改变行为。
3. Agent Definition、Space binding、session、Turn、账务和审计分别由谁持久化。
4. Backend、Space Runtime、Matrix、Product DB/Object Store 和 AgentOS 之间允许哪些依赖。
5. 每个阶段改什么、不改什么，达到什么证据后才能进入下一阶段。

本计划是 A4 的唯一结构实施入口。新增 Agent 能力前，应先把工作映射到本文的目标模块和阶段；无法映射的变化先更新稳定设计或本文，不直接落代码。

## 2. 当前基线与结构债务

### 2.1 已经成立的基线

- `apps/backend` 已完成真实 Matrix Mention 复核、membership/ACL、credits reservation、Runtime 入队和失败退款。
- `libs/space-runtime-control` 与 `space_runtime_turn` 已经是 Project、Turn、lease/fencing 和 Outbox 的唯一控制平面；不得再创建第二条 Agent 请求队列。
- `apps/space-runtime` 已有每 Space 串行、跨 Space 并行的调度、Pi/fake Adapter、Candidate 隔离、Publish 屏障和回调链路。
- Agent execution runtime 与 App execution runtime 已经抽出首版边界；AgentOS client/deploy 调用不再散落在主要业务编排文件。
- Pi 保留现有 `space-<spaceInstanceId>` actor key；新 Agent 的逻辑隔离目标为 `Space × Agent × generation`。
- AgentOS/Rivet Engine 的默认部署单位已经确定为环境/区域，而不是单 Space 或全球唯一集群。

### 2.2 必须显式偿还的结构债务

| 当前事实 | 结构问题 | 目标出口 |
| --- | --- | --- |
| `server.ts` 同时拥有 HTTP、调度、Agent Turn、Restore、Publish 和 callback 编排 | composition root 与应用逻辑混合，后续功能容易继续堆在入口文件 | S1 拆为 composition、transport、scheduler 和 turn-processor |
| `agent-adapter.ts` 同时包含协议、Registry、Pi 装配和 fake 实现 | Provider-neutral 合约与具体 Adapter 混合 | S1/S4 拆为 adapter contract、registry、`pi/`、`fake/` |
| `generator.ts` 同时包含 Host Pi、AgentOS Pi、prompt、session 和 Project 文件同步 | Pi 实现无法独立测试和替换 | S1 先按职责拆文件，S4 再切完整 Adapter 合约 |
| `AgentExecutionRuntime` 返回 AgentOS VM 具体类型 | AgentOS 类型仍穿透到 Pi runner | S1 定义无 AgentOS 类型的 execution handle，S4 完成迁移 |
| `AppExecutionRuntime` 直接暴露 VM/`deployApp` 返回类型 | Release 编排仍依赖 provider 形状 | S1 引入 provider-neutral Candidate/Release 结果 |
| Runtime 内 `SpaceAgentRegistry` 是进程内 Map | 它只能表示已安装 Adapter，不能成为产品 Agent Registry | S2 新建 Product DB Agent Definition/Binding；Runtime Map 政名为 AdapterRegistry |
| `room_index.default_agent_id` 是唯一允许判断 | 只能支持一个默认 Agent，不能表达 allowlist、版本、预算和工具策略 | S2 双读 binding，保留兼容指针；S3 切换权威 |
| `space_runtime_turn.payload_json` 携带 Agent 信息 | 缺少固定 Definition/version/session/policy snapshot | S2 扩展现有 Turn 记录，不创建平行 request/batch 表 |

## 3. 固定边界：后续实现不得漂移

### 3.1 数据权威

| 数据 | 唯一权威 | 禁止做法 |
| --- | --- | --- |
| 身份与登录 session | Better Auth | Runtime 自建用户或接受浏览器 Cookie |
| Space membership 与 Chat timeline | Matrix/Synapse | AgentOS actor 或 Product DB participant projection 取代实时 membership |
| Agent Definition、binding、policy、session metadata | Product DB 的 Agent 领域 | Runtime 内 Map、环境变量或 AgentOS actor 成为长期权威 |
| Turn、batch、lease、attempt、fencing、Outbox | 现有 `libs/space-runtime-control` | 新建并行 Agent queue、按 Agent 复制一套 Space queue |
| credits reservation、settlement、refund | `libs/ai` + `libs/credits` | Adapter/Runtime 直接修改账本 |
| Project/Revision/Release 指针 | Product DB | AgentOS Release 状态直接移动产品指针 |
| source/artifact/provenance | Object Store/Registry | Runtime 本地文件成为生产 fallback 权威 |
| 活动 VM、瞬时 progress、serving replica | Runtime/AgentOS，可重建 | 把 VM 是否存活等同于业务完成 |

### 3.2 部署与隔离

- 默认拓扑固定为“每环境/区域一个共享 AgentOS/Rivet Engine 运行平面 + 多个 Space Runtime replica”。
- Space 是逻辑 App identity、单写队列和 lease 分区；不是 AgentOS 安装单位。
- Agent session key 固定为 `spaceInstanceId + agentId + generation`。
- Dev/Candidate key 固定为 `spaceInstanceId + revisionId`；Release key 固定为不可变 `releaseId`。
- Agent execution、App build/dev、Release serving 可以共用 Engine 控制面，但 credential、network、quota、镜像和指标必须可独立治理。

### 3.3 命名与兼容

- Runtime 应用核心统一使用 `spaceInstanceId`；`appId` 只存在于 AgentOS Apps transport/兼容边界。
- 产品 Agent identity 使用 provider-neutral `agentId`；`pi`、provider、model、CLI 参数只进入 Definition 或 Pi Adapter。
- `SpaceAgentRegistry` 的当前进程内 Map 在 S1 改名为 `SpaceAgentAdapterRegistry`，避免与 Product DB Registry 同名。
- `SPACE_AGENT_*` / `SPACE_TURN_*` 用于平台调度；`PI_*` 仅用于 Pi provider/model/CLI，并按既定周期移除旧调度 fallback。

## 4. 目标仓库结构

### 4.1 Workspace 级结构

```text
packages/space-agent-contracts/
├── src/ids.ts
├── src/definitions.ts
├── src/bindings.ts
├── src/sessions.ts
├── src/turns.ts
├── src/events.ts
├── src/usage.ts
├── src/errors.ts
├── src/callbacks.ts
└── src/index.ts

libs/space-agents/
├── registry/
│   ├── service.ts
│   └── repository.ts
├── bindings/
│   ├── service.ts
│   └── repository.ts
├── sessions/
│   ├── service.ts
│   └── repository.ts
├── policy/evaluate-invocation.ts
├── audit/service.ts
├── database-repository.ts
├── bootstrap.ts
├── index.ts
├── README.md
└── AGENTS.md

libs/database/schema/
├── pg/space-agent.ts
├── sqlite/space-agent.ts
└── space-agent.ts

libs/space-runtime-control/
├── contracts.ts
├── database-repository.ts
├── object-store.ts
└── index.ts

apps/backend/src/
├── lib/space-agent-invocation.ts
├── lib/space-agent-callbacks.ts
├── lib/matrix-agent-mention.ts
├── lib/matrix-agent-reply.ts
└── routes/v1/spaces/instances/$roomId/turns.ts

apps/space-runtime/src/
├── server.ts
├── composition/
├── transport/http/
├── space-instance/
├── scheduler/
├── turn-processor/
├── adapters/
├── agent-runtime/
├── app-runtime/
├── release-manager/
├── project/
├── control-plane/
├── infrastructure/
└── cli/
```

### 4.2 Space Runtime 目标结构

```text
apps/space-runtime/src/
├── server.ts                         # 只加载配置、组装依赖、启动 HTTP server
├── composition/
│   ├── create-runtime.ts             # 唯一 concrete dependency composition root
│   ├── create-http-app.ts            # Hono 中间件与 route 装配
│   ├── dependencies.ts               # 应用层依赖接口与实例集合
│   └── runtime-config.ts             # 平台配置解析与弃用告警
├── transport/http/
│   ├── health-routes.ts
│   ├── instance-routes.ts
│   ├── project-routes.ts
│   ├── turn-routes.ts
│   └── app-proxy-routes.ts
├── space-instance/
│   ├── space-instance-server.ts
│   ├── state.ts
│   └── events.ts
├── scheduler/
│   ├── turn-scheduler.ts             # batch window、跨 Space 并发
│   ├── claimed-turn-executor.ts      # claim 后 dispatch、billing/completion finally
│   └── heartbeat.ts
├── turn-processor/
│   ├── process-agent-turn.ts
│   ├── process-publish-turn.ts
│   ├── process-restore-turn.ts
│   ├── progress.ts
│   └── errors.ts
├── adapters/
│   ├── contract.ts                   # 完整 provider-neutral Adapter 合约
│   ├── registry.ts                   # 只注册已安装 Adapter 实现
│   ├── pi/
│   │   ├── adapter.ts
│   │   ├── agentos-runner.ts
│   │   ├── host-runner.ts
│   │   ├── session.ts
│   │   ├── project-workspace.ts
│   │   └── prompt.ts
│   └── fake/adapter.ts
├── agent-runtime/
│   ├── contract.ts                   # 无 AgentOS 类型的 execution handle
│   └── agentos/
│       ├── client.ts
│       ├── execution-runtime.ts
│       └── actor-key.ts
├── app-runtime/
│   ├── contract.ts                   # Candidate/Release provider port
│   └── agentos/
│       ├── client.ts
│       ├── app-runtime.ts
│       └── release-mapper.ts
├── release-manager/
│   ├── dev-preview-manager.ts
│   ├── release-manager.ts
│   └── policy.ts
├── project/
│   ├── project-service.ts
│   ├── remote-project-store.ts
│   ├── validation.ts
│   └── types.ts
├── control-plane/
│   ├── durable-control-client.ts
│   ├── callbacks.ts
│   └── runtime-replica.ts
├── infrastructure/
│   ├── actors.ts
│   └── rivet-health.ts
└── cli/deploy-workspace.ts
```

目录是责任边界，不要求一次性创建空文件。每次只在对应阶段移动已有实现或新增已验收能力；不为“看起来完整”提前生成占位模块。

## 5. 依赖方向

### 5.1 Workspace 依赖

```text
space-agent-contracts
        ↓
space-app-contracts / api-contracts
        ↓
libs/space-agents                 libs/space-runtime-control
        ↓                                   ↓
Backend application services  →  Runtime control API
                                            ↓
                              Space Runtime application layer
                                ↓                       ↓
                         Agent Adapter ports     Release manager
                                ↓                       ↓
                         Agent runtime impl       App runtime impl
                                └──────── AgentOS ───────┘
```

固定规则：

1. `packages/space-agent-contracts` 不依赖 Backend、Runtime、AgentOS、Pi、数据库或 UI。
2. `packages/space-app-contracts` 可以复用 Agent ID/公开视图 schema；Matrix Mention 与 App bridge 仍由它维护。
3. `packages/api-contracts` 只组合 route envelope，不复制 AgentEvent、usage 或 error schema。
4. `libs/space-agents` 可以依赖 contracts 和数据库抽象，不依赖 AgentOS、Pi、Hono、Matrix SDK 或 UI。
5. `libs/space-runtime-control` 继续拥有 queue/lease/outbox，不依赖 Agent Definition 的 provider 实现。
6. Backend route 只做 HTTP 适配；完整 invoke 顺序进入 `space-agent-invocation.ts` 和领域服务。
7. `turn-processor` 只能依赖 Adapter、Project、ReleaseManager、SpaceInstance 和 control-plane 的接口。
8. Adapter 不读取 Product DB schema，不调用 credits/Matrix，不移动 ready/published 指针。
9. 只有 `agent-runtime/agentos`、`app-runtime/agentos` 和 `infrastructure/actors.ts` 可以 import AgentOS 包。
10. 只有 composition root 可以同时 import 应用层接口与具体 AgentOS/Pi 实现。

### 5.2 自动边界检查

S1 必须新增或扩展应用边界检查，至少阻止：

- `@rivet-dev/agentos*` 出现在允许目录之外；
- `deployApp()`、`vm.getOrCreate()` 出现在 concrete runtime 实现之外；
- `apps/space-runtime` import `libs/database`、`libs/credits`、`libs/ai` 或 Matrix provider；
- `libs/space-agents` import AgentOS/Pi/Hono；
- `adapters/*` import Backend route、账本、Matrix 或数据库 schema；
- Runtime 核心新增 `appId` 参数而没有兼容边界注释。

## 6. 合约结构

### 6.1 公共 Agent 合约

`packages/space-agent-contracts` 固定维护以下版本化类型：

- `SpaceAgentId`、`AgentDefinitionId`、`AgentSessionId`、`AgentTurnId`；
- Agent Definition 与 Space binding 的公开/内部 snapshot；
- `AgentSessionRefV1` 与 generation/restore 状态；
- `AgentTurnInputV1`，包含固定 Definition、policy snapshot、预算、上下文引用和 Project revision；
- `AgentEventV1`：`status`、`text_delta`、`tool_activity`、`project_patch`、`usage`、`completed`、`failed`；
- `AgentUsageV1` 与明确的 unit/schema version；
- 标准错误：code、retryable、sessionAction、billingState、bounded diagnostics；
- Backend↔Runtime completion/billing callback schema。

Provider 原始 event、VM 类型、provider session token、完整 prompt 和内部 diagnostics 不进入该 package。

### 6.2 Adapter 合约

目标 Adapter 接口固定为：

```ts
interface SpaceAgentAdapter {
  readonly key: string
  readonly version: string
  availability(definition: AgentDefinitionSnapshot): AgentAvailability
  beginSession(input: BeginSessionInput): Promise<AgentSessionRef>
  runTurn(input: AgentTurnInput, signal: AbortSignal): AsyncIterable<AgentEvent>
  summarize(input: AgentSummaryInput): Promise<AgentSummary>
  cancel(input: CancelAgentTurnInput): Promise<void>
  restore(input: RestoreAgentSessionInput): Promise<AgentSessionRef>
}
```

约束：

- Adapter key 是实现类型，不等于产品 `agentId`。
- Turn claim 时固定 Definition ID/version、Adapter version、policy hash 和 session generation；重试不静默换模型。
- Adapter 只产生通用事件和 usage，不决定 ACL、credits、queue 状态、Project 指针或 Publish。
- fake、Pi 和第二真实 Adapter 必须运行同一 contract test suite。

### 6.3 Execution Runtime 合约

当前返回 AgentOS VM 的首版接口是过渡态。目标端口不得暴露 AgentOS 类型：

```ts
interface AgentExecutionRuntime {
  open(input: AgentExecutionTarget): Promise<AgentExecutionHandle>
}

interface AgentExecutionHandle {
  syncProject(snapshot: ProjectSnapshot): Promise<void>
  stream(command: AgentRuntimeCommand, signal: AbortSignal): AsyncIterable<AgentRuntimeEvent>
  readProject(): Promise<ProjectSnapshot>
  close(): Promise<void>
}
```

App 执行端口同样只返回通用 Candidate/Release 结果：

```ts
interface AppExecutionRuntime {
  prepareCandidate(input: CandidateInput): Promise<CandidateResult>
  fetchCandidate(input: CandidateFetchInput): Promise<AppResponse>
  deployRelease(input: ReleaseInput): Promise<ReleaseResult>
  disposeCandidate(input: CandidateIdentity): Promise<void>
}
```

`ReleaseManager` 负责 ready/failed 保留策略和 scaling policy；具体 App runtime 只负责 provider 调用，不移动产品指针。

## 7. 数据模型与兼容策略

### 7.1 新增 Agent 领域记录

物理表名固定为：

| 表 | 主键/唯一约束 | 核心字段 |
| --- | --- | --- |
| `space_agent_definition` | `definition_id`；唯一 `agent_id + version` | Adapter/provider/model、capabilities、tool/pricing policy、region、status、created/updated |
| `space_agent_binding` | `binding_id`；唯一 `space_instance_id + agent_id` | definition ID、default、permission/tool/budget policy、status、created/updated |
| `space_agent_session` | `session_id`；唯一 `space_instance_id + agent_id + generation` | definition/adapter version、provider ref、summary ref/hash、region、restore status、last turn |
| `space_agent_audit_event` | `event_id` | space/agent/session/turn、event type、policy/result metadata、createdAt |

PG 与 SQLite/D1 schema、migration、repository contract 和测试必须在同一阶段完成。日志/审计 metadata 不保存完整消息、prompt、源码、credential 或 provider 原始事件。

### 7.2 不新增第二条请求队列

Agent request/batch 继续落在现有 `space_runtime_turn`。S2 通过兼容 migration 增加或固定以下字段，不创建 `space_agent_request` / `space_agent_batch` 平行表：

- `agent_id`；
- `agent_definition_id`；
- `agent_definition_version`；
- `adapter_key` / `adapter_version`；
- `session_generation`；
- `policy_snapshot_hash`；
- `reservation_transaction_id`；
- `cancel_requested_at`；
- versioned payload/result schema。

`message` kind 在兼容期继续可读；应用层统一称为 Agent Turn。若未来迁移为 `agent` kind，必须使用双读/单写、回填和回滚，不直接改历史行。

### 7.3 `room_index.default_agent_id` 迁移

1. S2 seed `pi` Definition，并为现有 Space 幂等创建默认 binding。
2. 兼容期读取优先级为 binding → `room_index.default_agent_id` → `pi` bootstrap；写入只写 binding，并同步旧指针。
3. S3 所有 invoke/publish snapshot 已使用 binding 后，旧字段降级为兼容 projection。
4. 是否删除旧字段必须单独评审；在旧客户端、Matrix v1 state 和回滚工具仍读取时不得删除。

## 8. 固定执行流

### 8.1 Agent Invoke

```text
HTTP route
→ Better Auth + realtime Matrix membership
→ exact Matrix Agent Mention verification
→ Agent Definition/Binding/permission/budget/region policy
→ deterministic credits reservation
→ pin Definition + policy + session generation
→ enqueue existing space_runtime_turn
→ Runtime 202
```

Runtime 拒绝或入队失败时使用稳定 transaction ID 退款；相同 Matrix event ID 不得重复 reservation 或 Turn。

### 8.2 Agent Turn

```text
Scheduler
→ Space lease/fencing claim
→ ClaimedTurnExecutor
→ resolve pinned Adapter + session
→ stream AgentEvent
→ Conversation: completeChat
  or Revision: Candidate → validate → save ready Revision
→ enqueue billing/reply/state Outbox
→ complete Turn under current fencing token
```

旧 owner 失去 lease 后不能保存 Project、完成 Turn 或发出副作用。Adapter 失败不改变最后 ready Revision；人类 Matrix 消息已经存在且保持可见。

### 8.3 Publish / Restore

Publish 和 Restore 继续使用同一 Space queue，不进入 Agent Adapter：

- Publish 固定 `expectedReadyRevisionId`，Candidate 复核成功后才部署不可变 Release并移动 published pointer。
- Restore 固定 expected revision，从官方不可变 Template 准备 Candidate，成功后才移动 ready pointer。
- 两者都由专用 Turn processor 执行，不能通过自然语言或 Generated App 直接触发。

### 8.4 Cancel / Session Restore

- Cancel 先持久化 `cancel_requested_at`，再通知 active Adapter；完成状态和账务由唯一 owner 收口。
- Runtime/VM 中断后，从固定 Definition、session generation、summary、授权消息窗口和 Project snapshot 恢复。
- provider session 无法恢复时递增 generation；不得跨 Agent 或跨 Space 复制隐藏上下文。

## 9. 阶段与顺序

| 阶段 | 目标 | 行为变化 | 状态 |
| --- | --- | --- | --- |
| S0 | Agent/App runtime 首版封装、平台配置命名 | 无用户可见变化 | Complete（当前工作树） |
| S1 | Space Runtime 结构拆分和自动边界检查 | 无行为变化 | Complete（2026-08-26） |
| S2 | Agent contracts、领域库、DB schema、默认 Pi binding | 兼容双读，不开放多 Agent | Complete（2026-08-27） |
| S3 | Backend invoke 切到 Definition/Binding policy，Turn 固定版本 | 默认 Pi 行为保持，多 Agent 仍可关闭 | Complete（2026-08-27） |
| S4 | 完整 Adapter/session/event/cancel/restore 合约 | session 可恢复，协议不再绑定 Pi | Complete（2026-08-27） |
| S5 | 区域级外部 AgentOS、独立 pool、双 Runtime 接管 | 部署形态变化 | Repository Complete；云环境演练 Pending（2026-08-27） |
| S6 | 第二真实 Adapter、Admin 治理、区域/专属 pool | 受控产品扩展 | Repository Complete；目标环境演练 Pending（2026-08-27） |

### 9.1 S1：只做结构拆分

顺序固定为：

1. 先建立 `composition` 和 dependency interfaces，让 `server.ts` 只负责组装。
2. 原样移动 `scheduleSpace` / `drainTurnQueue` 到 `scheduler`，不改 batching、并发或 claim 语义。
3. 原样移动 `executeClaimedTurn`、Agent/Publish/Restore processor，一次只移动一条流程。
4. 将 `DevPreviewManager` 与发布 policy 收到 `release-manager`；AgentOS provider 调用保留在 `app-runtime/agentos`。
5. 将 Adapter contract/registry、Pi/fake 实现拆目录；Host Pi 与 AgentOS Pi 仍保持现有行为。
6. 最后拆 HTTP routes，并新增 import boundary check。

S1 禁止同时增加 DB 表、改 Adapter 事件协议、改 credits、开放多 Agent 或改变部署拓扑。每次移动必须先做 GitNexus impact，再以 detect-changes 和相关流程测试收口。

#### S1 完成记录（2026-08-26）

S1 已按冻结顺序完成全部行为保持型结构拆分；以下记录保留各切片证据和最终闭环：

- [x] 将 batch window、跨 Space 并发上限、单 Space active/scheduled 状态和 claim/execute 驱动原样移入 `scheduler/turn-scheduler.ts`；`server.ts` 只为该切片组装 `claimTurn` 与 `executeClaimedTurn` 依赖。
- [x] 保留现有 `space_runtime_turn`、claim、完成后续取和空队列退出语义；没有修改 schema、credits、Adapter 协议、多 Agent 开关或 AgentOS 部署拓扑。
- [x] 增加 4 个 scheduler 单元测试，覆盖 batch 去重、跨 Space 并发上限、同 Space 串行续取和 claim 返回空值。
- [x] 将 claim 后的 Agent/Publish/Restore 分发、失败收口和 billing/completion `finally` 原样移入 `scheduler/claimed-turn-executor.ts`；具体 processor 通过依赖接口注入，当前 Restore 实现仍留在 composition root 文件。
- [x] 增加 5 个 claimed-turn executor 单元测试，覆盖三类 Turn 分发、默认 Agent、processor 失败、缺失 Publish metadata、completed/failed billing、单次 completion 和 callback 失败隔离。
- [x] 将 Agent Conversation/Revision、Candidate、自动修复、usage 累计、heartbeat、ready Revision 保存与失败保护原样移入 `turn-processor/process-agent-turn.ts`；Adapter、Project Store、Dev Preview、SpaceInstance 和错误分类通过端口注入，Publish/Restore 未随本切片移动。
- [x] 增加 6 个 Agent processor 单元测试，覆盖 Conversation、ready Revision 与 published lineage、可修复 Candidate、不可修复失败、Agent 不可用和 heartbeat 停止。
- [x] 将 Publish 的 Project/ready Revision 屏障、Dev Preview 复核、`dev_ready` announce、不可变 Release 部署、published pointer 更新、heartbeat 与失败保护原样移入 `turn-processor/process-publish-turn.ts`；`deployRevision`、错误分类与 SpaceInstance 仍由 `server.ts` 组合注入，Restore 未随本切片移动。
- [x] 增加 6 个 Publish processor 单元测试，覆盖固定 ready Revision 成功发布、Project 缺失、请求 Revision 过期、Preview 版本漂移、部署失败不移动 published pointer、`dev_ready` 先于 deploy、Project lineage 保留和 heartbeat 停止。
- [x] 扩展 `boundaries:check`，阻止新的 AgentOS import/`deployApp()`/`vm.getOrCreate()` 越过 concrete runtime 过渡白名单，并阻止 Space Runtime 直接依赖 Product DB、credits、AI 或 Matrix provider。
- [x] GitNexus 对 `scheduleSpace`、`drainTurnQueue`、接入点 `scanRunnableTurns`、`executeClaimedTurn`、`processTurn` 和 `publishCurrentProject` 的上游 impact 均为 LOW；Node 24.19.0 下 Space Runtime 18 个测试文件、60 个测试通过，Space Runtime typecheck/build 通过。
- [x] 最终 `detect-changes` 对累计未提交工作树报告 16 个已跟踪文件、80 个符号、16 条流程和 CRITICAL；相对上一切片新增 3 个符号、流程数不变，命中仍包含此前已有的 `runProjectTurn`、Dev Preview、原 `ProcessTurn → ValidateFiles` 等主流程。累计风险继续保留为显式警告，不用 `publishCurrentProject` 的单目标 LOW impact 将其降级；Publish 切片另由 6 个定向测试、Runtime 全量单测和类型/边界门禁收口。
- [x] Restore 已移入 `turn-processor/process-restore-turn.ts`，覆盖成功恢复、保留 Published Release、ready Revision/Template 失效、Candidate 失败保护和 heartbeat 生命周期；Restore 不调用 Agent Adapter 或 credits。
- [x] `DevPreviewManager`、Release policy 与 immutable deploy 已归入 `release-manager/`；App execution port 使用 provider-neutral Candidate/Release handle，现有 scaling `0 / 16 / 4`、事件 deployment payload、Revision URL 和失败保留语义不变。
- [x] Adapter contract/registry、Pi/fake 已按 `adapters/` 拆分；Pi 的 config、prompt、session、Project workspace、Host runner 和 AgentOS runner 各自拥有单一责任，`generator.ts` 只作兼容 façade。Agent execution handle 不暴露 AgentOS VM 类型，Adapter/Runtime core 使用 `spaceInstanceId`。
- [x] `composition/create-runtime.ts` 是 concrete dependency composition root，`composition/create-http-app.ts` 只装配中间件和 routes；health、instance、project、turn 与 App proxy 已进入 `transport/http/`，`server.ts` 只创建 Runtime、Hono app 和 HTTP listener。
- [x] AgentOS/Pi import allowlist 已收紧为 `agent-runtime/agentos/**`、`app-runtime/agentos/**` 和 `infrastructure/actors.ts`；门禁同时阻止 provider invocation、Adapter 产品域依赖和新 Runtime core `appId` 参数越界。
- [x] 新增/扩展 Restore、ReleaseManager、execution runtime、Adapter、Pi Project workspace、HTTP composition 等测试；Node 24.19.0 下 Runtime 22 个测试文件、73 个测试通过，Runtime typecheck/build 与 `boundaries:check` 通过。
- [x] 本阶段没有修改 DB/schema、credits、Adapter 完整事件协议、多 Agent 产品行为或 AgentOS 部署拓扑；S2 保持 Pending，区域共享生产 Engine/独立 pool 仍属于 S5。
- [x] GitNexus 增量索引已更新到 8,488 nodes / 18,096 edges / 300 flows；最终 `detect-changes --scope all` 映射 21 个已跟踪文件、44 个符号、0 条已索引流程，风险 LOW。Git diff 不包含未跟踪的新模块，因此新增目录另由 388 个活动源码文件的边界检查、Runtime 全量单测和 TypeScript 门禁覆盖，不把 detect 的 LOW 结果扩大解释为未跟踪文件证据。
- [x] `pnpm docs:check`、docs app 直接 production build 和 `git diff --check` 通过。根 `pnpm typecheck`、`pnpm build` 与根 `build:docs` 在 Turbo 启动阶段因当前 macOS 无可用 Keychain/TLS 失败，未进入 workspace task；直接受影响的 Runtime 与 docs app 门禁已通过。`pnpm test:e2e` 已尝试，但 Chromium 在启动时因当前沙箱 MachPort `Permission denied` 退出，未执行产品断言；S1 没有用户可见行为变化，不能把该环境失败写成 E2E 通过。
- [x] 2026-08-27 后续在允许启动 Chromium 的环境补齐运行证据：完整 E2E 为 56 通过、0 失败、3 个显式 Agent 开关用例跳过；随后以 `E2E_SPACE_AGENT_EXPECT_READY=1` 单跑 collaboration spec，两条真实 Pi/provider 用例 2/2 通过，覆盖幂等 Matrix Agent event 和双 live App ready Revision 切换，Fake Candidate 用例因未开启测试 Adapter 按设计跳过。该后续证据消除了上一条的浏览器环境未覆盖项，但不改变 S2–S6 的 Pending 状态，也不代表生产共享 Engine 或多副本接管完成。
- [x] 同轮 `pnpm docs:check`、`pnpm build:docs`、`pnpm typecheck`、`pnpm build` 和 `git diff --check` 均通过；类型与产品构建覆盖 19/19 workspace project。构建保留 Node 26 engine range、既有 bundle 体积和第三方 `use client` warning，不影响成功结果；E2E 使用 Node 24.15.0 避开 Node 24.19.0 与 `better-sqlite3` 的 Vite worker cleanup assertion。

### 9.2 S2：Contracts 与领域数据

1. 新建 `packages/space-agent-contracts`，先迁移内部 callback/usage/error schema，再由旧 package 兼容 re-export。
2. 新建 `libs/space-agents` repository ports、service 和默认 Pi bootstrap。
3. 同步 PG、SQLite/D1 schema 与 migration；增加三种 dialect repository tests。
4. 扩展现有 Runtime Turn 记录，固定 Definition/session/policy；不新增 queue。
5. 为历史 Space 幂等回填 binding，保持 `room_index.default_agent_id` 双读和回滚。

#### S2 完成记录（2026-08-27）

- [x] 已冻结首个 contracts-first 切片：新建 provider-neutral 的 `@vibechat/space-agent-contracts`，覆盖 Agent/Definition/Binding/Session/Turn identity、Definition 与 policy snapshot、版本化 usage/error/event、session ref 和 Backend↔Runtime callback；公共 schema 使用 strict object 与有界 diagnostics，不携带 credential、prompt、源码或 provider-native event。
- [x] `@vibechat/space-app-contracts` 暂时兼容 re-export 旧 Agent ID 与 callback 名称；Backend/Space Runtime 新消费者改从新 package 导入，旧调用方无需同批迁移。Runtime 内 `AgentUsage` 继续作为无版本内部累计形状，只有跨边界时转换为 `vibechat.agent-usage/v1`。
- [x] 已建立 `libs/space-agents` repository ports、Definition/Binding/session/audit service 和数据库 repository；解析顺序固定为“显式 binding（包括 disabled）→ 旧 `default_agent_id` → Pi bootstrap”，disabled binding 不得静默回退。session 只在 Definition、Adapter、region 与 restore 状态兼容时复用，否则递增 generation。
- [x] PG 与 SQLite/D1 schema 已对称增加 `space_agent_definition`、`space_agent_binding`、`space_agent_session`、`space_agent_audit_event`；现有 `space_runtime_turn` 只增加 nullable Definition/Adapter/session/policy/reservation/versioned payload-result/cancel 字段，没有创建第二条 queue。`0014` migration 幂等 seed Pi Definition，并只为旧 `default_agent_id = pi` 的 Space 回填默认 binding。
- [x] contracts、领域服务、schema parity、SQLite repository/migration/backfill 和 Runtime callback 定向测试共 6 个文件、19 个测试通过；回填测试重复执行 seed/backfill SQL，确认 Definition/binding 不重复，且非 Pi 旧指针不被误绑定。`pnpm typecheck` 与 `pnpm build` 均覆盖 20/20 workspace package 并通过，`pnpm docs:check`、`pnpm build:docs` 和边界检查通过；GitNexus 对本次 S2 切片报告 22 个已跟踪文件、39 个符号、0 条已索引流程，风险 LOW。
- [x] Node 24.15.0 完整 unit 为 245 通过、3 个既有失败、1 个 integration skip；既有失败仍是 `validators/user` 1 个和缺少默认邮件 provider key 导致的 `email/cloudflare` 2 个，与本切片一致。所有包含新 `0014` SQLite migration 的数据库 repository、credits、payment、identity、rooms、social 和 Runtime control-plane 测试均通过。
- [x] Wrangler 本地 D1 已从 `0000` 连续应用到 `0014`，确认四张 `space_agent_*` 表、Pi Definition seed 与 Turn 新字段存在；D1 request binding repository contract 1/1 通过，Definition、binding、session 与 audit 均经实际 D1 proxy 读写。
- [x] PostgreSQL 17 已单独应用 `0014` 并验证 seed/backfill 重复执行不产生重复 Definition/binding、旧 Turn 保留、关键固定字段存在，repository integration contract 1/1 通过。演练同时发现 PG journal 引用的 `libs/database/drizzle/0000_optimal_mad_thinker.sql` 历史缺失；已依据 `0000_snapshot.json` 与后续 migration 边界恢复，并在新的空 PostgreSQL 17 上通过 `pnpm db:migrate` 完成 `0000 → 0014` 全链路迁移，随后 repository integration contract 再次 1/1 通过。
- [x] 回滚固定采用 additive compatibility：S3 切换前可停止读取 binding 并继续使用 `room_index.default_agent_id`；已部署的 nullable Turn 字段和领域表保留，不做破坏性 down migration。需要撤回 bootstrap 时只禁用或删除对应 `space_agent_binding` 行，不删除旧默认指针、Definition 或历史 Turn。S2 只完成领域数据基线；binding 权威切换、enqueue snapshot 和多 Agent 产品行为仍属于 S3。

### 9.3 S3：Backend 调用切换

1. 把当前 Turn route 的 mention、policy、reservation、enqueue、refund 编排移入可测试 application service。
2. 用 Definition/Binding 代替 `agentId === defaultAgentId` 判断。
3. Enqueue 时保存固定 Definition/version、Adapter version、policy hash、session generation 和 reservation ID。
4. Snapshot/Matrix v2 state 输出 Agent 公开视图；旧客户端继续得到 default Agent。
5. 多 Agent allowlist 先 feature flag，默认仅 Pi；没有第二 Adapter 证据前不开放 UI 管理。

#### S3 完成记录（2026-08-27）

- [x] Backend Turn route 已缩减为 HTTP/auth 适配，Mention、Definition/Binding 解析、credits reservation、budget policy、Project Revision、session generation、Runtime enqueue 与失败退款集中到可注入的 `SpaceAgentInvocationService`。调用顺序继续要求 Better Auth + 实时 Matrix membership、精确 Matrix event Mention 与稳定 eventId 计费键；默认 feature flag 仅允许 Pi，未开放多 Agent UI。
- [x] invoke 权威已经切到 Product DB Definition/Binding/session：显式 disabled、未绑定、Definition unavailable/frozen/version mismatch 均 fail closed，不能回退到旧 `room_index.default_agent_id`。新建 Space 在 Room 创建成功后幂等写入默认 Pi Definition/binding；相同创建请求遇到已有 disabled binding 时不重新启用。旧 Pi Space 在兼容期仍可从 legacy pointer/bootstrap 读取。
- [x] Backend 生成 `AgentTurnInputV1`，固定 Definition ID/version、Adapter key/version、session ID/generation、policy hash 与预算、授权 Matrix event 引用、Project ID/ready Revision/source hash 和请求时间；Runtime HTTP 边界复核 Turn/Space/Agent identity 后，将 snapshot 与 reservation transaction ID 写入现有 `space_runtime_turn` nullable 字段。重复 Matrix event 继续返回原 Turn，repository contract 断言重试不能覆盖最初 snapshot；没有新增第二条 queue。
- [x] Runtime snapshot 与 Matrix `io.vibechat.space.instance.v2` state 已输出只含公开 Definition/Binding 字段的 Agent view，同时保留兼容 `defaultAgentId` 与 `availableAgents`。provider/model、prompt、credential、预算和 policy 细节不会进入公开 view；billing/completion callback 优先按 Turn 固定 reservation/Agent fencing，历史 Turn 继续读取 payload/default Agent fallback。
- [x] service、binding provisioning/resolution、region/budget policy、callback fencing、public snapshot、Runtime HTTP、SQLite/D1 repository 和 control-plane 定向测试均通过；Node 24.15.0 下 Agent + Runtime + contracts 为 31 个文件、109 个测试通过。完整 unit 为 266 通过、3 个既有失败、2 个 integration skip；失败仍是 `validators/user` 1 个与缺少默认邮件 provider key 的 `email/cloudflare` 2 个，skip 为未配置 PostgreSQL/Synapse integration，与 S3 无关。
- [x] 21/22 workspace project 的递归 TypeScript 与 build 全部通过，覆盖 21 个有脚本的 workspace；docs app、Backend Workers、Web/Site/Admin、Space Runtime 和 packages 均完成 production build。根 Turbo typecheck 仍在 task 启动前受 macOS Keychain/TLS 初始化失败阻断，因此使用相同 pnpm 9.4/Node 24.15.0 逐 workspace 执行；Backend build 保留既有 Wrangler 日志目录权限和 bundle warning，但构建退出码为 0。`pnpm docs:check`、412 文件边界检查和 `git diff --check` 通过。
- [x] GitNexus 增量索引已刷新为 8,782 nodes / 18,737 edges / 300 flows；最终 staged `detect-changes` 映射 41 个文件、105 个符号和 1 条 `CreateRuntime → BackendDurableSpaceControl` 流程，风险 MEDIUM。该流程由 Runtime 全量测试、SQLite control-plane 固定 snapshot/重试不覆盖断言和真实 E2E 收口；没有 HIGH/CRITICAL 风险。
- [x] 允许启动本地 Engine/Chromium 后，以真实 Synapse、managed Rivet Engine、Host Pi/provider 和两个独立 Chromium Context 运行 `chat-space-agent-collaboration.spec.ts`：2 通过、0 失败、1 个未启用 Fake Adapter 的故障注入场景按设计跳过。首个场景新增断言 Product DB Agent public view 同时出现在 Runtime snapshot 与 Matrix v2 state，并继续验证唯一幂等 Agent Matrix event；第二场景验证真实 Pi Project Revision 在两个 live App surface 收敛且不隐式 Publish。
- [x] S3 没有实现完整 versioned Adapter event stream、cancel/session restore、生产区域共享 Engine 或第二真实 Adapter；这些边界继续属于 S4–S6。

### 9.4 S4：完整 Adapter 与 Session

1. 引入版本化 `AgentEvent` 和完整 begin/run/summarize/cancel/restore contract。
2. 先让 fake Adapter 通过全合约，再迁移 Pi；不能以 fake 作为产品 fallback。
3. 将 AgentOS VM 具体类型完全收回 `agent-runtime/agentos`。
4. 持久化 session generation、summary/ref、restore result 和 bounded audit。
5. 增加中断、取消、session rebuild、跨 Space/Agent 隔离和 usage 缺失退款测试。

#### S4 完成记录（2026-08-27）

- [x] 新增 provider-neutral lifecycle 端口，固定 `beginSession/runTurn/summarize/cancel/restore`；`runTurn` 只输出版本化 `AgentEventV1`，旧 S3 Adapter 接口暂时并行，生产 Registry、Pi 与 Turn processor 尚未切换。
- [x] Contracts 新增 strict 的 session summary、restore/rebuild result 与带 `Space/Agent/session generation` 隔离键的 cancel input；公共类型不包含 Pi、AgentOS、provider credential、prompt、源码或 provider-native event。
- [x] Fake Adapter 同时实现旧接口与完整 lifecycle，覆盖确定性 chat/revision/usage、标准失败、真正缺失 usage、AbortSignal、幂等 cancel、summary hash/ref 和 restore/rebuild。
- [x] 建立可复用 lifecycle contract suite：严格事件 schema、单调 sequence、唯一 terminal、chat/revision/usage、cancel/AbortSignal、summarize、restore/rebuild 及跨 Space/Agent/session 隔离均通过；该 suite 将由后续 Pi lifecycle 复用。
- [x] Node 24.19.0 下 contracts 与 Runtime typecheck 通过；contracts、旧 Adapter 兼容与 Fake lifecycle 定向测试 3 个文件、13/13 通过。Fake 仍只在显式测试开关下注册，不能成为产品成功 fallback。
- [x] 第二切片让 Pi Adapter 通过同一 lifecycle suite；Host Pi 将 AbortSignal 映射为子进程终止，AgentOS Pi 将取消映射为活动 session 删除和后续 rebuild。Runtime-local Project workspace 负责 staged source，公共 Turn/Event schema 仍只持有 Project ref/hash。
- [x] Pi 与 Fake lifecycle、execution runtime 定向测试 3 个文件、17/17 通过，Runtime typecheck 通过；Pi/Fake 均保持旧 S3 接口兼容，Registry 和生产 processor 尚未切换。
- [x] 生产 `AgentTurnProcessor` 和 Adapter Registry 已切到固定 `adapterKey/version` 对应的完整 lifecycle；processor 只消费 strict `AgentEventV1`，校验单调 sequence、唯一 event ID、唯一 terminal、Conversation/Revision/Candidate repair 和 usage 累计。旧兼容方法不再是生产 Turn 权威。
- [x] Backend↔Runtime durable control API 已增加 session load/save/rebuild、bounded audit、Turn cancel control；Product DB session 初始状态为 `restoring`，restore 失败时以新 generation 幂等 rebuild，并拒绝旧 generation 竞争写。Runtime 不直连 Product DB，也不保存 prompt、消息正文、源码全文或 provider-native event。
- [x] session summary/ref/hash、restore/rebuild 结果和 bounded audit 写入都复核 active Turn、lease owner 与 fencing token；旧 owner、错误 Turn、错误 Space/Agent/session generation 均 fail closed。Runtime 同一 durable client 读取取消状态，并以 AbortSignal 通知 Adapter。
- [x] 新增成员鉴权的 `DELETE /v1/spaces/instances/:roomId/turns`：只有 Turn 发起人可请求取消，`cancel_requested_at` 首次写入后幂等返回；active owner 轮询后调用 Adapter cancel，并由唯一 completion/billing 路径失败收口和退款。
- [x] usage 缺失不再被视为零用量成功；Conversation/Revision 均以标准失败进入幂等退款。Candidate 连续 repair 失败继续保持旧 ready Revision、Published Release 与 Chat，不移动任何可见指针。
- [x] S4 定向验证为 35 个测试文件、133/133 通过；完整 Vitest 为 290 通过、3 个既有失败、2 个未配置 integration skip。既有失败仍为 `validators/user` 1 个和缺少默认邮件 provider key 的 `email/cloudflare` 2 个，与 S4 无关。
- [x] 真实 Synapse、managed Rivet Engine、Host Pi/provider、SQLite 和两个独立 Chromium Context 的 collaboration spec 最终 3/3 通过：幂等 Matrix Agent event、真实 Pi Revision 双端 live 收敛，以及显式 Fake Candidate 三次 repair 失败保护均通过。Fake Definition/Binding 只由 test helper 在显式 `SPACE_AGENT_FAKE_ENABLED=1` 与多 Agent 测试开关下建立，不成为生产 fallback。
- [x] `boundaries:check` 覆盖 414 个活动源码文件，`docs:check`、21/22 workspace 递归 typecheck/build、Cloudflare Workers 本地预览 `/api/health` 200（D1 healthy）和 `git diff --check` 通过。根 pnpm/Turbo 在当前 macOS 环境受 Corepack 网络解析与 Keychain/TLS 初始化影响，改用仓库固定 pnpm 9.4.0 的本地缓存逐 workspace 执行等价门禁；Wrangler 日志目录、bundle 体积、第三方 `use client` 与 Shiki WASM warning 均为退出码 0 的既有警告。
- [x] S4 不部署区域级外部 Engine、不证明两个独立 Runtime replica 共享同一 Engine，也不实现 worker pool 隔离；这些条件继续属于 S5，不能用本地 managed Engine 或单进程 E2E 替代。

### 9.5 S5：生产共享 AgentOS

1. 部署每环境/区域一个外部持久 AgentOS/Rivet Engine endpoint。
2. 至少两个 Space Runtime replica 连接同一 Engine，并竞争同一 Product DB lease。
3. 分离 Agent、build/dev、serving pool 的镜像、credential、egress、quota 和指标。
4. 演练旧 owner fencing、session restore/rebuild、R2 artifact、Release 跨宿主恢复和 Outbox 重放。
5. 建立部署、升级、回滚、容量和故障 Runbook；本地 managed Engine 只保留开发说明。

#### S5 仓库实现记录（2026-08-27）

- [x] 已固定 Runtime 的 `managed/external` Engine mode、无 credential/query/fragment 的 endpoint、region/replica identity、三类逻辑 pool class 和启动前置校验。生产必须显式 `SPACE_RUNTIME_ENGINE_MODE=external` 并提供 endpoint、region、replica ID；配置缺失时在 claim Turn 前启动失败，不能静默启动本地 Engine。
- [x] control Runtime 在 external/production 模式只做 Engine health preflight，不承载 Registry。开发 standalone Runtime 也使用三个独立子进程，只有 Agent worker 可以拥有 managed Engine；根开发启动器在 Engine ready 后启动并等待三个 worker，再启动应用。
- [x] Agent、App build/dev、Release serving 分别使用单 Registry OS worker 和独立 Envoy pool；同一镜像通过 `SPACE_RUNTIME_POOL_WORKLOAD` 选择角色。AgentOS VM/Apps concrete provider 已接入各自的 sidecar pool、network policy 和 quota，Runtime health 返回 `poolRoutingEnforced=true`。
- [x] provider credential 只存在于 Agent worker：control 的 `openSession` contract 不再携带 `env`，worker 内的 AgentOS session resolver 才注入 provider secret，并覆盖任何同名 client 输入。生产 control 检测到 key、生产 Agent worker 缺少全部 key、build/serving worker 检测到任一 key，都会在 Engine probe/Registry 启动前失败关闭；部署平台仍必须在 secret scope 层做物理隔离。
- [x] 新增 deployment/AgentOS infrastructure 测试，覆盖生产缺失配置、非法 endpoint、pool 折叠、managed 数据目录、external 健康预检、凭据边界和不可用失败关闭；Node 24.19.0 下 Space Runtime 全量 25 个测试文件、107/107 通过，Runtime typecheck、416 个活动源码边界检查、开发启动脚本语法和 `git diff --check` 通过。GitNexus 对配置解析、Engine 启动与 health route 的单符号 impact 均为 LOW；`SpaceRuntimeConfig` 接口影响为 MEDIUM、无业务执行流命中。
- [x] 两个独立 Node replica 共用 external Engine health 和 Backend control/Object Store client 的 deterministic harness 已覆盖 lease 接管、旧 owner fencing、session rebuild、Release pointer 与 outbox ACK 丢失重放；没有新增第二条 queue 或 Runtime 直连 Product DB。
- [x] disposable Rivet Engine `2.3.7` 上实测三个独立 pool 各两个 Envoy 同时 active；停止一个 build worker 后 `agent/build/serving` active connection 为 `2/1/2`，没有复现多 Registry 同进程的互相挤出。相同检查已固化为 opt-in integration test。
- [x] 最终复跑 opt-in 真实 Engine pool integration 1/1、双 Node replica failover integration 1/1。完整 Chromium E2E 已尝试，实际为 39 passed、8 failed、3 skipped、9 did not run；失败来自当前共享环境的 Better Auth 429、seed foreign key、commission 数据漂移、Matrix timeout 和 `SPACE_RUNTIME_UNAVAILABLE`，未作为 S5 通过证据。
- [x] 已补齐[Space Runtime AgentOS 生产部署 Runbook](../../stable/runbooks/space-runtime-agentos-production.md)，覆盖环境/区域部署单位、secret/egress/quota、启动、metrics、灰度、升级、回滚、容量、备份恢复、fencing/session/artifact/Release/Outbox 故障处理；managed Engine 明确仅用于开发。
- [x] 新增签名 internal `capture_recovery_manifest` 与 `vibechat.space-runtime-recovery-manifest/v1`：在不导出 App State、源码、消息/prompt、provider/summary ref 或 Outbox payload 的前提下，记录 instance snapshot hash、Project/Revision/Object Store pointer、lease、脱敏 session identity 和 Turn/Outbox 聚合。SQLite 定向测试验证敏感字段不会进入恢复清单。
- [x] 新增 `pnpm test:a3-a4:target` 单一目标环境入口和 TEST-CATALOG 40.10：预检两个 Runtime、external Engine/pool metrics、Cloudflare D1、R2 S3/Backend 对象逐字节 hash、Synapse state/timeline、lease 接管/旧 owner 409、双副本固定 Dev/Live、专属 pool 0→2→0→2，以及恢复前后清单一致性。缺失凭据时在测试前失败，不把 integration skip 写成通过。
- [x] AgentOS Apps immutable Release 的 RivetKit callback 根因已定位为 guest stdin 未以 streaming mode 保持：Core 公共 `SpawnOptions` 与 kernel 转发补齐 `streamStdin`，Apps Release guest 固定使用 `streamStdin: true`。安装产物回归 1/1、A3/A4 repository suite 7/7、真实 Synapse/external Engine 的 `chat-matrix-room.spec.ts` 4/4（含同一 Live Release 长生命周期复读）和产品状态 9/9 通过；日志未再出现 `guest JavaScript stdin is already closed` 或 callback 30 秒超时。
- [x] 同一轮本地压力运行中，build worker 的共享 AgentOS `0.2.15` sidecar 在约 27 分钟、多批 Dev actor 后开始让全新 Candidate 返回 `internal_error`；保留 Engine/Actor/Release 并滚动替换 build worker 后，原始 120 秒产品状态场景从超时恢复为 8.5 秒通过，完整文件 9/9。该本地依赖限制已进入 Runtime README 与生产 Runbook，不把 worker 滚动恢复冒充生产跨宿主持久化证据。
- [ ] 外部环境限制：尚未在真实 Cloudflare D1/R2 + Synapse + external Engine 的不同宿主上执行完整故障演练，也没有生产 Engine 持久存储/备份恢复证据。本地 filesystem Engine 与 mock Backend harness 不能替代该运行证据；S5 仓库实现已完成，但生产验收在获得目标环境后才可关闭。

### 9.6 S6：第二 Adapter 与治理

- 第二真实 Adapter 必须先通过 S4 contract suite，再进入 Definition Registry。
- Admin 只管理 Definition/version、binding、冻结、policy 和审计；不能编辑 provider secret 或不可变源码。
- Agent 切换固定新 Turn 的 Definition，不改写进行中的 Turn 或复制旧 Agent 隐藏 session。
- Agent 市场、BYOK、多 Agent 自主协作和 E2EE 访问继续独立评审。

2026-08-27 实施切片已冻结：

- [x] 以 AgentOS 已锁定的 Claude Code ACP 包实现第二个真实 Adapter；Pi、Claude Code 与 fake 继续消费同一 provider-neutral lifecycle contract，第二 Adapter 先通过 S4 suite 再注册到 Runtime Adapter Registry。
- [x] Definition 新增版本化 execution pool policy：默认选择当前区域共享 Agent pool，专属模式必须固定受控 pool class；Runtime 只接受部署 allowlist 中的专属 pool，并在缺失 worker/错误区域时失败关闭。
- [x] 新增独立 Agent governance service 与 Admin API，覆盖 Definition/version 创建、freeze/unfreeze、Space binding/default switch、budget/tool/region/pool policy 和 bounded audit；provider credential 与 Project/source 不进入请求或响应。
- [x] 新 binding/Definition 只影响后续 invocation 固定的 `AgentTurnInputV1`；已经入队/active 的 Turn 继续使用原 definition snapshot、adapter version、session generation 与 execution pool。不同 Agent 的 session 继续以 `Space × Agent × generation` 隔离，不复制 provider session ref 或隐藏上下文。
- [x] Admin App 增加 Agent Governance 页面与权限回归；默认多 Agent 产品调用仍受 `SPACE_AGENT_MULTI_AGENT_ENABLED` 控制，不隐式开放市场、BYOK、多 Agent 自主协作或 E2EE。

#### S6 仓库实现记录（2026-08-27）

- [x] 新增 `claude-code` Adapter，固定 `@agentos-software/claude-code@0.2.7`，与 Pi/fake 共用 lifecycle factory、Project workspace、session/cancel/restore 和 usage 映射。Runtime Registry 只在 Adapter contract suite 通过后注册 Claude Code；公共 contracts、Matrix 和 Admin 响应不含 ACP/provider 原始事件或 credential。
- [x] Definition 增加不可变 `executionPoolPolicy`，支持当前区域的 `regional_shared` 与带受控 `poolClass` 的 `dedicated`。Backend invocation 固定 policy hash，Runtime 复核 Definition region、部署 allowlist 和实际 Agent worker pool；错误区域、未批准 pool 或缺失 pool 均在 provider 调用前失败关闭。
- [x] Agent governance service 与 Admin API/UI 已落地：Definition 版本按 SemVer 严格递增且 prerelease 低于 stable，同一 `agentId + version` 不可覆盖；freeze/unfreeze、Space binding/default switch、budget/tool/region/pool policy 与 bounded audit 均由 Product DB 领域服务执行。Admin 请求/响应 schema 明确拒绝 credential、prompt 和 Project/source。
- [x] PG 与 SQLite/D1 `0015` 增加 execution pool policy 并幂等 seed Claude Definition；`0016` 清理历史重复默认 binding，并用每 Space 单默认唯一索引守住后续写入。`upsertDefaultBinding` 在 PG/SQLite transaction 与 D1 batch 中原子切换；active binding 不能引用 frozen Definition。
- [x] 已验证新 binding/Definition 只影响后续 invocation：已固定 Turn 保持原 Definition/Adapter/session generation/execution pool；Pi 与 Claude Code session 继续按 `Space × Agent × generation` 隔离，不复制 provider session ref。治理、SemVer、冻结、原子默认切换、Turn 固定和跨 Agent session 隔离均有定向测试。
- [x] Node 24.19.0 下 S6 定向 11 个测试文件、73/73 通过；完整 Vitest 为 322 通过、3 个既有失败、4 个未配置/显式 integration skip。既有失败仍为 `validators/user` 1 个和缺少默认邮件 provider key 的 `email/cloudflare` 2 个；双 Runtime replica integration 在允许临时回环端口后另行 1/1 通过。
- [x] 当前 worktree 的 SQLite 从空库应用到 `0016` 并 seed，确认 Pi/Claude Definition、execution pool 字段和单默认唯一索引；Wrangler 本地 D1 实际应用 `0015/0016`。Cloudflare Workers 本地预览 `/api/health` 200（D1 healthy），未登录 Agent 治理 API 为 401。
- [x] 隔离 Web/Backend/Admin 实栈上的 Admin Chromium E2E 为 6/6，覆盖未登录 401、普通用户 fail-closed、治理页面、Definition 不可变冲突、freeze/unfreeze 恢复和既有运营域回归；Admin permission API 为 12/12。受影响的 21/22 workspace 递归 typecheck/build 全部通过，边界检查覆盖 428 个活动源码文件，`docs:check` 与 docs app production build 通过。根 `pnpm typecheck` 在 Turbo 启动任务前仍被本机 macOS Keychain/TLS 错误阻断，因此使用固定 pnpm 9.4.0/Node 24.19.0 逐 workspace 执行等价门禁；Wrangler 日志目录权限与 bundle warning 不影响构建退出码。
- [x] 目标环境 suite 已实现真实 Claude 专属 worker 演练与双 Chromium 产品验收：真实 Anthropic credential 只进入独立 `agentExecution` worker；Conversation 后停止 worker 使专属 pool 收敛为 0，replacement worker 连接同一 external Engine/session 后生成 Revision；两个 Matrix 成员验证唯一回复、ready Revision 双端收敛、刷新恢复和 Published Release 不被隐式移动。该 suite 尚未因目标凭据缺失而执行，不能提前关闭下一条生产门槛。
- [ ] 目标环境仍需使用真实 Anthropic credential、external Engine 和独立专属 `agentExecution` worker 完成 Claude Conversation/Revision、专属 pool 缺失/恢复、D1/R2/Synapse 跨宿主与备份恢复演练。本地运行证据不替代该生产验收；多 Agent 产品调用默认仍由 `SPACE_AGENT_MULTI_AGENT_ENABLED=0` 关闭。

## 10. 每阶段完成标准

| 范围 | 必须证据 |
| --- | --- |
| 结构移动 | GitNexus impact/detect、边界检查、Runtime 全量 unit、TypeScript、无公共 API diff |
| Contracts | schema parse/compat tests、旧 package re-export、Backend/Runtime 双消费者 typecheck |
| DB/domain | PG + SQLite/D1 migration、repository contract tests、回填幂等、回滚步骤 |
| Invoke | membership/ACL/Mention、allowlist、reservation/refund、eventId 幂等和负路径 API/E2E |
| Adapter/session | Pi + fake/第二 Adapter contract tests、cancel/restore、usage、错误标准化和隔离测试 |
| Candidate/Release | 失败保留 last ready、Publish barrier、固定 artifact、跨宿主恢复 |
| 部署 | 两 Runtime replica、外部 Engine、真实 Synapse/D1/R2、pool 隔离、告警与 Runbook |

适用门禁至少包括：

```bash
pnpm boundaries:check
pnpm docs:check
pnpm typecheck
pnpm build
pnpm test:e2e
```

大型结构拆分按受影响流程先跑定向测试，再跑完整 Runtime/Backend contract tests；生产部署阶段不能用 unit 或 managed local Engine 代替双进程真实演练。

## 11. PR 与变更纪律

1. 一个 PR 只完成一个结构目标或一个行为目标；不在同一 PR 同时大规模移动文件、改 schema 和改运行语义。
2. 移动文件先保留兼容 facade/re-export，消费者切完并通过检测后再删除旧入口。
3. 修改 function/class/method 前按仓库规则做 GitNexus impact；HIGH/CRITICAL 先报告再实施。
4. 每个新目录必须有明确 owner 和禁止依赖；不能出现 `utils/`、`common/`、`manager/` 作为无边界杂物箱。
5. 新增环境变量必须归属 platform、Adapter 或具体 runtime pool，不能使用含糊别名。
6. 新增 Agent 能力必须同时回答：Definition version、policy、session generation、usage、cancel、restore、audit、failure/refund。
7. 如果实现要求第二套 Space、Room、queue、credits、Project 或 Chat 权威，必须停止并更新稳定设计，不得在代码中绕过。

## 12. 依赖、风险与非目标

### 依赖

- PG、SQLite 和 D1 migration 必须同步；D1 写入原子性遵循现有 batch 约束。
- Agent invocation 继续依赖真实 Matrix membership/Mention 和幂等 credits ledger。
- S5 依赖可用的外部 AgentOS/Rivet Engine、R2、区域 secret 与两个 Runtime 运行位。
- AgentOS/Pi 版本升级必须独立于结构移动，并有 contract/recovery 证据。

### 主要风险

- `server.ts` 拆分触及调度、Candidate、Publish 和 callback 主流程，必须按流程逐步移动。
- Registry/binding 双读期间可能出现旧字段与新 binding 不一致；服务层必须有确定优先级、监控和修复命令。
- session ref 可能包含 provider 敏感信息；只保存恢复所需 opaque ref，必要时加密并限制审计输出。
- App/Agent runtime 接口设计过度抽象可能掩盖真实 provider 能力；以 Pi + fake + 第二 Adapter contract tests 校正，而不是提前做万能接口。

### 非目标与非承诺项

- 本计划不承诺 Agent 市场、BYOK、多 Agent 自主协作、跨 Space 自主任务或 E2EE Agent 访问。
- 本计划不要求一次性搬完目录；每个阶段只创建有真实实现和测试的模块。
- 本计划不把设计完成、schema 草案或 local managed Engine 运行写成生产 Complete。

## 13. 更新触发条件

发生以下任一情况时，必须先更新本文和稳定设计，再继续实现：

- 改变 AgentOS 默认部署单位、区域边界或 worker pool 信任模型；
- 新增第二条 queue、session/Project 权威或 Runtime 本地生产 fallback；
- 修改 Adapter 公共事件、session generation、billing 或错误语义；
- 改变 `room_index.default_agent_id` 兼容周期或 binding 权威切换顺序；
- 将 AgentOS/Pi/provider 类型引入公共 contracts 或应用层；
- 调整 S1–S6 顺序，或在阶段门禁未满足时提前开放多 Agent/第二 provider。
