# Space App 设计演进与实施记录

> 生命周期：开发中
> 文档类型：实施记录
> 状态：Active
> 更新日期：2026-08-24
> 维护范围：Space 语义、市场与模板、Kernel Bar/Chat Core/Space App、Agent Adapter、Runtime、数据/API/UI/E2E 演进
> 对应稳定设计：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 1. 目的与事实边界

本文记录 2026-08-22 基于外部 demo 的 Space App 设计演进、产品校正、首版实现事实、剩余差距、实施顺序和完成条件。

稳定设计定义目标状态；本文描述实施事实。外部 demo 本身不构成本仓库证据；本仓库现已按相同对象边界和执行链完成首版纵向切片，并接入 Better Auth、Matrix membership、结构化 Agent Mention、积分预留/真实 usage 结算和通用 Agent 契约。生产持久化、多副本接管和 Matrix Agent 回写仍是后续门槛。

本次产品校正确认：

- 用户语义必须是 Space，不能把底层 Matrix Room 提升为产品名称。
- Space 市场继续存在；空白或模板创建都被支持。
- Space 是创建后立即可用、持续实时更新的在线空间，不是 Workspace、编辑器或试验场。
- Chat Core 是不可修改的平台基础能力；Chat UI 属于默认 App 代码，可以被模板或 Agent 任意重新设计。
- 产品逻辑边界只有 Kernel Bar、Chat Core、Space App；只有顶部 Kernel Bar 是固定宿主界面，其下全部由 App Project 渲染。
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

### 2.2 Template Source 管理基线

2026-08-23 核验发现，首版五个官方模板集中内联在 `packages/space-templates/src/index.ts`，Runtime 创建时复制到 `.data/projects/<spaceInstanceId>.json`。当时 v1–v4 虽有不同 ID，却复用同一个可变 Project 对象，`integrity` 也是人工标签；升级依靠 summary、Chat HTML marker 和版本号正则判断是否未修改。这与 Template Version 不可变、实例 Project 独立的稳定设计不一致。

本轮已建立统一发布协议和单一工作源码基线：

- 五个官方 Template 已分别迁入 `packages/space-templates/official/<template-id>/`；每个 Template 只有一份持续演进的 `app/` 源码，扁平 `releases.json` 只追加 Version manifest、lock 和 immutable artifact 引用，不保存逐版本源码副本。
- 2026-08-24 进一步纠正 `app/` 内部结构：五个官方项目和 Runtime seed 都改为普通多文件项目，`src/index.ts` 只负责导出/启动 `registry` 与 fetch handler 装配，Runtime、文档、Template App、默认 Chat UI 分模块维护；Project hash、Artifact provider、Space Project Store、Dev Preview 转译和 Agent 工作区同步均覆盖完整文件树，不再把三个必需文件误作唯一文件列表。
- 当前五个官方 Template 都从 `0.1.0` 相邻提升到 `0.1.1`；该 patch 对应 App Project 入口实际变化，使 AgentOS Release replica 能读取导出的 `registry`，不改变 SDK、权限或状态语义。两个 Version 都保留在扁平发布索引中，仓库仍只有一份当前 `app/` 工作源码；`published` 记录不可重签，任何后续载荷变化继续追加相邻 SemVer。
- `scripts/generate-official-catalog.mjs` 校验 ID、Publisher、provenance、Release 顺序/锁、最新 `app/` hash 和历史元数据漂移，再生成只含市场元数据的 `official-catalog.generated.ts`；Runtime 通过独立 artifact provider 加载 App，生产目标为统一 Registry/Object Store。
- `registry.ts` 定义 `vibechat.space-template/v1`、`vibechat.space-template-version/v1` 和 `vibechat.space-template-market-entry/v1`。官方和用户 Template 共用 `createSpaceTemplateVersion()` 与 `createSpaceTemplateMarketEntry()`，不存在 `BuiltInTemplate` 公共类型。
- 官方身份由 `publisher.verification=official` 表达；仓库创作使用 `provenance.origin=repository`。用户从 Space App 发布时使用相同版本/市场结构，只把 provenance 写为 `origin=app` 并绑定固定 `sourceSpaceRevisionId`。
- `/v1/spaces`、Space 创建服务、Matrix 模板快照、Runtime bootstrap、收藏和 Discover 已迁移到统一 Market entry；旧 `source=builtin` 和 `official` 布尔字段被 Publisher/Provenance 替代。
- 每个 Template Version 暴露规范化 `sourceHash` 和 `SpaceTemplateArtifact` 引用，并由 artifact、格式、capabilities、Space App SDK/Runtime compatibility 和 provenance 生成 `manifestHash` 与 content-bound `integrity`。历史 Release lock 不匹配会直接失败，必须新增版本。
- Runtime Project 同时记录 Template lineage hash 和当前源码 hash；磁盘 JSON 内容与已记录 hash 不一致时拒绝加载。任何 Agent/人工源码修改都不会被模板重复初始化覆盖。
- 2026-08-24 建立 [Space Template 版本规则](../../stable/references/space-template-versioning.md)：新 Template 从 `0.1.0` 开始，只能按不可变载荷变化走相邻 SemVer，禁止跳号、倒序、空升版和以 schema/SDK/开发轮次代替 Template 版本。共享 registry 和官方 codegen 同时执行门禁。
- 管理基线前创建的 `builtin-<template>-v1..v5` 与误写的 `tplv-<template>-5-0-0` 仅保留为开发数据读取 alias；新写入统一规范化为当前 `0.1.1` `tplv-*` 版本 ID，不再签发新的 `builtin` ID。

