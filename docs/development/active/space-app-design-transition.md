# Space App 设计演进与实施记录

> 生命周期：开发中
> 文档类型：实施记录
> 状态：Active
> 更新日期：2026-08-23
> 维护范围：Space 语义、市场与模板、Kernel/Chat/App、Agent Adapter、Runtime、数据/API/UI/E2E 演进
> 对应稳定设计：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 1. 目的与事实边界

本文记录 2026-08-22 基于外部 demo 的 Space App 设计演进、产品校正、首版实现事实、剩余差距、实施顺序和完成条件。

稳定设计定义目标状态；本文描述实施事实。外部 demo 本身不构成本仓库证据；本仓库现已按相同对象边界和执行链完成首版纵向切片，并接入 Better Auth、Matrix membership、积分预留和通用 Agent 契约。生产持久化、多副本接管、usage 结算和 Matrix Agent 回写仍是后续门槛。

本次产品校正确认：

- 用户语义必须是 Space，不能把底层 Matrix Room 提升为产品名称。
- Space 市场继续存在；空白或模板创建都被支持。
- 每个 Space 的完整 Chat 是基础能力，App/Agent 只做增量增强。
- 产品边界只有 Kernel、Chat、App。
- Agent provider 可插拔，Pi 只是 demo 的示例选择。
- 现有聊天房间与多人 Space 必须统一为同一个 SpaceInstance，不能维护两套实例、成员或消息状态。

## 2. demo 核验范围

核验来源：`~/Work/projs/chat-app-server`。

| demo 文件 | 已核验事实 |
| --- | --- |
| `src/room-server.ts` | 消息、成员、持久 App State、presence、瞬时事件、同实例队列和重启恢复 |
| `src/server.ts` | 消息/发布入口、短批次、同实例串行、跨实例有限并行、Agent turn、Dev、发布屏障 |
| `src/generator.ts` | Pi session、Conversation/Revision、受限文件工具和进度 |
| `src/dev-preview.ts` | 隔离预览准备、source 同步、就绪/错误和释放 |
| `src/project-store.ts` | Project、Revision、Draft/Live 指针和持久恢复 |
| `public/room-app-sdk.js` | members/messages/presence/state/event/chat/agent/theme 的受控 SDK |
| `public/app.js` | iframe source 校验、命令 allowlist、身份注入和 Draft/Live 切换 |
| `public/index.html` | App 画布、固定聊天和宿主生成状态入口 |

实际调用链证明：

- 消息先持久化/广播，再进入 Agent 处理，生成不阻塞聊天。
- 普通回复与源码修改可以分类；只有源码变化进入 Dev。
- Candidate source 经 Dev 验证后才成为 Draft。
- Publish 是队列屏障，成功后切换不可变 Release。
- SDK 写命令可以收敛为 chat、presence、state、event 等 allowlist。
- Project、App State 和中断请求可以恢复。

### 2.1 正式采用的技术映射

| demo 实现 | 本仓库正式实现 | 状态 |
| --- | --- | --- |
| Node 22 + TypeScript ESM + Hono | `apps/space-runtime` 使用同一服务技术栈 | 首版已实现 |
| `LocalRoomServer` | `SpaceInstanceServer` | 首版本地持久化已实现 |
| 进程内 `rooms` Map | `SpaceInstanceRegistry` + DB lease | Registry 已实现；DB lease 待实现 |
| SSE events + HTTP commands | Kernel Runtime transport | 首版已实现 |
| `scheduleRoom/drainTurnQueue` | `SpaceTurnScheduler` | 首版已实现 |
| `processTurn/publishCurrentProject` | `SpaceTurnProcessor/SpaceReleaseManager` | 首版已实现 |
| `project-store.ts` | `SpaceProjectStore`，后续迁移 Product DB + Object Store | 本地恢复已实现；生产存储待实现 |
| `DevPreviewManager` | agentOS Apps `SpaceDevPreviewManager` | 首版已实现 |
| `deployApp/appsRouter` | agentOS Apps immutable Release | 首版已实现 |
| `room-app-sdk.js` | `@vibechat/space-app-sdk` | 首版已实现 |
| Pi generator | `PiAgentAdapter` | 首版已实现；公共契约保持通用 |

