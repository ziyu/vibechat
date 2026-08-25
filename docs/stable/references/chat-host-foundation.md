# 聊天宿主与产品状态参考

> 生命周期：长期稳定
> 文档类型：参考资料
> 状态：生效
> 更新日期：2026-08-24
> 维护范围：TanStack Start Web 应用、产品与 Space App workspace packages、产品状态/Space Runtime API 与聊天 E2E
> 不包含：生产 Agent queue、生产 Project/Object Store、Web Push 与部署拓扑

## 目标

聊天宿主已经从前端 fixture 切换为 Better Auth、产品数据库与 Matrix/Synapse 的真实投影。本文记录当前可维护的宿主边界；服务不可用时产品显式失败关闭，不再生成演示账号、联系人、房间或本地模拟 mutation。

目标范围与长期约束以 [VibeChat MVP 产品与技术设计](../designs/vibechat-mvp-product-and-technical-design.md) 为准。2026-08-22 目标确认为 Chat-first Space App；本文中的 Space Template 目录、收藏、版本和 `spaceId` 是 A3 必须保持的市场与创建基线。2026-08-23 起官方和用户 Template 共用协议，当前目录仍只装载官方 Publisher。

## 已实现能力

- `/spaces`：从 Matrix 与产品索引投影当前用户的 Space 列表、未读、搜索、成员、模板/App 视觉和邀请；置顶与静音保存到产品数据库。
- `/spaces/:spaceId`：同一 SpaceInstance 的固定 Kernel Bar 与单一隔离 App。真实 Matrix Chat timeline、local echo、失败重试、回复、回应切换、媒体、编辑、删除、typing、read receipt 和恢复属于不可修改的 Chat Core，并由 App 通过 SDK 呈现；Host 不渲染第二套 Chat UI。
- `/messages` 与 `/rooms/:roomId`：只保留兼容重定向，不再作为导航、回跳或测试生成的产品 URL。
- 新建 Space：从产品联系人和服务端官方 Space Template 目录选择固定版本，产品 API 校验参与人权限后幂等创建 Matrix Room/SpaceInstance；Runtime 立即复制独立 App Project 并准备 Dev App。
- `/contacts`：产品 API 驱动的用户搜索、好友请求、联系人、私有备注和屏蔽。
- `/discover` 与 `/discover/spaces/:spaceId`：服务端统一 `SpaceTemplateMarketEntry` 目录、Publisher verification、版本/能力摘要和账号隔离的收藏；用户发布尚未开放时不会显示不存在的社区条目。
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
- `@vibechat/space-templates`：官方/用户共用的 Template、Version、Artifact 与 Market entry 协议，以及每个官方 Template 唯一 `app/` 工作源码；Backend 目录与 Node/Hono Space Runtime 共用同一契约，生产 artifact 由统一 Registry/Object Store 解析。
- `@vibechat/space-app-contracts` / `@vibechat/space-app-sdk`：Runtime snapshot/command 合约与 opaque iframe 内的成员、state、event、Chat 和 theme SDK。

上述 packages 均有独立 `package.json`、exports、tsconfig、依赖声明和 build/typecheck。`product-core`、contracts 与 platform contracts 不依赖 React 或 TanStack Router；`auth-client` 只依赖 Better Auth 和 React peer，不得导入服务端 `libs/auth`。当前 React screens 尚在 Web 内，待路由依赖通过 adapter 完成后再迁入 `product-react`。

### 应用与服务状态层

`apps/web-app/src/features/chat/chat-store.tsx` 负责：

- 读取真实 session bootstrap、产品状态、服务端空间目录和社交快照。
- 启动一个 browser-only Matrix client，并将 room/timeline/presence 投影为宿主 view model。
- 对页面暴露真实 action；失败时保持服务端/Matrix 状态，不创建本地假记录。
- 以 `connecting/ready/unavailable/error` 明确表达服务状态。

Chat feature 不再直接发起产品 API `fetch`；请求统一通过 `@vibechat/product-client`。Web 的导航、存储、联网和 IndexedDB adapter 位于 `apps/web-app/src/lib/product-platform.ts`。

`libs/product-state` 通过 repository/service 保存用户偏好、每房间偏好和 Template 收藏。PostgreSQL 与 SQLite/D1 使用相同领域契约；API 必须校验 Better Auth session、房间参与权和已发布 Template ID。当前静态官方 adapter 与未来数据库目录注入同一种 Market entry。

`libs/rooms` 与物理 `room_index` 是统一 SpaceInstance 的现有基础，不是待迁移到另一套多人实例的临时对象。每条记录已保存稳定 `spaceInstanceId`、Project ID、默认 Agent 和 Template lineage；现有一对一、群聊和新增多人 Space 都映射同一个 Matrix Room 与逻辑 SpaceInstanceServer。

`data-ready="true"` 仅表示产品状态与 Matrix sync 已达到可操作状态，E2E 必须等待该信号后再操作。

### 页面与宿主边界

`apps/web-app/src/features/chat/*-page.tsx` 只组合页面和调用 action。宿主一级导航、控制岛、权限摘要、恢复入口与预览状态始终位于氛围画布边界之外。

当前页面只固定顶部 Kernel Bar，其下由每个 Space 独有的 opaque iframe App 渲染；完整 Chat 能力由 Host/Matrix/SDK 固定持有，Chat UI 属于 App Project。源码、Agent 状态、实时版本、发布与恢复属于 Kernel，不形成 Studio 第四边界。官方模板创建和历史 v1 lineage 都由 Runtime 幂等 bootstrap 独立 Project。Dev Preview 为每个 ready Revision 保留独立、固定版本的运行实例；Candidate 失败不终止最后 ready App。Backend 对 Runtime 非 2xx 保持原始失败状态，不在 Template Project 外合成 Default Chat 页面；显式恢复 Default Chat 会创建新的受管 Revision。

## 数据权威与缓存

1. Better Auth session 与产品 profile 是账号和展示资料权威。
2. 产品数据库当前是联系人、好友请求、屏蔽、备注、用户偏好、Space 偏好、模板收藏和统一 SpaceInstance（物理表 `room_index`）权威；模板收藏继续保留。
3. Matrix/Synapse 是 room membership、timeline、关系事件、presence、typing、read receipt 和媒体内容 URI 权威。
4. `@vibechat/space-templates` 是当前官方 Space Template 版本与初始 Project 的代码事实；`config/chat.ts` 只提供兼容投影，`GET /v1/spaces` 暴露 `versionId`、`integrity` 和 `projectFormat`。未来数据化市场必须通过同一领域契约演进。
5. Matrix token 只通过内存 bootstrap 进入 SDK；Matrix SDK IndexedDB 只保存允许的 sync/timeline 缓存。
6. localStorage 不是任何产品资料、联系人、收藏、偏好或消息正文的权威副本；旧聊天 storage key 在启动和清理时删除。

## 验收

产品状态、package 边界与 Space App Template 迁移验收分别记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) #35、#37 和 #40；执行结果以目录中的最新证据为准。
