# Space Runtime AgentOS 生产部署 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-27
> 维护范围：Space Runtime control replica、区域级 Rivet Engine、Agent/App build/Release serving worker pool

## 用途与部署边界

本 Runbook 用于部署和维护 Space Runtime 的生产 AgentOS 拓扑。部署单位固定为“环境 × 区域”，不是“一个 Space 一个 AgentOS”，也不是跨所有区域共用一个全球 Engine：

```text
一个环境/区域
├── 外部持久 Rivet Engine endpoint（1 个逻辑集群）
├── Space Runtime control replica（至少 2 个）
├── agentExecution worker deployment（至少 2 个进程）
├── appBuild worker deployment（至少 2 个进程）
└── releaseServing worker deployment（至少 2 个进程，按 Live 流量扩容）
```

control Runtime 只承载 HTTP、Turn scheduler、Product DB lease/fencing、Backend/Object Store client 和不含 provider secret 的 AgentOS client，不注册 RivetKit Registry。三个 worker deployment 可以复用同一镜像，但必须以独立 OS 进程和独立 workload role 运行；不能把三个 Registry 合并到一个 Node 进程。开发用 managed Engine 不是生产 fallback。

Product DB 是 Definition、Binding、Turn、lease、session 元数据、Revision/Release pointer、账务与审计权威；Object Store 保存内容寻址 Project/artifact；Engine 保存 Actor 与 AgentOS Apps 运行状态。Runtime 不直连 Product DB，继续通过 Backend internal API 读写。

## 前置条件

- 已完成目标环境的 Product DB migration，并确认 Backend 可读写 D1/PostgreSQL 和 Object Store。
- 已部署只在目标环境/区域内部可访问、带持久存储与备份的 Rivet Engine；endpoint 的 `/health` 返回 `status=ok`。
- control 与三个 worker deployment 能访问同一区域 Engine，并配置独立 replica/process identity。
- 已准备 Engine token/namespace、Backend internal signing secret 和 Agent provider secret；secret manager 能按 deployment 分发而不是共享整组变量。
- Agent、build、serving 三类 egress policy 已经过安全评审。
- 镜像使用 Node 22–24；当前 `isolated-vm` 不支持 Node 26。

## 配置与信任边界

所有生产进程都必须设置：

```dotenv
NODE_ENV="production"
SPACE_RUNTIME_ENGINE_MODE="external"
RIVET_ENDPOINT="https://rivet-engine.<region>.internal"
SPACE_RUNTIME_REGION="<region>"
SPACE_RUNTIME_REPLICA_ID="<unique-process-id>"
PI_MODE="agentos"

SPACE_AGENT_EXECUTION_POOL_CLASS="agent-execution"
SPACE_APP_BUILD_POOL_CLASS="app-build"
SPACE_RELEASE_SERVING_POOL_CLASS="release-serving"
SPACE_AGENT_DEDICATED_POOL_ALLOWLIST=""
```

三类 pool class 在同一 Engine namespace 内必须不同。endpoint 禁止包含 URL credential、query 或 fragment；token 使用 `RIVET_TOKEN` 单独注入。

`SPACE_AGENT_DEDICATED_POOL_ALLOWLIST` 是 Backend Agent governance 与 control Runtime 共用的治理 allowlist，空值表示只允许区域共享 Agent pool。每个非空项必须对应一个已经独立部署并在 Engine metrics 中 active 的 `agentExecution` worker pool；allowlist 本身不会创建 worker。专属 worker 使用同一 Runtime 镜像和 `SPACE_RUNTIME_POOL_WORKLOAD=agentExecution`，但把 `SPACE_AGENT_EXECUTION_POOL_CLASS` 设置为专属 class，并且不能继承一个包含自身 class 的 `SPACE_AGENT_DEDICATED_POOL_ALLOWLIST`。否则配置会因“专属池与区域默认池折叠”而失败关闭。

例如在区域共享 `agent-execution` 之外启用 `tenant-a-agents`：

```dotenv
# Backend + control Runtime
SPACE_AGENT_EXECUTION_POOL_CLASS="agent-execution"
SPACE_AGENT_DEDICATED_POOL_ALLOWLIST="tenant-a-agents"

# tenant-a 专属 Agent worker deployment
SPACE_RUNTIME_POOL_WORKLOAD="agentExecution"
SPACE_AGENT_EXECUTION_POOL_CLASS="tenant-a-agents"
SPACE_AGENT_DEDICATED_POOL_ALLOWLIST=""
```