定向 unit 已以 App 来源的用户 Template 样本验证同一版本与 Market entry 协议，并以可注入目录验证市场读取、收藏和 Publisher 标记无需官方分支。当前默认目录仍只装载五个官方条目；用户发布 API、隐私清理、审核队列、签名/撤销、Product DB/Object Store 和官方目录同步 job 尚未完成，因此不能声称用户上架已经开放。

2026-08-24 验证结果：Template Catalog、Product State、Room Service 和 Synapse Adapter 定向 unit 15/15 通过；本地 Synapse Chromium 回归中 `chat-real-product-state.spec.ts` 9/9、`chat-matrix-room.spec.ts` 2/2 通过，覆盖市场读取/收藏、统一 Publisher 数据、从 Template 创建 Space、App iframe 内真实发送/回复/Reaction 和刷新恢复。共享协议测试额外覆盖 `0.1.0 → 0.1.1 → 0.2.0 → 1.0.0` 合法序列，以及空升版、跳号、错误首版、非最高 current、非规范 SemVer 和旧 `5.0.0` alias 拒绝/兼容行为；真实创建流程的五个官方条目均显示 `App 模板 v0.1.0`。全仓 19 个 workspace project 递归 typecheck/build、文档链接检查与 Docs production build 通过。

同日进一步纠正官方源码布局：每个 Template 从逐版本 Project 目录迁移为唯一 `app/` 工作源码与扁平 `releases.json`；Version/Market 只保存 `SpaceTemplateArtifact` 引用，generated catalog 不再内联源码，Runtime 经 artifact provider 校验并加载。纠正后 catalog codegen、上述 15 个定向 unit、19 个 workspace typecheck/build、文档检查和真实 Synapse Chromium Product State 9/9、Matrix Space 2/2 再次通过。

同日完成 AgentOS Release 兼容 patch：五个官方 Template 只在现有 `app/` 工作树补充 Release runner 要求的 `registry` 导出，按 `0.1.0 → 0.1.1` 相邻 patch 追加 manifest、source/manifest lock、artifact 引用和 CHANGELOG；五个新 source hash 均与 `0.1.0` 不同，旧记录未覆盖，也没有创建版本源码目录。本地 AgentOS Apps Build VM 通过受控 DNS 列表访问 npm registry；最小依赖补丁只把已有 native VM `dns` 能力接入公开 options 和 Build VM。Alice 的苔原 Space 经 Kernel 恢复到 `space-default@0.1.1` Revision `2d68a0defce3aac1` 后，真实 AgentOS 构建成功写入相同 `publishedDraftId` 和 Release `4b3802b5db16fe23e62228477f9b2d8a798fde0abef1676bee8ed3d9a2e468c4`，原 Matrix `@pi hello` 消息保持。相关 unit 33/33、五个官方 App 与 Runtime seed 严格 TypeScript、真实 Synapse Matrix Space 2/2、全仓 18/18 typecheck/build、应用边界和文档检查通过。