所谓“同一技术方案”是上述组件、状态机和调用顺序同构，不是复制 demo 的 Guest 身份、本地 JSON、单进程唯一性或 Pi 专属命名。

demo 在提交 `381c466` 核验的依赖基线为 Node `>=22 <26`、Hono `^4.12.9`、`@hono/node-server ^2.0.11`、`@rivet-dev/agentos ^0.2.15`、`@rivet-dev/agentos-apps ^0.2.15` 与 `@agentos-software/pi ^0.2.7`。实现 spike 必须先用当前 lockfile 兼容版本复现 demo 的 Dev/Release/恢复链路，再决定仓库固定版本；其中 Pi 依赖只能进入 `PiAgentAdapter`，不能成为 Space Runtime 核心依赖。

## 3. 采纳、不采纳与产品修正

### 3.1 采纳的行为语义

- Chat 先于 Agent 完成并保持独立可用。
- Agent 定制默认生成 Draft，显式发布后才切换 Live。
- 同一 Space App 单写、相邻请求短批次、Publish 为顺序屏障。
- Dev 与 Live 隔离；失败不能覆盖最后 ready Draft 或 Live。
- members、messages、presence、state、event、chat、agent、theme 构成最小 Space SDK。
- App 无法访问源码、Agent 工具、构建、发布和凭据。
- Project、App State、队列、请求和账务必须可恢复。

### 3.2 不直接复制的 demo 实现

| demo 选择 | 正式实现要求 |
| --- | --- |
| Guest/query 参数身份 | Better Auth + Matrix membership + Space ACL |
| 本地 JSON 权威 | Product DB、对象存储、durable queue/outbox/lease |
| 同进程 HTTP/SSE/Runtime | 保留 Hono + SSE/command 形态，但 Backend 与独立 `apps/space-runtime` 以短期签名任务/session 分离 |
| 固定 Pi session | provider-neutral Agent Registry/Adapter；Pi 只是一个 Adapter |
| 本机凭据和工作目录 | Space/Agent 隔离 session、无宿主访问、无凭据注入、审计 |
| macOS provider patch | provider-neutral 契约和正式 provider 修复 |
| App ID 等同 URL | Space Instance、Matrix Room、Project、Revision、Release ID 分离 |
| demo 的 Room/Studio 用户语义 | 产品统一 Space；边界统一 Kernel/Chat/App |

### 3.3 对上一版迁移结论的撤销

以下上一版记录作废：

- 删除 `/v1/spaces`、Discover、收藏、分类或市场。
- 新建流程不再允许选择模板。
- 把 `spaceId/spaceVersionId` 视为必须清除的旧字段。
- 把产品实体改名为 Room App。
- 把 Pi 写入公共表名、API、错误码和 UI。
- 将 Studio 定义为独立的第四边界。

这些内容不得继续作为实施任务或删除条件。

## 4. 当前实现事实与目标差距

| 范围 | 当前实现事实 | 新目标 |
| --- | --- | --- |
| 产品语义 | UI/代码同时存在 Space 与 Room 词汇 | UI/公开文档统一 Space；Matrix Room 只保留技术语境 |
| Chat | A2 真实 Matrix timeline 和完整消息操作已完成 | 保持全绿，且不依赖 App/Agent |
| 创建 | `/v1/rooms` 要求内置 `spaceId` | 兼容现有模板创建，并增加空白创建 |
| 市场 | 内置目录、分类、详情、收藏、版本 | 保留并明确为 Space Template 市场 |
| Space state | `room_index` 已原地增加稳定 instance/project/default-agent ID；Matrix 仍为 v1 | 增加 v2 Project/Release/Agent state 双读与修复 |
| App | Web 已增加 Kernel/Chat/App、隔离 iframe 和 Dev/Live 切换 | 补齐双浏览器和故障回归证据 |
| Runtime | Node/Hono Runtime 已实现本地 Project、queue、SSE、Dev/Release | 迁移生产 DB/Object Store 和多副本 lease |
| SDK | contracts、SDK、Host client 和 Backend bridge 已实现 | 补齐 capability/version 演进和更完整冲突测试 |
| Agent | 通用 `agentId`/Adapter/queue 已实现，默认 Pi | 增加 fake/第二 Adapter、取消、真实 usage 与 Matrix 回写 |
| 版本 | Runtime 已支持 Revision/Draft/immutable Release | 将 lineage 迁移到产品数据库和对象存储 |
| 治理 | Admin 无 App/Agent 模块 | 新增 Template/Agent/Release 审核、冻结、撤销和审计 |

