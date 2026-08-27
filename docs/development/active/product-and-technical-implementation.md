# VibeChat MVP 产品与技术设计 Active 实施跟踪

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-27
> 维护范围：VibeChat MVP 产品与技术设计的实施、验收与决策闭环
> 稳定来源：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)
> Agent 稳定来源：[Agent 架构与 AgentOS 部署设计](../../stable/designs/agent-architecture-and-agentos-deployment.md)
> Agent 实施结构：[Agent 架构实施结构计划](./agent-architecture-implementation-plan.md)
> 当前变更：[Space App 设计演进与实施记录](./space-app-design-transition.md)

## 1. 文档职责

稳定设计定义目标状态和长期约束；本文件记录从当前仓库到目标状态的实际进展。设计完成与功能实现是两件事，任何 Complete 都必须附代码、测试和运行证据。

2026-08-22 设计确认：产品实体为 Space；每个 Space 保留完整 Chat、市场模板与收藏，并增加独立 App Project 和可插拔 Agent。现有代码已经实现 Chat 与官方 Space 目录，并已落地 Kernel/Chat/App、通用 Agent Adapter、Draft/Release 的首版纵向切片；空白 Space 后选模板、生产存储与完整 E2E 仍未完成。

## 2. 当前结论

> **产品实现状态：A1、A2 已完成；Space App 新设计已生效，A3、A4 首版切片 Active。**

已经形成的实现证据：

- Better Auth Email OTP、产品 profile、Matrix identity/session binding、session revoke 和 Synapse Appservice adapter 已实现。
- Matrix Room/timeline、IndexedDB sync、local echo、消息关系、媒体、编辑、删除、typing、搜索和离线幂等重发已通过真实 Synapse/Chromium。
- 好友请求、联系人、备注、屏蔽、participant ACL、Matrix 邀请和多浏览器 session 已通过真实链路。
- `/discover`、官方 Space 目录、分类、收藏、版本和模板建 Space 是活动产品行为。
- 十个 workspace package 边界，以及 Web/Backend/Site/Admin/Workers/Docs 的构建与 E2E 基线已经形成。

首版新增证据：

- `room_index` 已原地增加 `spaceInstanceId/projectId/defaultAgentId`，历史与新房间继续使用同一记录、repository 和 Matrix Room。
- `apps/space-runtime`、Space contracts/SDK、Backend membership gateway 与 Web Kernel/Chat/App 已接通。
- 真实 Synapse/Chromium 已覆盖成员被 kick 与主动 leave 两种撤权；即使 `room_index.participant_user_ids_json` 仍保留旧成员，八类 Backend→Runtime Gateway 也全部返回 `SPACE_INSTANCE_NOT_FOUND`，且没有新增 Turn、Outbox 或 credits 交易，未被移除的 owner 仍可读取 snapshot 与 Dev App。
- Host Pi 已真实生成可交互 App；Dev draft 与不可变 publish/live 均返回 HTTP 200。
- Default Chat App 已把结构化 Agent Mention 写入 Matrix event content；Backend 按精确事件核验后预留积分并入队，Host Pi 真实回复和 token usage 结算已通过本地 Synapse 浏览器走查。
- 新账号默认获得 1000 个幂等欢迎积分，可直接发起 Agent 对话；配置可调整或关闭。
- 4 个定向测试文件、10 个单元测试，以及新增 package/app 的定向 TypeScript 和 Backend Node 构建通过。

当前 A4 实现切片（2026-08-26）：

后续 A4 结构、依赖、数据迁移和阶段门禁统一按[Agent 架构实施结构计划](./agent-architecture-implementation-plan.md)推进；未映射到该计划的 Agent 能力不得直接落代码。

