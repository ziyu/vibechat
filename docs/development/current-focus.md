# 当前开发重点

> 生命周期：开发中
> 状态：工程基线
> 更新日期：2026-08-23
> 维护范围：当前实现事实、近期主线和跨应用工程约束
> 稳定来源：[VibeChat MVP 产品与技术设计](../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 当前阶段

仓库已完成 VibeChat 产品 Web 宿主、A2 真实聊天闭环，以及账户、定价、积分、推荐、提现、支付和 AI 能力迁移。Email OTP、产品 profile、Matrix identity/device、session revoke、真实 Matrix room/timeline、社交邀请、完整消息操作、Space 市场基础、产品状态和多应用/package 边界均有测试或浏览器证据。

2026-08-22 产品设计确认以 **Space** 为用户语义，以完整 **Chat** 为产品基础，并在其上增加可定制 **App** 和可插拔 **Agent**。Space 保留市场与模板创建，空白 Space 也可创建并在之后应用模板。界面只有 Kernel、Chat、App 三个边界；Pi 只是首个候选 Agent Adapter。Space Runtime 明确采用与 `chat-app-server` 同构的 Node/Hono、实例服务器、SSE/command、串行 Turn、ProjectStore、agentOS Apps Dev/Release 和 SDK 技术链。设计依据、demo 核验和差距见 [Space App 设计演进与实施记录](./active/space-app-design-transition.md)。

当前主线是 A3/A4 首版切片验证和生产化：

1. 保留 `/v1/spaces`、Discover、分类、收藏、模板版本和现有 `spaceId/spaceVersionId` 创建链路。
2. 在已原地升级的 `room_index` 和统一 SpaceInstance 上补齐 Product DB/Object Store、v2 state、outbox 与多副本 lease。
3. 加固已接通的独立 `apps/space-runtime`、短期内部认证、Runtime/Agent provider 和网络边界。
4. 在保持真实 Matrix Chat/社交/市场回归的前提下增加空白 Space 创建与模板后应用。
5. 以 TEST-CATALOG #40 推进 Kernel/Chat/App、Space SDK、Agent Adapter、Space Dev 和 publish barrier。

## 当前实现事实

- `apps/site-app` 是公开官网，`apps/web-app` 是产品 Web/PWA，`apps/backend` 是共享产品 API，`apps/admin-app` 是独立运营宿主，`apps/docs-app` 是文档站。
- Web 与 Admin 通过各自同源网关访问 Backend；业务 handler、数据库、支付/AI provider、积分和存储仍只属于 Backend。
- 十个跨宿主能力已是实际 workspace packages；Better Auth 仍是浏览器身份权威。
- Matrix 是当前 Space membership 和 Chat timeline 权威；底层实现和兼容 API 仍使用 Matrix Room/`roomId`。
- 当前 `room_index` 的每条记录已经是统一 SpaceInstance 的物理基础；`POST /v1/rooms`、Discover、官方 Space 目录、收藏、`spaceId/spaceVersionId` 和 `io.vibechat.space.instance.v1` 都是必须保持的活动行为。
- `apps/space-runtime`、Space App contracts/SDK、Backend membership gateway、通用 Agent Adapter、Space Dev、Draft/Release 和 Web Kernel/Chat/App 已形成可运行的首版纵向切片。
- Host Pi 已真实生成共享计数器 Draft，Dev 与发布后的不可变 Live 均成功读取；定向 unit、TypeScript 和 Backend Node 构建已通过。
- 默认 `pnpm dev` 已可自动准备 SQLite、初始化/启动本地 Synapse，并启动 Backend、Web、Site、Admin 与 Space Runtime；真实 Synapse Bootstrap、Matrix Room 创建和持久消息定向 E2E 已通过。
- 真实 Synapse 双浏览器 #40 Agent/App 协作 E2E、Agent 回复 Matrix 回写、真实 usage 结算、生产持久化与跨副本接管尚未完成，因此 A3/A4 保持 Active。

## 当前约束

- 不得把 demo 的 guest identity、本地 JSON、无认证 bridge、固定 Pi 或 provider 补丁直接复制为生产实现。
- 不得删除或冻结 Space 市场；当前官方目录可以继续演进，第三方发布需要独立评审和审核链路。
- 不得让 App/Agent 改造降低联系人、邀请、消息、媒体、关系事件、已读、typing 或错误恢复能力。
- 不得为多人 Space 新建平行实例表、成员权威、消息 timeline 或 Runtime 类型；一对一与多人必须共用 `SpaceInstanceService/Repository/Server`。
- Space App 必须复用 Better Auth、Matrix、权限、积分和同源 API，不能建立第二套身份、消息或账本权威。
- Node/VM/Agent/长连接 Runtime 与 Cloudflare Backend 分离；`apps/space-runtime` 固定采用 demo 同构的 Node 22 + TypeScript + Hono、SSE/command、Instance Server、ProjectStore 和 agentOS Apps 技术链，公共契约进入 workspace packages。
- 用户可见文本统一使用 Space 语义和 i18n key；Matrix Room 只在技术与兼容语境出现。
- Agent 请求覆盖权限、显式寻址、积分预留、结算、失败退款和对账；公共契约不得绑定 Pi。
- Generated App 按不可信代码处理，不能获得 Cookie、Matrix token、Agent 凭据、源码管理、发布或默认外部网络。
- 每个切片必须在真实 TanStack Host、真实 Synapse 和目标 Runtime provider 中走查，不用 fixture 掩盖不可用状态。

## 文档治理

- 稳定设计只描述目标与不变量；当前实现、Space App 差距和 demo 证据写入开发中文档。
- 未有代码、测试或运行证据的 Space App/Agent 能力不得标记 Complete，也不得写成发布说明。
- 用户可见行为实际切换时，同步更新公开文档、TEST-CATALOG、API 参考和 Runbook。
- 现有市场与 Chat 文档继续维护；只有真实被替代的技术兼容入口才按生命周期归档。