只有专属 worker 已达到计划副本数后，Admin 才能创建引用该 class 的不可变 Definition version 并切换 Space binding。删除 allowlist、错误区域或缺失 worker 时，新 Turn 必须在 provider 调用前失败；已经固定到 Turn 的 Definition/session/pool 不会因 Admin 切换被改写。

| 进程 | `SPACE_RUNTIME_POOL_WORKLOAD` | 允许的敏感配置 | 禁止配置 |
| --- | --- | --- | --- |
| control Runtime | 不设置 | Backend internal secret、Engine client token | RivetKit Registry 和所有 Agent provider key |
| Agent worker | `agentExecution` | Engine token、启用的 Agent provider key | Backend DB/R2 管理凭据 |
| Build worker | `appBuild` | Engine token、构建所需的最小 registry/download capability | 所有 Agent provider key、Backend DB/R2 管理凭据 |
| Serving worker | `releaseServing` | Engine token、App scoped serving capability | 所有 Agent provider key、构建发布凭据、Backend DB/R2 管理凭据 |

control 的 Agent session 请求不包含 `env` 或 provider secret；credential 只由 Agent worker 内的 AgentOS session environment resolver 注入，并覆盖任何同名 client 输入。production control 检测到任一 provider key、production Agent worker 缺少全部 provider credential，或 Build/serving worker 检测到任一 provider key 时，都会在 Engine health probe 和 Registry 启动前失败关闭。部署平台仍应从 secret 注入层彻底移除越权变量，不把运行时检查当作 secret 隔离机制。

Pi 与 Claude Code ACP 均注册在 Agent worker Registry 中。Claude Code 使用 AgentOS 锁定的 `claude-code@0.2.7` software，凭据只能从 Agent worker secret scope 注入（`ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_OAUTH_TOKEN` 之一）；Admin Definition/API 不接收、返回或保存这些变量。

生产必须显式配置三类网络策略：

```dotenv
SPACE_AGENT_EGRESS_ALLOWLIST="https://api.provider.example/**"
SPACE_APP_BUILD_EGRESS_ALLOWLIST="https://registry.npmjs.org/**,https://cdn.example/**"
SPACE_RELEASE_EGRESS_ALLOWLIST="deny"
```

值可以是 `deny`、`allow` 或 AgentOS network pattern 的逗号分隔 allowlist。生产通常不应使用 `allow`。资源上限按 workload 独立设置：

```dotenv
SPACE_AGENT_VM_CPU_COUNT="2"
SPACE_AGENT_VM_MAX_PROCESSES="64"
SPACE_AGENT_VM_MAX_OPEN_FDS="2048"
SPACE_AGENT_VM_MAX_FILESYSTEM_BYTES="536870912"

SPACE_APP_BUILD_VM_CPU_COUNT="2"
SPACE_APP_BUILD_VM_MAX_PROCESSES="64"
SPACE_APP_BUILD_VM_MAX_OPEN_FDS="2048"
SPACE_APP_BUILD_VM_MAX_FILESYSTEM_BYTES="1073741824"

SPACE_RELEASE_VM_CPU_COUNT="1"
SPACE_RELEASE_VM_MAX_PROCESSES="32"
SPACE_RELEASE_VM_MAX_OPEN_FDS="1024"
SPACE_RELEASE_VM_MAX_FILESYSTEM_BYTES="268435456"
```

## 首次部署与启动顺序

1. 备份 Product DB、Object Store pointer 清单和 Engine 持久状态，记录当前镜像 digest、Engine 版本、schema/migration 版本与 pool 副本数。
2. 应用 Product DB migration，启动 Backend，验证 internal callback/control API 和 Object Store。
3. 启动外部 Engine，等待 `/health` 返回成功，再检查持久存储和 metrics endpoint。
4. 分别启动三个区域共享 worker deployment，每个 deployment 使用相同镜像但不同 `SPACE_RUNTIME_POOL_WORKLOAD`：

   ```bash
   pnpm --filter @vibechat/space-runtime start:pool-worker
   ```

   日志必须分别出现 `agentExecution ready`、`appBuild ready` 和 `releaseServing ready`，且 pool name 与配置一致。