- [x] 增加 Agent execution runtime 与 App execution runtime 边界，分别封装 Agent session VM、App Dev VM 和不可变 Release 部署；保持 Pi actor key、Revision 隔离和 Release scaling 不变，其他 Adapter 的执行 key 按 `Space × Agent` 稳定隔离。
- [x] 将平台调度配置迁移为 `SPACE_AGENT_MAX_CONCURRENCY` 与 `SPACE_TURN_BATCH_WINDOW_MS`，旧 `PI_MAX_CONCURRENCY` / `PI_BATCH_WINDOW_MS` 保留一个兼容周期的 fallback；Runtime health 同时返回生效值与来源。
- [x] 用可注入 fake runtime 和纯配置解析测试覆盖 AgentOS Turn、Dev VM、Release delegation、新旧配置优先级、默认值与 clamp；本切片没有新增 Agent Registry 数据表、第二 Adapter 或用户可见行为。
- [x] S1 第一切片已把 batch window、跨 Space 并发和单 Space 串行调度抽为可注入 `SpaceTurnScheduler`，并增加 AgentOS import/invocation 与 Runtime 产品域依赖边界门禁；没有修改 queue、schema、credits、Adapter 协议或部署拓扑。
- [x] S1 第二切片已把 claim 后的 Agent/Publish/Restore 分发、失败处理和 billing/completion finally 抽为可注入 `ClaimedTurnExecutor`；三个具体 processor 和 callback 实现保持原样，没有修改 Turn 状态、账务或错误码。
- [x] S1 processor 已全部拆出：Agent Conversation/Revision、Candidate、自动修复、usage、heartbeat 和 ready Revision 由 `AgentTurnProcessor` 负责；fixed-ready Publish 屏障、Preview 复核、Release 与 published pointer 由 `PublishTurnProcessor` 负责；Default Chat Restore 的 expected-ready 屏障、Template Candidate、Release 保留与失败保护由 `RestoreTurnProcessor` 负责。
- [x] `DevPreviewManager`、Release scaling policy 与不可变部署已归入 `release-manager/`；App/Agent execution contract 不再暴露 AgentOS VM/deployment 类型，AgentOS client、Apps router、错误映射和 actor registry 只存在于 concrete provider/infrastructure 目录。
- [x] Adapter contract/registry、Pi/fake 实现已拆分；Pi 的 provider config、prompt、session、Project workspace、Host runner 与 AgentOS runner 有独立 owner，`generator.ts` 只保留兼容 re-export。Runtime 核心输入统一使用 `spaceInstanceId`，没有改 Adapter 事件协议或引入 S2 数据模型。
- [x] `composition/` 已接管配置、依赖组装和 Runtime 启动，`transport/http/` 已接管 health、instance、project、turn 和 App proxy routes；`server.ts` 只创建 Runtime/Hono app 并监听端口。新增 HTTP composition 测试覆盖内部鉴权、Agent message dispatch 与 Template bootstrap。
- [x] `boundaries:check` 已从过渡白名单收紧为目录规则：阻止 concrete 目录外的 AgentOS/Pi import、`deployApp()`/`vm.getOrCreate()` 越界、Adapter 依赖 Backend/credits/Matrix/DB，以及新 Runtime core `appId` 参数。
- [x] Node 24.19.0 下 Space Runtime 22 个测试文件、73 个测试通过，Space Runtime typecheck/build、应用边界检查、文档检查与 docs app 直接生产构建通过；最终 GitNexus、根门禁和 E2E 环境边界记录见 Agent 实施结构计划的 S1 完成证据。
- [x] S2 已完成：`@vibechat/space-agent-contracts` 已让 Agent identity、Definition/Binding/Session/Turn snapshot、版本化 usage/error/event 和内部 callback 脱离 Pi/AgentOS，旧 `space-app-contracts` 保留兼容 re-export；`libs/space-agents`、PG/SQLite-D1 对称领域表、Pi bootstrap/binding 回填和现有 Turn nullable 固定字段已落地。Wrangler 本地 D1 `0000 → 0014`、PostgreSQL 17 单独 `0014` 与恢复 journal 后的完整 `0000 → 0014` migration 均已验证，D1/PG repository contract 各 1/1 通过。S3 invoke/enqueue 固定 snapshot 仍未开始。
- [x] S3 已完成：Backend invoke 已提取为可测试 application service，Definition/Binding/session policy 成为调用权威；新建 Space 幂等写默认 Pi binding，现有 Turn 固定 Definition/Adapter/session/policy/Project/reservation snapshot，Runtime snapshot 与 Matrix v2 state 输出公开 Agent view，callback 优先按固定字段 fencing。默认仍只开放 Pi；真实 Synapse + Pi/provider 双 Chromium E2E 2/2 通过，完整 Adapter cancel/restore 和生产 Engine 继续属于 S4/S5。
- [x] S4 已完成：生产 Adapter Registry/Turn processor 已切到 provider-neutral `beginSession/runTurn/summarize/cancel/restore` 和 strict `AgentEventV1`；Pi 与 Fake 通过相同 lifecycle suite。Product DB session summary/ref/hash、restore/rebuild、bounded audit 与 cancel control 均经 Backend internal API 持久化并受 active Turn、lease/fencing 保护；成员取消入口、Adapter Abort/cancel、usage 缺失失败退款和 Candidate repair 失败保护已接入唯一收口。定向单测 133/133、Agent collaboration E2E 3/3 和 Workers/D1 health 200 通过。
- [x] S5 仓库实现完成：生产 control 只预检区域级 external Engine；Agent/build/serving 是三个独立 OS worker/Envoy pool，接入各自 credential scope、egress、quota 和 metrics。control 的 session 请求不携带 provider secret，只有 Agent worker resolver 注入 credential；production control 带 key、Agent worker 缺 key 或 build/serving 带 key 均失败关闭。双 Node replica harness 已覆盖 lease/fencing/session/Release/Outbox，真实 disposable Engine 上三类 pool 各两个 replica 同时 active，停止一个 build worker 后保持 `2/1/2`。Runtime unit 107/107、pool integration 1/1、replica failover integration 1/1 通过。生产 Runbook 已完成；真实 Cloudflare D1/R2 + Synapse + external Engine 跨宿主和备份恢复仍是目标环境验收项，不能由本地 filesystem Engine 代替。