## 3. 采纳、不采纳与产品修正

### 3.1 采纳的行为语义

- Chat Core 先于 Agent 完成并保持独立可用；Default Chat App 是空白 Space 的初始 ready Project。
- Agent 定制先生成 Candidate；验证成功后实时更新当前 ready Revision，显式发布只负责固化不可变 Release。
- 同一 Space App 单写、相邻请求短批次、Publish 为顺序屏障。
- Candidate 验证与 Published Release 隔离；失败不能覆盖最后 ready Revision 或 Published Release。
- members、完整 chat、mentions、agents、presence、state、event、theme 构成 Space SDK；Agent 调度通过结构化 Chat Mention 进入同一平台链路。
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
| demo 的 Room/Studio 用户语义 | 产品统一 Space；边界统一为 Kernel Bar/Chat Core/Space App |

### 3.3 对上一版迁移结论的撤销

以下上一版记录作废：

- 删除 `/v1/spaces`、Discover、收藏、分类或市场。
- 新建流程不再允许选择模板。
- 把 `spaceId/spaceVersionId` 视为必须清除的旧字段。
- 把产品实体改名为 Room App。
- 把 Pi 写入公共表名、API、错误码和 UI。
- 将 Studio 定义为独立的第四边界。

这些内容不得继续作为实施任务或删除条件。

### 3.4 2026-08-23 实时 Space Surface 校正

本次校正替代“固定 Chat Panel + 可定制 App Panel”的页面目标，但不撤销已经完成的 Matrix Chat、Runtime、Project、Template 和路由迁移证据。

确定结论：

1. **Space 不是 Workspace。** 成员进入的是正在使用的实时 Space，不存在独立的实验场或必须发布后才能使用的预览空间。内部 `dev` channel 只负责把新的 ready Revision 持续送达当前 Space。
2. **只有 Kernel Bar 固定。** 顶部 Kernel Bar 继续由可信 Host 渲染；它以下的全部 DOM、布局、文案和交互均来自 Space App Project。
3. **Chat UI 是 App 代码。** 空白 Space 复制 Default Chat App 作为初始 Project；模板或 Agent 可以任意改变聊天的呈现和调用方式，不保留宿主固定 Chat Rail、Composer 或 Timeline。
4. **Chat Core 不可修改。** Matrix timeline、成员、消息关系、媒体、已读、typing、Mention、屏蔽、ACL 和 Agent 调度属于平台服务。App 只能通过版本化 SDK 调用，不能替换实现、伪造身份或建立第二条 timeline。
5. **`@agent` 是 Chat Core 命令。** App 从平台查询结构化 Agent target，并随 Chat send command 提交 Mention；Backend 在 Matrix event 确认后按 `eventId` 幂等执行 ACL、credits 和 Agent queue。现有独立 `agent.request()` 只作迁移适配器。
6. **实时更新不牺牲可用性。** Candidate 构建成功才成为 ready Revision，并对同一 Space 的在线成员实时切换；失败继续运行最后 ready Revision。Kernel Bar 可以回滚或恢复 Default Chat App。
7. **发布是固化，不是从试验场上线。** Publish 把固定 ready Revision 保存为不可变 Release，用于版本记录、恢复、分享或稳定部署；当前 Space 在发布前已经是可用状态。

目标页面结构：

```text
Space route
├── Kernel Bar（Host 固定、可信、不可被 App 覆盖）
└── Space App iframe（其下全部界面）
    └── Space SDK
        ├── Chat Core：timeline/actions/Mention/@agent
        ├── members/presence
        ├── state/events
        └── Agent/Revision 状态只读投影
```

这仍保留 Kernel、Chat、App 三个逻辑边界，但 Chat 从“固定视觉面板”改为“固定能力边界”。

## 4. 当前实现事实与目标差距