5. 如有专属 Agent pool，逐个启动独立 `agentExecution` worker deployment，确认其 `envoy_connection_active{pool_name="<dedicated-class>"}` 达到最低副本数后，才把 class 加到 Backend/control allowlist 并创建 Definition version。
6. 确认 Engine metrics 中三类区域共享 pool 和全部已批准专属 Agent pool 均达到计划副本数后，再启动至少两个 control Runtime replica：

   ```bash
   pnpm --filter @vibechat/space-runtime start
   ```

7. 验证 control `/api/health`：Engine healthy，`engineOwnership=external`，region/replica identity 正确，三类 pool 不折叠，`poolRoutingEnforced=true`；再检查 control 环境和一次 `openSession` payload 均不含 provider secret。
8. 在 Admin Agent Governance 中只创建高于现有版本的不可变 Definition，验证 freeze/unfreeze、binding/default switch 和 bounded audit；响应中不得出现 provider credential、prompt 或 Project/source。
9. 依次使用区域共享 Pi/Claude Code 与一个专属 pool 执行 Conversation/Revision，再执行显式 Publish 和固定 Release 请求。核对旧 Turn 保持原 Definition/session/pool，切换后的新 Turn 使用新 snapshot，credits、Matrix event、ready/published pointer 和 outbox 均只产生一次。

## 验证与监控

Engine metrics 至少监控：

```text
envoy_connection_active{pool_name="agent-execution"}
envoy_connection_active{pool_name="app-build"}
envoy_connection_active{pool_name="release-serving"}
envoy_connection_active{pool_name="<dedicated-agent-pool>"}
```

告警条件包括：任一区域共享或已批准专属 pool active connection 低于最低副本数、Engine health 失败、Registry 反复重连、Turn lease 过期/接管激增、fenced write、session rebuild、Candidate failure、Release 启动失败、outbox backlog 或 credits reconcile error。指标和日志必须带 region、Runtime replica、workload/pool、Space/Turn 的有界标识，不记录 prompt、源码、provider token 或用户正文。

仓库提供 opt-in 的真实 Engine pool 测试。先在隔离端口启动 disposable Engine，再运行：

```bash
SPACE_RUNTIME_POOL_TEST_ENGINE_ENDPOINT="http://127.0.0.1:<guard-port>" \
SPACE_RUNTIME_POOL_TEST_METRICS_ENDPOINT="http://127.0.0.1:<metrics-port>/metrics" \
pnpm vitest run tests/integration/space-runtime-agentos-pools.integration.test.ts
```

该测试为每类 pool 启动两个独立 worker，并停止一个 build worker，验证 Agent/serving active connection 不受影响。它证明真实 Engine 的进程/pool 注册行为，不代替 D1/R2、Synapse 或跨宿主生产演练。

## 升级与灰度

1. 先确认目标 Engine 与仓库锁定的 RivetKit/AgentOS client 版本兼容；Engine 升级与应用镜像升级分开执行。
2. 先在非生产或隔离 namespace 运行上述 pool integration test和一轮 Conversation/Revision/Publish/Release。
3. 生产先灰度一个 serving worker，再灰度 build worker，最后灰度 Agent worker；每一步确认 active connection、错误率和 Actor 恢复后再继续。
4. worker 稳定后逐个替换 control Runtime，始终保留至少一个旧 control replica 和每类至少一个健康 worker。
5. Engine 需要升级时，先完成持久状态备份并按 Engine provider 的兼容步骤滚动；不可在没有恢复演练时原地覆盖唯一状态副本。

Candidate 失败不得移动 ready/published pointer。升级过程中发现 session generation、artifact integrity、Release pointer 或 outbox 异常时停止灰度，不通过手工改 Product DB pointer 强行继续。

## 回滚