尚未完成：

- 空白 Space 创建，以及空白/已有 Space 后续应用模板。
- 真实 Cloudflare D1/R2 migration/preview，以及两个独立 Runtime 进程的 Synapse/AgentOS/R2 接管演练。
- member Mention、分页、历史 rollback 和其余 #40 浏览器验收。
- 用户 Template 发布、审核与撤销。
- 第二真实 Adapter；Pi/Fake 完整 lifecycle、session/audit/cancel 持久化和 usage 缺失退款已在 S4 完成。
- 真实目标环境的区域级 external AgentOS/Rivet Engine、D1/R2、Synapse 跨宿主接管与备份恢复验收；仓库中的独立 worker pool、credential、quota 和生产 Runbook 已完成。

## 3. 状态定义

| 状态 | 含义 | 证据要求 |
| --- | --- | --- |
| 未开始 | 已有设计/计划，但没有可执行实现切片 | 可有设计与 TEST-CATALOG，不可声称交付 |
| Active | 已有验收场景并正在实现 | 变更集、代码入口和定向验证 |
| Blocked | 有明确外部决策或依赖阻塞 | 阻塞原因、解除条件和 owner |
| Complete | 稳定设计中的该范围已实现 | 代码、自动化、浏览器/运行和文档闭环 |

## 4. 工作流与设计追踪