| 范围 | 当前实现事实 | 新目标 |
| --- | --- | --- |
| 产品语义 | UI/代码同时存在 Space 与 Room 词汇 | UI/公开文档统一 Space；Matrix Room 只保留技术语境 |
| Chat | A2 真实 Matrix timeline 和完整消息操作继续作为 Chat Core；Host 已通过受信 bridge 向 App 提供发送、回复、编辑、删除、Reaction、附件、重试、typing、已读与 Mention | 补齐分页、双浏览器完整 contract suite 和 Matrix Agent 回写 |
| 创建 | 官方目录包含 Default Chat App 与四个差异化模板；新建允许零联系人，默认选择 Default Chat | 补齐已有 Space 后选模板与 Candidate 回退 |
| 市场 | 五个官方条目已拆为独立 `agentos-app-v1` Project，当前版本为有序 patch `0.1.1`，并以官方/用户共用协议和 SemVer 门禁提供分类、详情、收藏和历史 lineage | 后续迁移数据库/对象存储并完成用户发布与审核上架 |
| Space state | `room_index` 已原地增加稳定 instance/project/default-agent ID；Matrix 仍为 v1 | 增加 v2 Project/Release/Agent state 双读与修复 |
| App | `/spaces/:spaceId` Host 已只保留顶部 Kernel Bar 与单一 iframe；Default Chat UI 和四个模板的 Chat 入口均属于 App Project 代码；Kernel 可显式恢复官方 Default Chat App | 补齐历史 rollback、可访问性与双浏览器 contract suite |
| Runtime | Node/Hono Runtime 已实现本地 Project、queue、SSE、Dev/Release | 迁移生产 DB/Object Store 和多副本 lease |
| SDK | contracts、SDK 与 Host bridge 已覆盖完整首版 Chat 操作和结构化 member/agent Mention；Backend 会按精确 Matrix event 核验 Agent target | 补齐分页、双浏览器 contract suite 和 Matrix Agent 回写 |
| Agent | 通用 `agentId`/Adapter/queue 已实现，默认 Pi；Host Pi 真实回复与 token usage 结算已验证 | 增加 fake/第二 Adapter、取消、恢复与 Matrix 回写 |
| 版本 | 当前 Space 始终加载内部 dev/ready channel，Kernel 显示实时版本并可固化发布；不再提供 Dev/Live 画布切换；Default Chat 恢复走新的 ready Revision | 增加历史 rollback 与双浏览器实时切换证据 |
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

### 5.0.1 2026-08-23 官方 Space Template 迁移（已验证切片）

- 新增 `@vibechat/space-templates` 作为 Backend 目录与 Node/Hono Runtime 的共享事实源；夜航电台、苔原共创室、像素星期六和明日明信片各自携带不同的可执行 `agentos-app-v1` Project 源码，当前目录固定到 v2，同时保留 v1 lineage 的兼容 Project。
- `room_index.spaceId/spaceVersionId` 继续作为 Template lineage。Backend 在 snapshot、events、App、bridge、Agent turn 和 publish 入口幂等调用 Runtime bootstrap；已经存在的 Project 永不被模板覆盖。
- Runtime bootstrap 复制 Template Project 后直接准备 Dev draft。历史 v1 Space 在原 Matrix Room/SpaceInstance 上 lazy bootstrap，不创建平行实例、成员或聊天记录。
- opaque iframe 不增加 `allow-same-origin`。Backend 在 HTML 响应中注入受信任 Space SDK shim，并保留 `connect-src 'none'`；生成源码的 `/v1/space-app-sdk` import 在响应边界改写为本地全局绑定。
- 本地 Synapse + Alice 浏览器走查：历史夜航电台 `!qcRWjoykTSidOmkOix:localhost` 原地得到 v1 Project/Draft `3a849bb6345867b5`；从 v2 苔原共创室创建 `!JMBcNJQgAZDgcSmOpt:localhost`，在没有 Agent turn 时得到 Draft `85b251af233f07b6`，共享便签写入后刷新恢复，Matrix Chat composer 同时保持可用；重启完整 dev 栈后 presence 使用 Alice 的真实 `user_*` 身份且不再残留 legacy guest。
- 定向 unit 共 13 个通过，覆盖四模板不同源码、v1/v2 解析、bootstrap 不覆盖后续 Revision、HTML SDK 注入、SpaceInstance queue、Room/目录契约；`pnpm docs:check`、Docs production build、全仓 18/18 package/app `pnpm typecheck` 与 `pnpm build` 均通过。