1. 停止继续灰度并恢复上一镜像 digest；按 serving → build → Agent → control 的顺序回滚，保持各 pool 最低容量。
2. 如果只是 worker 版本失败，不回滚 Product DB migration、Release pointer 或 Engine 数据。
3. 只有 migration 明确提供向下兼容和回滚脚本时才回滚 schema；否则保持 Backend 兼容层并回滚应用。
4. Engine 版本失败时按 provider 的备份恢复流程恢复同一区域 Engine，随后先启动三类 worker，再恢复 control 流量。
5. 回滚后重新执行 health、pool metrics、Conversation、Candidate、Publish、Release 和 outbox/credits 对账。

不要删除 Engine 文件目录、Object Store artifact 或 Product DB Turn/session 行作为常规回滚。pointer 和账务修复必须经现有幂等 service/API 完成并留下审计。

## 容量与备份恢复

- control replica 按 Turn claim/Backend callback 负载扩容；Agent pool 按并发 Turn 和 provider latency；build pool 按 Candidate queue 与 CPU/磁盘；serving pool 按 Live request、冷启动和内存扩容。三类副本数独立调整。
- Engine 持久状态、Product DB 和 Object Store 使用同一环境/区域和可关联的备份时间点。至少季度执行恢复演练，并保留恢复点、RPO/RTO 和校验结果。
- Product DB 恢复后，以其 Definition/Binding/session/pointer/lease 为权威；Engine Actor 不得反向覆盖较新的 fencing token 或 pointer。
- Object Store 恢复后重新校验 content hash。artifact 缺失或 hash 不匹配时将 Candidate/Release 标为不可恢复并重新构建，不伪造成功 pointer。
- 本地 filesystem Engine DB 只用于开发和 disposable integration test，不是生产持久化或备份证据。

## 故障处理

### Engine 不健康或 worker 无法注册

停止 control 流量进入新 Turn，检查 Engine health、内部 DNS/TLS、token/namespace 和版本兼容。不要把 `SPACE_RUNTIME_ENGINE_MODE` 改为 `managed`；生产配置会拒绝该 fallback。恢复 Engine 后先观察三类 active connection，再恢复 control。

专属 Agent pool 缺失时先冻结引用它的 Definition 或切换后续 Space binding，再恢复/扩容对应的独立 `agentExecution` worker。不要把专属 class 临时改成区域共享 class，也不要改写已入队 Turn 的 Definition snapshot；失败 Turn 继续走现有幂等退款和审计链路。

### 旧 owner 写入或重复副作用

保留旧 owner 日志和 fencing token。Product DB 应拒绝旧 lease owner 的 completion/session/audit/pointer 写入；不要手工放宽 fencing。运行 outbox reconcile，按 Turn ID、credits transaction code、Matrix event ID 和 state key 检查下游幂等结果。

### Agent session restore/rebuild

restore 失败时只允许 active Turn owner 通过 Backend internal API 创建新 generation。旧 generation 的后续写入必须被拒绝。审计只保存 bounded summary/ref/hash，不保存 provider-native event 或消息正文。

### Candidate、artifact 或 Release 故障

Candidate/build 失败保持最后 ready Revision 和 Published Release。Object Store artifact 必须通过 source/content hash 校验；缺失时重新构建 Candidate。Release serving worker 恢复后从不可变 Release 启动新 replica，不删除 Release/App actor 数据来绕过恢复。

### Outbox 或账务积压

保持 reconciler 运行，按既有幂等 key 重放 Matrix reply、credits settlement/refund 和 Product State projection。HTTP 202 只表示 control plane 已接受；在 outbox ACK、账务记录和 Matrix/Product State 都对齐前不得宣布恢复完成。

## 完成条件

- 外部 Engine、两个以上 control replica 和三类独立 worker deployment 均已启动。
- 所有进入 allowlist 的专属 Agent pool 都有独立 worker deployment、最低副本 metrics 和缺失 worker 告警。
- 三类 pool metrics 与计划副本数一致，停止单个 worker 不影响其他 pool。
- secret、egress 和 quota 按 workload 隔离，build/serving 不含 Agent provider key。
- Pi 与 Claude Code lifecycle、Admin Definition/binding/freeze/audit、区域/专属 pool fail-closed 均在目标环境核验。
- Conversation、Revision、Publish、Release、fencing/session、artifact 和 outbox/credits 演练完成且无重复副作用。
- 备份恢复、灰度和回滚记录已保存；未完成的云环境或跨宿主演练明确列为未覆盖项。
