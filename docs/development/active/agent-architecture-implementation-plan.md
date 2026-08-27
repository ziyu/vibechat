# Agent 架构实施结构计划

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-27
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
| S2 | Agent contracts、领域库、DB schema、默认 Pi binding | 兼容双读，不开放多 Agent | Active（2026-08-27） |
| S3 | Backend invoke 切到 Definition/Binding policy，Turn 固定版本 | 默认 Pi 行为保持，多 Agent 仍可关闭 | Pending |
| S4 | 完整 Adapter/session/event/cancel/restore 合约 | session 可恢复，协议不再绑定 Pi | Pending |
| S5 | 区域级外部 AgentOS、独立 pool、双 Runtime 接管 | 部署形态变化 | Pending |
| S6 | 第二真实 Adapter、Admin 治理、区域/专属 pool | 受控产品扩展 | Pending |

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

#### S2 开始记录（2026-08-27）

- [x] 已冻结首个 contracts-first 切片：新建 provider-neutral 的 `@vibechat/space-agent-contracts`，覆盖 Agent/Definition/Binding/Session/Turn identity、Definition 与 policy snapshot、版本化 usage/error/event、session ref 和 Backend↔Runtime callback；公共 schema 使用 strict object 与有界 diagnostics，不携带 credential、prompt、源码或 provider-native event。
- [x] `@vibechat/space-app-contracts` 暂时兼容 re-export 旧 Agent ID 与 callback 名称；Backend/Space Runtime 新消费者改从新 package 导入，旧调用方无需同批迁移。Runtime 内 `AgentUsage` 继续作为无版本内部累计形状，只有跨边界时转换为 `vibechat.agent-usage/v1`。
- [x] 已建立 `libs/space-agents` repository ports、Definition/Binding/session/audit service 和数据库 repository；解析顺序固定为“显式 binding（包括 disabled）→ 旧 `default_agent_id` → Pi bootstrap”，disabled binding 不得静默回退。session 只在 Definition、Adapter、region 与 restore 状态兼容时复用，否则递增 generation。
- [x] PG 与 SQLite/D1 schema 已对称增加 `space_agent_definition`、`space_agent_binding`、`space_agent_session`、`space_agent_audit_event`；现有 `space_runtime_turn` 只增加 nullable Definition/Adapter/session/policy/reservation/versioned payload-result/cancel 字段，没有创建第二条 queue。`0014` migration 幂等 seed Pi Definition，并只为旧 `default_agent_id = pi` 的 Space 回填默认 binding。
- [x] contracts、领域服务、schema parity、SQLite repository/migration/backfill 和 Runtime callback 定向测试共 6 个文件、19 个测试通过；回填测试重复执行 seed/backfill SQL，确认 Definition/binding 不重复，且非 Pi 旧指针不被误绑定。`pnpm typecheck` 与 `pnpm build` 均覆盖 20/20 workspace package 并通过，`pnpm docs:check`、`pnpm build:docs` 和边界检查通过；GitNexus 对本次 S2 切片报告 22 个已跟踪文件、39 个符号、0 条已索引流程，风险 LOW。
- [x] Node 24.15.0 完整 unit 为 245 通过、3 个既有失败、1 个 integration skip；既有失败仍是 `validators/user` 1 个和缺少默认邮件 provider key 导致的 `email/cloudflare` 2 个，与本切片一致。所有包含新 `0014` SQLite migration 的数据库 repository、credits、payment、identity、rooms、social 和 Runtime control-plane 测试均通过。
- [ ] PostgreSQL migration 目前只完成 Drizzle 生成和 schema parity，尚未在真实 PostgreSQL 应用；D1 目前由同一 SQLite schema/migration 与 SQL 执行证据覆盖，尚未在真实 Cloudflare D1 preview 应用。两者完成前 S2 保持 Active，binding 不切为权威，也不开放多 Agent UI。
- [ ] 回滚采用 additive compatibility：S3 切换前可停止读取 binding 并继续使用 `room_index.default_agent_id`；已部署的 nullable Turn 字段和领域表保留，不做破坏性 down migration。需要撤回回填时只禁用/删除 `space_agent_binding` 的 bootstrap 行，不删除旧默认指针或历史 Turn；真实 PG/D1 演练后再固化生产回滚命令。

### 9.3 S3：Backend 调用切换

1. 把当前 Turn route 的 mention、policy、reservation、enqueue、refund 编排移入可测试 application service。
2. 用 Definition/Binding 代替 `agentId === defaultAgentId` 判断。
3. Enqueue 时保存固定 Definition/version、Adapter version、policy hash、session generation 和 reservation ID。
4. Snapshot/Matrix v2 state 输出 Agent 公开视图；旧客户端继续得到 default Agent。
5. 多 Agent allowlist 先 feature flag，默认仅 Pi；没有第二 Adapter 证据前不开放 UI 管理。

### 9.4 S4：完整 Adapter 与 Session

1. 引入版本化 `AgentEvent` 和完整 begin/run/summarize/cancel/restore contract。
2. 先让 fake Adapter 通过全合约，再迁移 Pi；不能以 fake 作为产品 fallback。
3. 将 AgentOS VM 具体类型完全收回 `agent-runtime/agentos`。
4. 持久化 session generation、summary/ref、restore result 和 bounded audit。
5. 增加中断、取消、session rebuild、跨 Space/Agent 隔离和 usage 缺失退款测试。

### 9.5 S5：生产共享 AgentOS

1. 部署每环境/区域一个外部持久 AgentOS/Rivet Engine endpoint。
2. 至少两个 Space Runtime replica 连接同一 Engine，并竞争同一 Product DB lease。
3. 分离 Agent、build/dev、serving pool 的镜像、credential、egress、quota 和指标。
4. 演练旧 owner fencing、session restore/rebuild、R2 artifact、Release 跨宿主恢复和 Outbox 重放。
5. 建立部署、升级、回滚、容量和故障 Runbook；本地 managed Engine 只保留开发说明。

### 9.6 S6：第二 Adapter 与治理

- 第二真实 Adapter 必须先通过 S4 contract suite，再进入 Definition Registry。
- Admin 只管理 Definition/version、binding、冻结、policy 和审计；不能编辑 provider secret 或不可变源码。
- Agent 切换固定新 Turn 的 Definition，不改写进行中的 Turn 或复制旧 Agent 隐藏 session。
- Agent 市场、BYOK、多 Agent 自主协作和 E2EE 访问继续独立评审。

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