A2 Matrix Chat、社交、profile、session、product state、Space 市场和 package 边界都是必须保留的实现事实。设计演进不授权删除这些已验证能力，也不能用 demo 的本地消息服务替换 Matrix。

### 4.1 统一 SpaceInstance 决策

当前 `libs/rooms` 与 `room_index` 已经为每个真实 Matrix Room 保存一条实例记录。它不是需要迁移到另一套“多人 Space 实例”的旧对象，而是统一 SpaceInstance 的现有物理基础。

唯一映射：

```text
room_index row == SpaceInstance == Matrix Room == logical SpaceInstanceServer
                                      └── one App Project
```

- 历史一对一会话、历史群聊、新空白 Space、新模板 Space 和多人 Space 全部使用同一模型。
- 参与人数不能决定 service、表、Runtime 或 SDK 分支；多人只是同一个 Matrix Room/Instance Server 中有更多 member/connection。
- 现有 `matrix_room_id` 继续唯一；新增 `space_instance_id` 作为 Runtime/Project/App State 稳定分区键。
- `space_id/space_version_id` 改为明确的 Template lineage 语义，空白实例允许为空。
- `participant_user_ids_json` 是兼容 ACL 投影，不取代 Matrix membership。
- 正式实现不新建平行 `space_instances` 表；`room_index` 原地扩列，领域类型改为 `SpaceInstance*`。
- 旧 `/v1/rooms` transport 与未来 Space API 都调用同一个 `SpaceInstanceService`。
- Chat 只保存于 Matrix；Instance Server 的 message snapshot 是授权投影/Agent 上下文，不是第二条 timeline。

## 5. 实施顺序

### 5.0 2026-08-22 首版实施切片（Active）

本轮开始落地一条可运行的纵向链路，不把后续生产加固冒充为已经完成：

1. `room_index` 原地补充稳定 `spaceInstanceId` 和默认 `agentId`，历史私聊、群聊与新 Space 继续共用同一记录和 Matrix timeline。
2. 增加独立 Node/Hono `apps/space-runtime`，移植 demo 的持久 Project、同 Space 串行 turn、跨 Space 有限并行、SSE/command、Dev draft 与 publish barrier。
3. 增加通用 Space App contracts/SDK；Runtime 的公共 API 使用 `agentId`，Pi 只出现在 Adapter 注册和首版默认值。
4. Backend 先完成 Better Auth 与 `room_index` 参与者校验，再代理 Runtime；浏览器和生成 App 不直接持有内部 token。
5. 现有 Matrix `sendMessage` 成功后，只有显式 `@agent` 消息才以 Matrix `eventId` 作为幂等键提交 turn；普通真人聊天调用链不变。
6. 房间页面形成 Kernel、Chat、App 三边界：Chat 保留全部现有能力，App 默认加载 Dev draft，用户可显式发布并切换 Live。

首版运行证据必须覆盖：同一 Matrix 房间的真人消息仍可正常发送；重复提交同一 `eventId` 只产生一个 agent turn；Agent 失败只显示可恢复状态；Dev 更新不会自动覆盖 Live；发布成功后 Live 指向固定版本。DB lease、对象存储、积分结算和跨副本接管仍是后续生产门槛，未完成前不得标记整个 A3 Complete。

本轮已取得的定向证据：

