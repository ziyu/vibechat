# 聊天宿主与产品状态参考

> 生命周期：长期稳定
> 文档类型：参考资料
> 状态：生效
> 更新日期：2026-08-12
> 维护范围：TanStack Start Web 应用、`libs/chat`、产品状态 API 与聊天 E2E
> 不包含：第三方空间市场、iframe Runtime、Web Push 与生产部署拓扑

## 目标

聊天宿主已经从前端 fixture 切换为 Better Auth、产品数据库与 Matrix/Synapse 的真实投影。本文记录当前可维护的宿主边界；服务不可用时产品显式失败关闭，不再生成演示账号、联系人、房间或本地模拟 mutation。

目标范围与长期约束以 [VibeChat MVP 版本产品与技术设计](../designs/vibechat-mvp-product-and-technical-design.md) 为准。

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

### 共享领域层

`libs/chat/*` 定义前端当前使用的最小领域契约：

- `ChatRoom`、`ChatMessage`、`ChatPerson`、`AtmosphereSpace` 和产品状态响应契约。
- 会话排序、搜索、消息追加和时间格式化。
- session/profile、social、room、space 与 preference 的共享输入/输出 schema。

这些函数不依赖 React 或 TanStack Router。接入真实服务时，可以继续作为视图模型和纯规则层使用。

### 应用与服务状态层

`apps/web-app/src/features/chat/chat-store.tsx` 负责：

- 读取真实 session bootstrap、产品状态、服务端空间目录和社交快照。
- 启动一个 browser-only Matrix client，并将 room/timeline/presence 投影为宿主 view model。
- 对页面暴露真实 action；失败时保持服务端/Matrix 状态，不创建本地假记录。
- 以 `connecting/ready/unavailable/error` 明确表达服务状态。

`libs/product-state` 通过 repository/service 保存用户偏好、每房间偏好和空间收藏。PostgreSQL 与 SQLite/D1 使用相同领域契约；API 必须校验 Better Auth session、房间参与权和内置空间 ID。

`data-ready="true"` 仅表示产品状态与 Matrix sync 已达到可操作状态，E2E 必须等待该信号后再操作。

### 页面与宿主边界

`apps/web-app/src/features/chat/*-page.tsx` 只组合页面和调用 action。宿主一级导航、控制岛、权限摘要、恢复入口与预览状态始终位于氛围画布边界之外。

当前房间画布是官方内置 React 画布，不是第三方 iframe，也不会伪装成已发布第三方空间。进入 Runtime 阶段后，画布区域将替换为经过 manifest、签名、hash、sandbox 和 capability 握手的 iframe；会话列表、路由、控制岛和恢复视图不需要因此重写。

## 数据权威与缓存

1. Better Auth session 与产品 profile 是账号和展示资料权威。
2. 产品数据库是联系人、好友请求、屏蔽、备注、用户偏好、房间偏好、空间收藏和 room index 权威。
3. Matrix/Synapse 是 room membership、timeline、关系事件、presence、typing、read receipt 和媒体内容 URI 权威。
4. `config/chat.ts` 是当前官方内置空间版本目录；`GET /v1/spaces` 是浏览器唯一目录入口，并明确返回 `source: builtin`。
5. Matrix token 只通过内存 bootstrap 进入 SDK；Matrix SDK IndexedDB 只保存允许的 sync/timeline 缓存。
6. localStorage 不是任何产品资料、联系人、收藏、偏好或消息正文的权威副本；旧聊天 storage key 在启动和清理时删除。

## 验收

验收场景记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) 的“登录后产品状态真实化”，自动化实现位于 [`tests/e2e/specs/chat-real-product-state.spec.ts`](../../../tests/e2e/specs/chat-real-product-state.spec.ts)。