| ID | 工作流 | 稳定设计 | 当前状态 | 当前证据 | 下一出口 |
| --- | --- | --- | --- | --- | --- |
| A0 | 兼容护栏与语义校正 | §1、§2、§9.4、§14 阶段 0 | Active | [Space App 演进记录](./space-app-design-transition.md)、TEST-CATALOG #40 | 市场/Chat 保留，形成 v1/v2 双读和空白创建 spec |
| A1 | 产品壳与信息架构 | §4 | Complete（现有 IA） | `apps/web-app/src/features/chat` 与真实路由/E2E | 保留 Discover；新增 Kernel/Chat/App 与 Space 用户语义 |
| A2 | 身份、社交、Chat 与市场底座 | §3.1、§5.1、§9 | Complete | identity/social/rooms/timeline/product-state 测试与真实 Synapse/Chromium | 保持全回归，不用本地 demo 替代 Matrix/市场 |
| A3 | Space Kernel、Project 与 Space SDK | §5–§9、§14 阶段 1–2 | Active | contracts/SDK、`room_index` migration、Runtime、Backend gateway、真实 kick/leave 全 gateway E2E | 空白/后选模板、D1/R2 preview、双进程接管与其余双浏览器 App |
| A4 | Agent Adapter、Space Dev 与发布 | MVP §6、§7、§10、§14；[Agent/AgentOS 设计](../../stable/designs/agent-architecture-and-agentos-deployment.md) | Active | Product DB Definition/Binding/session/audit、完整 Pi/fake lifecycle、结构化 Matrix Mention、virtual-user Matrix 回写、queue、cancel、credits settlement/refund、Candidate 隔离与 Dev/Release smoke | 区域共享外部 Engine、独立 pool、真实双进程恢复、第二真实 Adapter、历史 rollback 与完整 E2E |
| A5 | 生产恢复与市场演进 | §11–§14 阶段 5 | 未开始 | 当前通用 Auth/Matrix/市场/账务/部署能力 | 治理、压测、安全、备份恢复和第三方市场独立评审 |

## 5. A0 当前任务：兼容护栏

### 任务

- [x] 基于 demo 重写稳定产品与技术设计。
- [x] 根据产品校正恢复 Space 市场、模板创建和 Chat-first 基线。
- [x] 将边界收敛为 Kernel、Chat、App，并把 Agent 契约改为 provider-neutral。
- [x] 确定 Space Runtime 采用与 `chat-app-server` 同构的技术方案，并确定现有房间/多人 Space 使用统一 SpaceInstance。
- [x] 更新 TEST-CATALOG #40 为 Space App 计划验收。
- [x] `room_index` 原地升级稳定 `spaceInstanceId/projectId/defaultAgentId`，并保留 Template lineage；v2 Matrix state 和回滚工具仍待后续。
- [ ] 设计 `/v1/rooms` 空白/模板兼容创建与后续 `apply-template` 契约。
- [x] 完成 `apps/space-runtime` 独立部署单元、内部 token、Backend membership gateway 和 Agent/Runtime provider 首版边界。
- [x] Space App contracts/package、Host bridge 与 Runtime 切片进入 A3 Active。

### 完成条件

- 现有 Chat、市场和模板创建有明确的禁止回归门槛。
- 历史私聊、群聊和新增多人 Space 不产生平行实例、成员或消息模型。
- 新旧字段、API、Matrix state、UI 和 E2E 的兼容顺序没有空白 owner。
- A3 第一切片拥有 package/schema/migration spec 和可执行测试。
- 文档检查、文档站构建和适用代码门禁通过。

## 6. A2 保留基线

A2 的完成结论不因 Space App 增量设计而撤销：

1. Better Auth user/session 是认证权威；Matrix identity/device lifecycle 已形成幂等映射与撤销。
2. Matrix 继续是 Space membership、邀请、Chat timeline、媒体和关系事件权威。
3. 产品 profile、好友、备注、屏蔽和 ACL 继续由 Product DB 管理。
4. Discover、官方 Space 目录、收藏、模板版本和模板建 Space 继续是活动产品能力。
5. Browser 不保存 token 或权威 fixture；服务不可用时失败关闭。
6. Space App 必须接在这些真实边界上，不能复制 demo 的 guest identity、本地 JSON 或未认证 bridge。

[真实 Matrix 房间与 Timeline](./matrix-room-timeline.md) 与 [登录后产品状态真实化](./real-product-state-cutover.md)继续记录当前实现事实；新增能力以增量方式连接，不删除其完成证据。