本切片只完成官方内置模板的可执行迁移与本地 Runtime bootstrap。空白 Space、数据库化/第三方市场、对象存储、多副本 lease、双 Chromium Agent 协作与完整 #40 E2E 仍未完成，因此 A3/A4 和本文保持 Active。

### 5.0.2 2026-08-23 Space-first 路由迁移（已验证基线，页面形态已被校正）

- 产品一级入口从“消息”改为“Spaces”；列表中的每一项都是运行中的 Space Instance，而不是套用氛围的聊天会话。
- `/spaces` 负责 Space 集合、未读、成员、App 模板 lineage 和创建入口；`/spaces/:spaceId` 固定呈现 Kernel、Chat、App 三个边界。
- `/messages` 与 `/rooms/:roomId` 只承担兼容重定向。认证回跳、官网/Admin CTA、联系人、市场模板和创建完成后的导航统一生成 `/spaces` URL。
- 首个前端迁移切片继续使用 Matrix Room ID 解析 `spaceId`，不创建第二份实例 ID 或 Repository；后续可在 Backend 提供公开 Space ID 后无损替换 URL 参数。

验证结果：双语导航与页面已经移除 Room/消息收件箱语义；旧 URL 重定向、新 URL 直接访问、创建 Space 后进入详情、现有 Matrix Chat、Space App、移动端导航、认证回跳和公开入口均完成运行验证。Chromium `chat-real-product-state.spec.ts` 9/9、`chat-matrix-room.spec.ts` 与 `chat-social-invite.spec.ts` 3/3 通过，其中包含 App 返回 503 时宿主 Chat composer 仍可用的旧隔离断言；真实登录浏览器同时显示 Kernel、宿主 Chat 与官方 Template Dev App。`pnpm docs:check`、`pnpm build:docs`、全仓 18/18 package/app `pnpm typecheck` 与 `pnpm build` 均通过。

上述结果继续证明路由、Matrix、Runtime 和 App 可以共存，但“宿主固定 Chat + 并列 App”的页面形态已被 §3.4 替代，不能作为新前端完成证据。

### 5.0.3 2026-08-23 实时 Space App Surface（首版已实现，完整验收进行中）

本轮已实现：

