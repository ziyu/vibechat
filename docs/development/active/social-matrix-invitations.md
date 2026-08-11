# 社交关系与 Matrix 邀请实施记录

> 生命周期：开发中
> 文档类型：计划
> 状态：Complete（本切片）
> 更新日期：2026-08-12
> 维护范围：好友请求、联系人、屏蔽、房间参与者 ACL、Matrix 邀请与浏览器会话管理
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 完成边界

- PostgreSQL 与 SQLite/D1 共享 `friend_requests`、`contacts`、`blocks` schema；产品用户 ID 是社交关系权威，Matrix ID 只在建房 service 中解析。
- 精确邮箱或用户名搜索排除自己及任一方向的屏蔽关系；好友申请幂等，接受时原子写入双向联系人。
- 屏蔽会移除双向联系人、终止 pending 请求，并优先阻止新的好友申请和房间邀请；解除后必须重新建立好友关系。
- `room_index` 保存精确产品参与者 ACL；受邀客户端通过认证的元数据 lookup 补全 Matrix stripped invite state 缺少的氛围信息。
- 宿主支持发送/接受/拒绝好友申请、从联系人 UI 建房、接受/拒绝 Matrix 邀请、查看黑名单和解除屏蔽。
- “我的 / 设备与会话”使用 Better Auth 原生 session API；远端撤销通过既有 lifecycle/outbox 回收 Matrix device。
- 当前退出先停止 Matrix client、删除该 device 的 Matrix SDK IndexedDB 与 UI 偏好，再退出 Better Auth；access token 不写入 localStorage。
- `matrix-js-sdk` 仅在浏览器动态加载，并由 Vite 转译内部 ESM 目录导入，避免 SSR/HMR 的 Node ESM 冲突。

## 验证证据

- identity/rooms/social unit、SQLite repository 与 mock HTTP：32/32。
- TEST-CATALOG #31：双 Chromium context + 本地 Synapse 全链路通过，覆盖搜索、申请幂等、双向联系人、产品 ACL、邀请接受、双向消息/回复、屏蔽与解除。
- TEST-CATALOG #32：双 Chromium context 会话管理通过，覆盖会话列表、远端 session/Matrix device 撤销、当前退出和 IndexedDB 清理。
- 聊天 fixture/真实 Matrix/社交/会话整合浏览器回归：10/10（修正测试锚点后有效结果）。
- TanStack 应用级 `tsc --noEmit` 通过。

## 已记录的普通问题

- Matrix SDK 客户端 chunk 与 crypto WASM 体积较大；当前未初始化 E2EE，不影响基础链路，后续做懒加载与 bundle 拆分。
- Radix 对话框在开发日志中仍有一处 description 警告；不影响交互，进入无障碍专项时修复。
- 本地 E2E 连续创建账号会触发 Better Auth 注册限流，测试 helper 已按指数退避重试。

## 下一出口

继续完成 A2 剩余 Matrix adapter 能力：媒体、编辑、删除、typing、历史搜索与离线失败恢复；同时补齐用户资料首次设置和备注名。
