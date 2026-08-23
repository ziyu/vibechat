# 聊天宿主与产品状态参考

> 生命周期：长期稳定
> 文档类型：参考资料
> 状态：生效
> 更新日期：2026-08-22
> 维护范围：TanStack Start Web 应用、`packages/api-contracts`、`packages/auth-client`、`packages/product-*`、`packages/matrix-client`、产品状态 API 与聊天 E2E
> 不包含：Space App Runtime、Agent queue、Draft/Release、Web Push 与生产部署拓扑

## 目标

聊天宿主已经从前端 fixture 切换为 Better Auth、产品数据库与 Matrix/Synapse 的真实投影。本文记录当前可维护的宿主边界；服务不可用时产品显式失败关闭，不再生成演示账号、联系人、房间或本地模拟 mutation。

目标范围与长期约束以 [VibeChat MVP 产品与技术设计](../designs/vibechat-mvp-product-and-technical-design.md) 为准。2026-08-22 目标确认为 Chat-first Space App；本文中的内置 Space 目录、收藏、模板版本和 `spaceId` 是 A3 必须保持的市场与创建基线。

## 已实现能力

- `/messages`：从 Matrix 投影统一会话列表、未读、搜索和邀请；置顶与静音保存到产品数据库。
- `/rooms/:roomId`：真实 Matrix timeline、local echo、失败重试、回复、回应切换、媒体、编辑、删除、typing、read receipt 和恢复。
- 新建聊天：从产品联系人和服务端内置空间目录选择，产品 API 校验参与人权限后幂等创建 Matrix 房间。
- `/contacts`：产品 API 驱动的用户搜索、好友请求、联系人、私有备注和屏蔽。
- `/discover` 与 `/discover/spaces/:spaceId`：服务端 `builtin` 目录、版本/能力摘要和账号隔离的收藏；未实现的第三方市场不会显示为已上线。
- `/me`：产品资料/头像、服务端通知/主题/语言偏好、Better Auth 浏览器会话、隐私和 Matrix SDK 缓存清理。
- 桌面三栏/双栏、移动单列与房间内隐藏底部导航。
- 所有产品路由统一认证守卫；Matrix 缺失或启动失败时展示可重试错误态。

## 代码边界

### 共享 Package 层

跨宿主边界已拆为真正的 pnpm workspace packages：

- `@vibechat/api-contracts`：session/profile、social、room、space 与 preference 的 Zod 输入/输出 schema。
- `@vibechat/auth-client`：浏览器安全的 Better Auth React client 与可注入 Backend base URL 的 factory；不包含 server auth、数据库或密钥配置。
- `@vibechat/product-core`：`ChatRoom`、`ChatMessage`、`ChatPerson`、`AtmosphereSpace` 以及排序、搜索、消息追加和时间格式化。
- `@vibechat/product-client`：可注入 API origin 与 transport 的产品 HTTP client；Web 使用同源网关，未来 Desktop 可使用独立 Backend origin。
- `@vibechat/matrix-client`：`matrix-js-sdk` 生命周期、消息操作和产品 view model 投影；IndexedDB 由宿主注入。
- `@vibechat/platform-contracts`：导航、存储、网络、定时器和 IndexedDB 的宿主能力端口。

上述 packages 均有独立 `package.json`、exports、tsconfig、依赖声明和 build/typecheck。`product-core`、contracts 与 platform contracts 不依赖 React 或 TanStack Router；`auth-client` 只依赖 Better Auth 和 React peer，不得导入服务端 `libs/auth`。当前 React screens 尚在 Web 内，待路由依赖通过 adapter 完成后再迁入 `product-react`。

### 应用与服务状态层

`apps/web-app/src/features/chat/chat-store.tsx` 负责：

- 读取真实 session bootstrap、产品状态、服务端空间目录和社交快照。
- 启动一个 browser-only Matrix client，并将 room/timeline/presence 投影为宿主 view model。
- 对页面暴露真实 action；失败时保持服务端/Matrix 状态，不创建本地假记录。
- 以 `connecting/ready/unavailable/error` 明确表达服务状态。

Chat feature 不再直接发起产品 API `fetch`；请求统一通过 `@vibechat/product-client`。Web 的导航、存储、联网和 IndexedDB adapter 位于 `apps/web-app/src/lib/product-platform.ts`。

`libs/product-state` 通过 repository/service 保存用户偏好、每房间偏好和空间收藏。PostgreSQL 与 SQLite/D1 使用相同领域契约；API 必须校验 Better Auth session、房间参与权和内置空间 ID。

`libs/rooms` 与物理 `room_index` 是统一 SpaceInstance 的现有基础，不是待迁移到另一套多人实例的临时对象。A3 会在同一记录上增加稳定 `spaceInstanceId` 和 Project 指针，并把领域命名演进为 `SpaceInstanceService/Repository`；现有一对一、群聊和新增多人 Space 都映射同一个 Matrix Room 与逻辑 SpaceInstanceServer。

`data-ready="true"` 仅表示产品状态与 Matrix sync 已达到可操作状态，E2E 必须等待该信号后再操作。

### 页面与宿主边界

`apps/web-app/src/features/chat/*-page.tsx` 只组合页面和调用 action。宿主一级导航、控制岛、权限摘要、恢复入口与预览状态始终位于氛围画布边界之外。

当前 Space 画布是官方内置 React 画布，不是隔离 Space App。进入新 Runtime 阶段后，画布区域演进为每个 Space 独有的 App；完整 Chat 和 Kernel 由 Host 固定持有，源码、生成状态、发布与恢复属于 Kernel，不形成 Studio 第四边界。现有市场继续作为 Space Template 来源。

## 数据权威与缓存

1. Better Auth session 与产品 profile 是账号和展示资料权威。
2. 产品数据库当前是联系人、好友请求、屏蔽、备注、用户偏好、Space 偏好、模板收藏和统一 SpaceInstance（物理表 `room_index`）权威；模板收藏继续保留。
3. Matrix/Synapse 是 room membership、timeline、关系事件、presence、typing、read receipt 和媒体内容 URI 权威。
4. `config/chat.ts` 与 `GET /v1/spaces` 是当前官方 Space Template 目录事实；Space App 契约必须保持兼容，并在未来数据化市场时通过同一领域契约演进。
5. Matrix token 只通过内存 bootstrap 进入 SDK；Matrix SDK IndexedDB 只保存允许的 sync/timeline 缓存。
6. localStorage 不是任何产品资料、联系人、收藏、偏好或消息正文的权威副本；旧聊天 storage key 在启动和清理时删除。

## 验收

产品状态与 package 边界验收分别记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) #35 和 #37；活动 Playwright 全量回归 36/36，package/领域单测 45/45。