1. 将 `/spaces/:spaceId` 宿主收敛为固定 Kernel Bar 与单一全尺寸 App iframe；删除宿主 `SpaceRail`、Chat timeline、composer 和并列 App canvas。
2. 把当前完整 Chat UI 迁移为平台 Default Chat App Project，作为空白 Space 和历史 Space 缺省的 ready Revision。
3. 扩展 `@vibechat/space-app-contracts` 与 SDK，覆盖消息订阅、发送、回复、编辑、删除、Reaction、已读、typing、媒体、member/agent Mention 搜索和结构化发送参数；历史分页仍待补充。
4. Chat Core 继续复用现有 Matrix SDK、Backend ACL 和关系事件实现；SDK bridge 只做代理，不复制 timeline 或权限状态。
5. App Chat command 已把结构化 Agent target 写入 Matrix `io.vibechat.agent_mentions` event content；人类消息仍先取得 Matrix `eventId`，Backend 再读取该精确事件核验 sender、type、target、membership 与实例 allowlist，文本 `@name` 不再决定 Agent 调度。
6. 当前 Space 始终走内部 dev/ready channel；Kernel Bar 显示 Agent/Revision 状态、重载和“发布此版本”，不再把 Dev/Live 作为两个用户画布。
7. Default Chat 与官方四个差异化 Template 当前以独立 `0.1.1` App Project 进入统一市场协议；`0.1.0` 保留为历史 Version 元数据，旧 `builtin` v1–v5 与误写的 `5.0.0` 仅作开发数据兼容 alias，Agent 已定制 Project 不会被覆盖。
8. Host 首次打开 Space 时先通过 authenticated snapshot 完成幂等 bootstrap，只有 `devPreview.state=ready` 且存在固定 `draftId` 后才挂载 App iframe；冷启动期间显示中性准备状态，不再用 Default Chat 恢复面充当超时占位。
9. Host 为同一 Space 保存最后一个 ready App target；Runtime 轮询、Agent 构建或短暂重连不会卸载它。切换 Space 时校验 snapshot 的 `matrixRoomId`，不会把旧 Space 的 App 或 snapshot 带入新实例。Backend 已删除包级 Default Chat HTML 恢复分支，Runtime 非 2xx 保持原始状态；Dev Preview 以 `spaceInstanceId + revisionId` 隔离 Candidate/ready 实例，最近三个 ready Revision 可按固定 `version` 读取，构建或启动 Candidate 不会先终止当前 ready App。Web 在页面刷新遇到 building/failed Candidate 时从 Project `draftId` 恢复最后 ready Revision；恢复 Default Chat 只能由 Kernel 显式创建新的受管 Revision。
10. 2026-08-24 已把“恢复 Default Chat App”接入 Kernel 可信控制面：请求携带幂等 ID 与用户看到的 ready Revision，Backend 完成 session/Space membership 校验后进入同 Space 单写队列；Runtime 从官方 Default Chat Template 当前固定版本读取 artifact，在隔离 Candidate 中验证，成功才保存新的 ready Revision，并保留原 Published Release、Matrix timeline 与 App State。恢复请求不调用 Agent、不消费 AI credits，也不在浏览器或共享 Template 包拼接源码；revision 已变化时拒绝覆盖并要求用户基于最新状态重试。Alice 本地 Synapse 走查把苔原 Project 恢复为 `space-default@0.1.1` 的 ready Revision `2d68a0defce3aac1`，原 `@pi hello` Matrix 消息仍可见，随后成功固化不可变 Release；新 Kernel 系统事件不会伪装成真人或 Agent Chat 消息。

本轮证据：

- 浏览器 DOM 走查确认 Host 只包含 Kernel Bar 与一个 iframe；夜航电台 App 内可展开自己的 Chat drawer，新建流程默认选择 Default Chat 并允许零联系人。
- `chat-matrix-room.spec.ts` 2/2 通过：从固定 Template Version 创建真实 Matrix Space，首个 iframe 文档响应不含 `x-vibechat-space-recovery`，并在 Template App 内完成发送、回复、Reaction 与刷新后的唯一历史恢复。
- `chat-matrix-operations.spec.ts` 1/1 通过：两个真实 Matrix 用户在同一 Template App 中完成 typing、发送/接收、编辑、撤回、附件、离线失败/重试与刷新恢复。
- Space Template/Runtime/Product State 定向单元测试覆盖五个不同 Project、Runtime 失败透传、旧内置 Project 安全升级和自定义 Project 不覆盖；全仓 18/18 package/app typecheck 通过。
- 2026-08-24 冷启动状态机 unit 5/5 通过，覆盖首次 building 不挂载 iframe、ready Revision 与 preview version 精确匹配、同 Space 构建/重连保留上一版以及跨 Space 不串用旧 target；全仓 18/18 typecheck/build 与文档检查通过。
- 2026-08-24 本地发布恢复进一步收口：根 `pnpm dev` 直接管理固定版本 Rivet Engine，把数据库放入仓库内被忽略的 `apps/space-runtime/.data/rivetkit-storage/managed-engine/db`，在 Engine 健康后才启动应用，并在整栈退出时停止自身 Engine。Runtime 启动等待 Registry ready；AgentOS Apps Scaler 以 boot ID 丢弃上一进程遗留的 replica/admission 租约，但保留 Actor、App、Draft 与 Release。Alice 的 Release `4b3802b5db16fe23e62228477f9b2d8a798fde0abef1676bee8ed3d9a2e468c4` 在完整停止/重启前后保持不变，Live 均为 HTTP 200，副本从 `/0` 重建为 `/1`。这不是生产多副本接管证据；guest metadata/RPC warning 仍作为 AgentOS `0.2.15` 已知问题跟踪。
- 2026-08-24 fallback 边界修正定向 unit 32/32 通过：App 代理保留 Runtime 503 且不注入包级 Default Chat，Dev Preview 成功/失败 Candidate 使用不同版本实例，失败后旧 ready Revision 仍可读取，刷新状态选择 Project 记录的固定 `draftId`。全仓非缓存 typecheck/build 均为 18/18，文档链接、Docs production build、Cloudflare production bundle 与真实 Synapse `chat-matrix-room.spec.ts` 2/2 通过；Alice 浏览器直接加载 `/spaces/!WGY…` 的精确 revision `95d93d0de00c212b`，Host DOM 只有 Kernel Bar 与单一 iframe，iframe 内完整 Matrix Chat 可用且没有宿主 Default Chat 闪屏。
- 2026-08-24 新账号欢迎积分与真实 Agent 链路完成首个运行切片：注册账号通过幂等 `signup:welcome:<userId>` 交易获得默认 100 credits；Alice 的 Default Chat App 把结构化 `@pi` metadata 与人类消息写入真实 Synapse，Backend 复读精确 event 后完成 ACL/credits/queue，系统 Host Pi 以确定性 UUID session 和 `deepseek/deepseek-v4-pro` 回复“积分与 Agent 对话都已打通。”。该 turn 上报 4,839 tokens，账本先预留 4 credits、再补扣 1 credit，余额从 100 变为 95；失败 turn 各自只退款一次。定向 unit 覆盖欢迎积分幂等、Matrix event content、产品 turn contract、Pi session UUID 和批次 usage 分摊。

