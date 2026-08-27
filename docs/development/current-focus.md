# 当前开发重点

> 生命周期：开发中
> 状态：工程基线
> 更新日期：2026-08-27
> 维护范围：当前实现事实、近期主线和跨应用工程约束
> 稳定来源：[VibeChat MVP 产品与技术设计](../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 当前阶段

仓库已完成 VibeChat 产品 Web 宿主、A2 真实聊天闭环，以及账户、定价、积分、推荐、提现、支付和 AI 能力迁移。Email OTP、产品 profile、Matrix identity/device、session revoke、真实 Matrix room/timeline、社交邀请、完整消息操作、Space 市场基础、产品状态和多应用/package 边界均有测试或浏览器证据。

2026-08-23 产品设计进一步确认：**Space 是持续可用并实时更新的在线空间，不是 Workspace 或试验场**。顶部 Kernel Bar 是唯一固定宿主界面；其下全部由 Space App Project 渲染，默认 Chat UI 也只是可定制的 Default Chat App 代码。不可修改的是平台 Chat Core：Matrix timeline、成员、消息操作、Mention 与 `@agent` 调度始终通过 Space SDK 正常调用。Space 保留市场与模板创建，Pi 只是首个候选 Agent Adapter。Space Runtime 继续采用与 `chat-app-server` 同构的 Node/Hono、实例服务器、SSE/command、串行 Turn、ProjectStore、agentOS Apps 持续更新/Release 和 SDK 技术链。设计依据、demo 核验和差距见 [Space App 设计演进与实施记录](./active/space-app-design-transition.md)。

2026-08-26 Agent 部署边界进一步确认：AgentOS/Rivet Engine 默认按环境与区域共享部署，Space 是逻辑 App/actor 与单写队列单位，Agent session 按 `Space × Agent` 隔离，Dev/Candidate 按 `Space × Revision` 隔离，Release 按不可变 artifact 独立扩缩容；不为每个 Space 部署完整 AgentOS，也不使用全球唯一单体。长期约束见 [Agent 架构与 AgentOS 部署设计](../stable/designs/agent-architecture-and-agentos-deployment.md)，当前 Registry/session/生产 Engine 差距继续由 [Active 实施跟踪](./active/product-and-technical-implementation.md)维护，后续代码结构与阶段顺序固定在 [Agent 架构实施结构计划](./active/agent-architecture-implementation-plan.md)。

当前主线是 A3/A4 首版切片验证和生产化：

1. 保留 `/v1/spaces`、Discover、分类、收藏、模板版本和现有 `spaceId/spaceVersionId` 创建链路。
2. Runtime P0 正确性与安全已收口：gateway 实时核验 Matrix membership；Publish 固定请求时的 ready Revision 且只接受 Kernel 命令；内部调用使用短期 audience/method/path scoped 凭证。真实 member kick/leave 全 gateway E2E 已 2/2 通过：即使 `participant_user_ids_json` 仍含旧成员，snapshot/bootstrap、live/dev App、events、messages/turns、publish、restore 和 bridge 也全部立即 fail closed，且不产生 Turn、Outbox 或 credits 副作用。
3. 已在原地升级的 `room_index` 和统一 SpaceInstance 上抽取 Project/Instance/Turn/Lease/Outbox repositories，接入 Product DB/Object Store、v2 state、outbox reconciler、lease/fencing 与 interrupted-turn 恢复，没有新增 `space_instances`。下一步执行真实 D1/R2 migration/preview。
4. 在保持真实 Matrix Chat/社交/市场回归的前提下增加空白 Space 创建与模板后应用。
5. 以 TEST-CATALOG #40 推进 Kernel Bar + 全尺寸 App Surface、Default Chat App、完整 Chat/Mention SDK、结构化 Agent Mention、ready Revision 实时更新和 publish barrier。
6. 以统一 `SpaceTemplate` / `SpaceTemplateVersion` / `SpaceTemplateMarketEntry` 协议补齐用户从固定 ready Revision 发布到市场的 Product DB/Object Store、审核和撤销链路；不得为官方和用户建立平行类型或市场表。
7. 两个 `SpaceInstanceServer` 共用 SQLite control plane 的确定性故障注入已覆盖 M1→Publish→M2、active owner 超时接管、旧 owner fenced write 与 outbox ACK 丢失重放；下一步用两个独立 Runtime 进程和真实 Synapse/AgentOS/R2 重复相同场景。只有跨服务 Matrix reply、credits、Revision/Release 均无重复，才把生产接管标为完成。

## 当前实现事实

- `apps/site-app` 是公开官网，`apps/web-app` 是产品 Web/PWA，`apps/backend` 是共享产品 API，`apps/admin-app` 是独立运营宿主，`apps/docs-app` 是文档站。
- Web 与 Admin 通过各自同源网关访问 Backend；业务 handler、数据库、支付/AI provider、积分和存储仍只属于 Backend。
- 跨宿主能力已按稳定 exports 拆为实际 workspace packages；Better Auth 仍是浏览器身份权威。
- Matrix 是当前 Space membership 和 Chat timeline 权威；底层实现和兼容 API 仍使用 Matrix Room/`roomId`。
- 当前 `room_index` 的每条记录已经是统一 SpaceInstance 的物理基础；`POST /v1/rooms`、Discover、官方 Space 目录、收藏、`spaceId/spaceVersionId` 和 `io.vibechat.space.instance.v1` 都是必须保持的活动行为。
- `apps/space-runtime`、Space App contracts/SDK、Backend membership gateway、通用 Agent Adapter、ready Revision/Release 与 Web Kernel/App 已形成可运行的首版纵向切片。`/spaces/:spaceId` 只固定顶部 Kernel Bar，其下单一 iframe 包含 Default Chat 或定制 App；Host 不再渲染 Chat timeline/composer。
- Space Runtime 已将 Agent session VM 与 App Dev/Release 执行拆为独立 Runtime 接口；Pi 继续沿用现有 actor key，其他 Agent 的执行 key 按 `Space × Agent` 稳定隔离，Dev Revision key 与 Release scaling 不变。跨 Space 并发和 Turn 批处理配置已迁移为 `SPACE_AGENT_MAX_CONCURRENCY` / `SPACE_TURN_BATCH_WINDOW_MS`，旧 `PI_*` 名称仅保留一个兼容周期的 fallback。默认实现当前仍连接同一环境/区域级 AgentOS/Rivet Engine，独立 worker pool、credential 与 quota 尚未生产化。
- Agent 架构 S1–S3 已完成：Runtime 结构边界、provider-neutral contracts、Agent 领域表与默认 binding 基线已经落地；Backend invoke 现由 application service 按 Product DB Definition/Binding/session policy 编排，并在现有 Turn 固定 Definition/Adapter/session/policy/Project/reservation snapshot。新建 Space 会幂等创建默认 Pi binding，Runtime snapshot 与 Matrix v2 state 输出公开 Agent view，callback 优先按固定字段 fencing；真实 Synapse + Pi/provider 双 Chromium E2E 2/2 通过。S4 已进入 contracts-first：完整 lifecycle 端口、session summary/restore/cancel schema 与 Fake contract suite 已通过，Pi 和生产 Turn processor 尚未迁移。默认仍只开放 Pi且没有第二条 queue；生产共享 Engine 属于 S5。
- 官方目录现有 Default Chat 与四个差异化模板，共五个 `agentos-app-v1` Project；每个 Template 在仓库只维护一份普通的多文件 `app/` 工作项目和一个扁平 `releases.json`。当前有序序列为 `0.1.0 → 0.1.1 → 0.1.2`：`0.1.1` 修正 AgentOS 不可变 Release 的 `registry` 入口，`0.1.2` 修正全屏 Chat Header/Composer 并把浏览器 SDK 视图、消息渲染、Composer、启动订阅、Template controller 和 CSS 分区拆成可类型检查的职责模块；两者都不改变 SDK、权限、App State 或 Chat Core 语义。`src/index.ts` 仍只负责 Runtime/handler 装配；Artifact/Space Revision/Dev Preview/Agent 编辑均识别并校验完整项目树。Version 只引用按 hash 寻址的不可变 artifact，历史源码不按版本复制；独立发布/部署从统一 Registry/Object Store 取 artifact。共享协议与 codegen 强制首版、相邻 SemVer、最高 current、非空升版和最新源码 hash 一致；旧 `builtin` v1–v5 与误用的 `5.0.0` ID 仅作开发数据读取 alias。
- Alice 的现有定制 Space 已按同一 Project 协议迁移到 `space-default@0.1.2` 的模块化 Chat 基线；迁移保留其 App 自有深蓝动态视觉和 Published Release，只在 Runtime Candidate ready 后切换当前 ready Revision。
- 官方与用户 Template 的版本和市场协议已经统一：官方标记来自 `publisher.verification=official`，来源为 `repository`；App 来源用户样本使用同一结构和 `origin=app`。`/v1/spaces`、创建、收藏、Matrix snapshot、Runtime 与 Discover 不再依赖 `builtin` 类型。用户发布 API、审核与生产存储仍待实现。
- Backend 会向 opaque iframe 注入受信任 Space SDK shim，App 不需要网络脚本权限；真实成员 ID、共享 App state 和刷新恢复已在本地 Synapse 浏览器流程中验证。
- Space App SDK 首版已代理发送、附件、回复、编辑、删除、Reaction、重试、typing、已读与 member/agent Mention。Backend 不再把 Runtime 非 2xx 改写为包级 Default Chat HTML；Dev Preview 按 ready Revision 隔离并保留最近三个可寻址实例，候选构建/启动失败时 Web 继续挂载 Project 记录的最后 ready Revision。Kernel 的 Default Chat 恢复已实现：Backend 校验成员身份，Runtime 串行验证官方 Template Candidate 后才切换新的 ready Revision，并保持 Published Release、Matrix timeline 和 App State；该链路不调用 Agent 或 AI credits。
- AgentOS Apps 本地 Build VM 已通过显式 DNS 配置解决包安装解析失败，官方 `0.1.1` 入口同时导出 `registry`，Alice 的现有 Space 已从 `space-default@0.1.1` ready Revision 成功固化为 64 位内容寻址 Release。显式发布归属 Kernel；Host 只把真实 Agent 回复投影给可定制 App，不再把恢复、发布或 Runtime error 伪装成 Pi/成员对话。
- Host Pi 已真实生成共享计数器 Draft，Dev 与发布后的不可变 Live 均成功读取；定向 unit、TypeScript 和 Backend Node 构建已通过。
- 默认 `pnpm dev` 以仓库 `.node-version` 声明 Node 24.19.0，并在当前 shell 不兼容时自动切换本机 Node，不要求开发者修改 `PATH`；启动前会自愈 `better-sqlite3` ABI 不一致，并按最新 SQLite snapshot 检查表与列、自动补齐 schema、仅对全新空库 seed。随后初始化/启动本地 Synapse、Rivet Engine、Backend、Web、Site、Admin 与 Space Runtime；真实 Synapse Bootstrap、Matrix Room 创建和持久消息定向 E2E 已通过。
- 默认开发启动器现同时拥有本地 Rivet Engine 生命周期；Runtime 已删除本地 JSON Project/Instance/Turn adapter 和 `SPACE_RUNTIME_CONTROL_MODE` 开关，Project source 始终进入内容寻址 Object Store，pointer/snapshot/turn/lease/outbox 始终进入 Product DB，并由 Runtime 周期扫描、续租、接管和触发 reconciler。单元测试使用显式内存 adapter，不进入生产构建。Alice 的既有 Release 重启恢复仍是本地 Actor 证据；真实跨宿主 AgentOS artifact 恢复尚未验证。
- 仓库级 CI/CD 配置已迁移到 CircleCI：所有构建分支执行文档、类型、产品构建、文档站和 Web Docker 验证；`main` 通过人工批准后可部署 Backend Cloudflare Workers。CircleCI 项目接入、生产 Context 和首次真实部署证据仍在 [Active 迁移记录](./active/circleci-ci-cd-migration.md)中跟踪。
- 真实 Matrix Template Space 的 iframe Chat E2E 已覆盖发送、回复、Reaction 和刷新历史恢复；结构化 `@pi`、欢迎积分、Host Pi 回复、真实 usage 结算和 ready Revision 更新先有单浏览器运行证据，2026-08-27 又以真实 Pi/provider 和双 Chromium 自动化覆盖幂等 Matrix Agent event、刷新唯一恢复及双方 live App 收敛到同一新 ready Revision，Published Release 未被隐式改写。双 Chromium Candidate 失败保护已通过；真实 Synapse 的 member kick/leave 安全 E2E 也已覆盖全部八类 Runtime Gateway，并确认 Product DB 成员投影陈旧时仍以 Matrix 为权威。完整 Chromium 回归同轮为 56 通过、0 失败、3 个显式 Agent 开关场景跳过；Publish expected-revision 屏障、生产 control plane 和双 server takeover 已有代码与 unit 证据，但真实双进程/D1/R2/AgentOS 演练、空白 Space、历史 rollback 与完整 #40 未完成，因此 A3/A4 保持 Active。

## 当前约束

- 不得把 demo 的 guest identity、本地 JSON、无认证 bridge、固定 Pi 或 provider 补丁直接复制为生产实现。
- 不得删除或冻结 Space 市场；官方与用户 Template 必须使用同一协议、表和市场查询。用户发布的审核、签名、撤销和分成可以独立治理，但不得建立用户专用 Template 类型。
- 不得让 App/Agent 改造降低联系人、邀请、消息、媒体、关系事件、已读、typing、Mention、`@agent` 或错误恢复能力；UI 可任意变化，平台能力与语义不可变化。
- 不得为多人 Space 新建平行实例表、成员权威、消息 timeline 或 Runtime 类型；一对一与多人必须共用 `SpaceInstanceService/Repository/Server`。
- Space App 必须复用 Better Auth、Matrix、权限、积分和同源 API，不能建立第二套身份、消息或账本权威。
- Node/VM/Agent/长连接 Runtime 与 Cloudflare Backend 分离；`apps/space-runtime` 固定采用 demo 同构的 Node 22 + TypeScript + Hono、SSE/command、Instance Server、ProjectStore 和 agentOS Apps 技术链，公共契约进入 workspace packages。
- 用户可见文本统一使用 Space 语义和 i18n key；Matrix Room 只在技术与兼容语境出现。
- Agent 请求覆盖权限、显式寻址、积分预留、结算、失败退款和对账；公共契约不得绑定 Pi。
- Generated App 按不可信代码处理，不能获得 Cookie、Matrix token、Agent 凭据、源码管理、发布或默认外部网络；Chat 与 Agent 只能通过版本化 SDK 和结构化 Mention 调用。
- 每个切片必须在真实 TanStack Host、真实 Synapse 和目标 Runtime provider 中走查，不用 fixture 掩盖不可用状态。

## 文档治理

- 稳定设计只描述目标与不变量；当前实现、Space App 差距和 demo 证据写入开发中文档。
- 未有代码、测试或运行证据的 Space App/Agent 能力不得标记 Complete，也不得写成发布说明。
- 用户可见行为实际切换时，同步更新公开文档、TEST-CATALOG、API 参考和 Runbook。
- 现有市场与 Chat 文档继续维护；只有真实被替代的技术兼容入口才按生命周期归档。