## 7. 已确定与待验证

### 已确定

- 用户语义为 Space；Matrix Room 只在技术/兼容说明中使用。
- 现有 `room_index` 记录原地升级为唯一 SpaceInstance；一对一和多人共用同一 Repository、Instance Server、Project、SDK 和 queue。
- Space 市场、分类、详情、收藏、版本和模板创建保持不变。
- 空白 Space 可以创建，之后仍可选择模板。
- 每个 Space 保留完整 Chat，App/Agent 故障不影响人类沟通。
- Kernel、Chat、App 是仅有的三个边界；发布、历史和生成状态属于 Kernel。
- Agent Adapter 可插拔，Pi 只是第一候选示例。
- AgentOS 默认按环境/区域共享部署；Space、`Space × Agent` session、Revision 和 Release 是逻辑隔离单位，不为每个 Space 部署一套 AgentOS，也不使用全球唯一 AgentOS。
- 普通 Chat 不自动调用 Agent；显式 Agent 请求才进入 ACL/credits/queue。
- 同 Space App 写入串行，修改先成为 Draft，显式发布不可变 Release。
- Runtime 从 Cloudflare Backend 分离为独立 Node 部署单元。
- Space Runtime 的对象与执行链采用 demo 同构方案：Hono、SpaceInstanceServer、SSE/command、Turn scheduler、ProjectStore、agentOS Apps Dev/Release 和 Space SDK。

### 后续仍需验证

| 项目 | 当前约束 | 最晚出口 |
| --- | --- | --- |
| Agent Adapter 最小合约 | 已由 Pi 与 fake 共享事件、usage、取消和恢复；第二真实 Adapter 仍需通过同一 suite | A4 第二 Adapter |
| Agent Registry 与 session | Definition/Binding/session ref/summary/audit 已进入 Product DB；继续验证跨副本 restore/rebuild | A4/S5 恢复演练 |
| agentOS Apps 版本兼容 | 技术路线已经确定；先复现 demo `0.2.15` 基线，再由仓库 lockfile 固定兼容版本 | A3 Runtime spike |
| AgentOS 生产部署 | external control、三类独立 worker pool、credential/egress/quota、双 Node 接管 harness 与 Runbook 已落地；仍需真实 D1/R2 + Synapse 跨宿主和备份恢复验收，不按 Space 复制集群 | A4/S5 目标环境演练 |
| Runtime 内部认证与网络 | 不复用 Cookie/secret；短期 audience token | A3 contract 评审 |
| Instance Server 多副本所有权 | 同一 `spaceInstanceId` 只允许一个 lease owner 执行写 Turn，SSE 可接管 | A3 Runtime spike |
| `room_index` 原地升级 | 不新建平行实例表；PG/SQLite/D1 回填、唯一约束和回滚均需验证 | A3 schema migration |
| 普通 Chat 与 Agent 寻址 | 人类消息默认不入付费队列 | A3 queue 实现前 |
| 积分批次分摊 | 逐请求 reservation 与稳定 usage 分摊 | A4 计费实现前 |
| 模板应用策略 | 空白/已有 Project 都保留 Chat、Live 和恢复点 | A3 Project 实现前 |
| Runtime 故障恢复 | Project/Draft/Live/任务不能只存在 provider 内 | A4 发布前 |
| 第三方模板市场 | 提交、审核、签名和分成独立评审 | A5 市场演进前 |

## 8. 进度更新规则

- 只记录实际代码、测试和运行结果，不用文档或外部 demo 代替实现证据。
- 进入 Active 时附具体切片与验证；进入 Complete 时附全链路、失败路径和文档闭环。
- 每次 A3/A4 变更检查 Matrix、Chat、市场、权限、积分、Agent、Runtime、SDK、Kernel 和 E2E 影响。
- 完成阶段后更新[当前开发重点](../current-focus.md)，并按生命周期规范归档真正被替代的记录。