尚未完成：双 Chromium 的完整消息操作/typing/媒体/Mention contract、双 Chromium 结构化 `@agent` 自动化、Candidate 失败保护的浏览器覆盖、历史 rollback、Matrix Agent 回写、生产存储与多副本 lease。因此 A3/A4 与本文继续保持 Active。

完成条件：Default Chat App 与至少一个完全不同布局的 Template App 都能在双 Chromium 中完成人类双向聊天、Mention、`@agent`、回复/编辑/删除/Reaction/媒体/已读/typing；App 代码可以改变全部 Chat UI，但无法改变平台事件、身份、ACL、计费和调度语义。Candidate 失败继续运行最后 ready Revision，Kernel Bar 可恢复 Default Chat App；没有单独 Workspace/试验场产品入口。

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

### S2：Kernel Bar、Chat Core、Space App 与 SDK

- 新增 Node 22 + TypeScript + Hono 的 `apps/space-runtime` 与 `packages/space-app-*`。
- 按 demo 对象边界实现 `SpaceInstanceRegistry/Server`、SSE/command、Turn scheduler、Project Store 和 sequence/snapshot 恢复。
- 接入 `@rivet-dev/agentos`、`@rivet-dev/agentos-apps`、Dev Preview 与 immutable Release；版本由 spike 后 lockfile 固定。
- 实现隔离 origin、Runtime session、Host bridge 和 SDK。
- 只固定顶部 Kernel Bar；其下全部界面由 Space App Project 渲染，Default Chat UI 也进入 App 源码。
- 扩展完整 Chat/Mention SDK，Chat Core 与 Agent 调度继续由平台实现。
- 支持空白 Space 选择模板，已有 Project 应用模板时生成可回退 Candidate。

完成条件：Default Chat App 与不同布局 Template App 的双浏览器互动通过；一对一/多人走同一 Instance Server 和 Chat Core；App 崩溃后 Kernel Bar 可恢复最后 ready Revision，消息能力没有第二套实现。

### S3：Agent Adapter、持续更新与 ready Revision

- 建立 Agent Registry、Adapter 和 fake provider 合约测试。
- 第一实现可以接 Pi Adapter，但所有公共契约保持通用 Agent 命名。
- 普通 Chat 不入 Agent 队列；只有带平台结构化 Agent Mention 的消息才执行 ACL/credits/queue。
- 实现 Space 单写 lease、短批次、Conversation/Revision、Candidate 校验和 ready Revision 实时切换。
- 接入逐请求 reservation、usage、结算、退款和恢复。