- room service、repository、product client 与 `SpaceInstanceServer` 共 4 个测试文件、10 个单元测试通过，覆盖稳定实例 ID、历史记录兼容、同 Space 队列和请求幂等。
- 使用真实 Host Pi 向隔离实例提交共享计数器需求，生成 Draft `2969552e780ea11a`，Dev App 返回 HTTP 200；随后发布 Release `2a832ede…`，Live App 带固定 release header 返回 HTTP 200。
- 内部 snapshot 未携带 token 返回 401；App State bridge 写入后 revision/snapshot 可恢复；生成的 App 通过 `/v1/space-app-sdk` 使用通用 Space SDK。
- Backend Node 构建以及新增 contracts、SDK、product client、Web、Runtime、Backend 的定向 TypeScript 检查通过。
- 最终 `pnpm docs:check`、`pnpm build:docs`、全仓 `pnpm typecheck` 和包含 17 个 package/app 的 `pnpm build` 通过。全量 `pnpm test` 为 137 通过、1 跳过、3 个已知基线失败；失败仍是 `validators/user.test.ts` 1 个与 `email/cloudflare.test.ts` 2 个，与本切片无关。
- 2026-08-23 默认 `pnpm dev` 已自动启动 Synapse 与五个应用，真实 Bootstrap 返回 `matrix.status=ready`；Synapse Appservice integration 1/1 通过，Chromium Bootstrap 与 Matrix Room/持久消息定向 E2E 5/5 通过。

当前已经形成真实本地 Synapse 的单 Chromium Chat 基线证据，但尚未形成双 Chromium 的 #40 Agent/App 协作证据，因此本切片和 A3/A4 都保持 Active。Agent 回复当前通过 Runtime SSE 合并到 Chat UI，而不是 Matrix virtual-user event；这满足首版可见对话，但尚未达到“Matrix 是唯一消息 timeline”的最终不变量。

### S0：兼容护栏与命名校正

- 回滚“删除 Space 市场”的任务和测试预期。
- 明确 Space Instance 与 Space Template 术语，Matrix Room 只作为底层 ID。
- 保留 `/v1/spaces`、Discover、收藏、`spaceId/spaceVersionId` 和 `/v1/rooms`。
- 把 `room-app`/`Pi`/`Studio` 目标命名改为 `space-app`/`Agent`/Kernel 功能。

完成条件：所有活动文档不再要求删除市场或降级 Chat，兼容边界明确。

### S1：Space 实例、Project 与双读

- 新增 Space Instance/Project/Revision/Release/Agent contracts 和错误码。
- `room_index` 原地增加并回填 `space_instance_id/project_id/default_agent_id/updated_at`；禁止创建平行实例表。
- 将 `RoomIndexRecord/RoomRepository/RoomService` 迁移为 `SpaceInstanceRecord/Repository/Service`，旧名称只做薄兼容导出。
- `/v1/rooms` 保持兼容，允许模板字段为空并幂等创建空白 Project。
- 现有 `spaceId/spaceVersionId` 解释为 Template lineage，不先删除。
- 新增 `io.vibechat.space.instance.v2`，与 v1 双读和 outbox 修复。
- 覆盖 Matrix + Space + Project 创建的补偿与回滚测试。

完成条件：历史一对一/多人记录与新空白/模板 Space 都解析为唯一 SpaceInstance，旧 Space 与 Chat 正常读取。

### S2：Kernel、Chat、App 与 Space SDK

- 新增 Node 22 + TypeScript + Hono 的 `apps/space-runtime` 与 `packages/space-app-*`。
- 按 demo 对象边界实现 `SpaceInstanceRegistry/Server`、SSE/command、Turn scheduler、Project Store 和 sequence/snapshot 恢复。
- 接入 `@rivet-dev/agentos`、`@rivet-dev/agentos-apps`、Dev Preview 与 immutable Release；版本由 spike 后 lockfile 固定。
- 实现隔离 origin、Runtime session、Host bridge 和 SDK。
- 固定 Kernel/Chat/App 三边界，创作/发布状态归 Kernel。
- 支持空白 Space 选择模板，已有 Project 应用模板时生成可回退 Draft。