完成条件：Pi 与 fake/第二 Adapter 共享一套平台契约；Chat 与 Agent 故障隔离。

### S4：不可变发布与治理

- 实现固定 ready Revision 发布、不可变 artifact、SBOM/provenance 和原子 Published 指针。
- 实现失败保护、恢复、撤销、Template/Agent/Release Admin 治理。
- Matrix v2 state 与 Product DB 指针通过 outbox/reconciler 一致化。

完成条件：发布、重复回调、撤销、重启和账务 reconciliation 测试通过。

### S5：生产验证与市场演进

- 运行现有认证、社交、Chat、市场全回归和 TEST-CATALOG #40。
- 完成压测、安全审计、备份恢复和灰度。
- 用户 Template 从 Space App 发布到统一市场的存储、审核、签名和撤销继续实施；分成策略另行评审，不影响当前官方市场继续存在。

完成条件：稳定设计 §13 门槛全部具备真实证据。

## 6. 禁止删除与新增清单

### 禁止因本设计删除

- `/discover`、`GET /v1/spaces`、Space 详情、分类、收藏和模板版本。
- 新建 Space 的模板选择与 `spaceId/spaceVersionId` 兼容输入。
- 真实 Matrix Chat、联系人、邀请、消息关系、媒体、已读和 typing。
- `io.vibechat.space.instance.v1` 的迁移期读取。

### 已新增或计划扩展

- 已新增 `apps/space-runtime`。
- 已新增 `packages/space-templates`、`space-app-contracts`、`space-app-sdk`；Host API 先进入现有 `packages/product-client`。
- Space Instance/Project/Revision/Release/App State 数据模型。
- Agent Registry/Adapter/session/request/batch 数据模型。
- `io.vibechat.space.instance.v2` 和兼容 Space App API。

明确不新增 `space_instances` 平行物理表；实例字段落在原有 `room_index`，Project/Revision/Release/queue/state 才使用独立表。

新增能力必须复用现有 Better Auth、Matrix、权限、积分、产品 API 和 package 边界。

## 7. 验收与完成条件

- [x] UI 与公开文档以 Space 为产品语义，Matrix Room 只在技术说明出现。
- [ ] Space 语义不出现 Workspace/试验场；进入后始终运行最后一个 ready Revision，Candidate 失败不替换当前 App。
- [x] 顶部 Kernel Bar 是唯一固定宿主 UI；其下全部来自 Space App Project，无宿主固定 Chat Panel 或 Studio 边界。
- [ ] Default Chat App 与至少一个完全不同布局的 Template App 都通过同一 Chat Core contract，覆盖双向消息、媒体、回复、编辑、删除、Reaction、已读、typing 和历史。
- [ ] member/agent Mention 使用平台结构化 target；普通消息不触发 Agent，`@agent` 在 Matrix event 确认后按 `eventId` 幂等执行 ACL、credits 和 queue。
- [ ] 空白与市场模板两种创建模式通过真实 Matrix 双浏览器验证。
- [ ] 历史私聊、历史群聊和新增多人 Space 都映射唯一 `spaceInstanceId`，共用同一 Repository、Instance Server、Project、SDK 和 queue。
- [ ] 两个 Space Runtime replica 竞争同一实例时只有 lease owner 写入，接管后 sequence/snapshot/queue 可恢复。
- [ ] Discover、分类、详情、收藏、版本和模板创建回归全绿。
- [ ] Agent Adapter 契约由 Pi 和 fake/第二 provider 同时验证。
- [ ] Template 应用、Candidate、ready Revision 实时切换、publish、rollback 和 v1/v2 migration 有 unit/contract/integration 证据。
- [ ] App/Agent/Runtime 故障期间 Chat Core 保持可用，Kernel Bar 能恢复最后 ready Revision 或 Default Chat App。
- [ ] 相关 TanStack E2E 全绿并在 TEST-CATALOG #40 记录环境、命令和结果。
- [ ] `pnpm docs:check`、`pnpm typecheck`、`pnpm build` 以及适用 E2E 通过。

在以上条件全部满足前，本文件保持 Active，稳定设计中的新增 Space App/Agent 能力不得标记为已实现。