完成条件：双浏览器 Space App 互动通过；一对一/多人走同一 Instance Server；App 崩溃不影响完整 Chat。

### S3：Agent Adapter、Space Dev 与 Draft

- 建立 Agent Registry、Adapter 和 fake provider 合约测试。
- 第一实现可以接 Pi Adapter，但所有公共契约保持通用 Agent 命名。
- 普通 Chat 不入 Agent 队列；显式 Agent 请求才执行 ACL/credits/queue。
- 实现 Space 单写 lease、短批次、Conversation/Revision、Dev 和 Draft。
- 接入逐请求 reservation、usage、结算、退款和恢复。

完成条件：Pi 与 fake/第二 Adapter 共享一套平台契约；Chat 与 Agent 故障隔离。

### S4：不可变发布与治理

- 实现固定 Revision 发布、不可变 artifact、SBOM/provenance 和原子 Live 指针。
- 实现失败保护、恢复、撤销、Template/Agent/Release Admin 治理。
- Matrix v2 state 与 Product DB 指针通过 outbox/reconciler 一致化。

完成条件：发布、重复回调、撤销、重启和账务 reconciliation 测试通过。

### S5：生产验证与市场演进

- 运行现有认证、社交、Chat、市场全回归和 TEST-CATALOG #40。
- 完成压测、安全审计、备份恢复和灰度。
- 第三方模板发布、审核和分成另行评审，不影响当前官方市场继续存在。

完成条件：稳定设计 §13 门槛全部具备真实证据。

## 6. 禁止删除与新增清单

### 禁止因本设计删除

- `/discover`、`GET /v1/spaces`、Space 详情、分类、收藏和模板版本。
- 新建 Space 的模板选择与 `spaceId/spaceVersionId` 兼容输入。
- 真实 Matrix Chat、联系人、邀请、消息关系、媒体、已读和 typing。
- `io.vibechat.space.instance.v1` 的迁移期读取。

### 已新增或计划扩展

- 已新增 `apps/space-runtime`。
- 已新增 `packages/space-app-contracts`、`space-app-sdk`；Host API 先进入现有 `packages/product-client`。
- Space Instance/Project/Revision/Release/App State 数据模型。
- Agent Registry/Adapter/session/request/batch 数据模型。
- `io.vibechat.space.instance.v2` 和兼容 Space App API。

明确不新增 `space_instances` 平行物理表；实例字段落在原有 `room_index`，Project/Revision/Release/queue/state 才使用独立表。

新增能力必须复用现有 Better Auth、Matrix、权限、积分、产品 API 和 package 边界。

## 7. 验收与完成条件

- [ ] UI 与公开文档以 Space 为产品语义，Matrix Room 只在技术说明出现。
- [ ] Kernel、Chat、App 三边界有组件、权限和 iframe 安全证据，无 Studio 边界。
- [ ] 空白与市场模板两种创建模式通过真实 Matrix 双浏览器验证。
- [ ] 历史私聊、历史群聊和新增多人 Space 都映射唯一 `spaceInstanceId`，共用同一 Repository、Instance Server、Project、SDK 和 queue。
- [ ] 两个 Space Runtime replica 竞争同一实例时只有 lease owner 写入，接管后 sequence/snapshot/queue 可恢复。
- [ ] Discover、分类、详情、收藏、版本和模板创建回归全绿。
- [ ] Agent Adapter 契约由 Pi 和 fake/第二 provider 同时验证。
- [ ] 普通 Chat 不触发 Agent；显式 Agent 请求覆盖 ACL、credits、queue 和失败恢复。
- [ ] Template 应用、Draft、publish、rollback 和 v1/v2 migration 有 unit/contract/integration 证据。
- [ ] App/Agent/Runtime 故障期间完整 Chat 保持可用。
- [ ] 相关 TanStack E2E 全绿并在 TEST-CATALOG #40 记录环境、命令和结果。
- [ ] `pnpm docs:check`、`pnpm typecheck`、`pnpm build` 以及适用 E2E 通过。

在以上条件全部满足前，本文件保持 Active，稳定设计中的新增 Space App/Agent 能力不得标记为已实现。
