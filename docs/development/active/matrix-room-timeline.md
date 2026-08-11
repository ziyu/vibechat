# 真实 Matrix 房间与 Timeline 实施记录

> 生命周期：开发中
> 文档类型：计划
> 状态：Complete（本切片）
> 更新日期：2026-08-12
> 维护范围：产品 room index、Matrix 建房、浏览器同步、消息关系与本地缓存
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 完成边界

- `POST /v1/rooms` 使用 Better Auth session 和已绑定 Matrix device，校验内置氛围版本与参与人 Matrix identity，并以 creator + client request ID 幂等创建私有 Matrix room。
- PostgreSQL 与 SQLite/D1 的 `room_index` 保存 Matrix room、氛围版本、创建者与 instance config；氛围实例快照同时写入 `io.vibechat.space.instance.v1` Matrix state event。
- 浏览器只创建一个 `matrix-js-sdk` client；SDK 使用 IndexedDB 保存 sync/timeline cache，Matrix access token 仅来自内存中的 session bootstrap，不写入 localStorage。
- 宿主将真实 Matrix room、成员、`m.room.message`、reply relation 和 `m.reaction` 投影到既有视图契约。
- 消息发送使用唯一 transaction ID；宿主保留 transaction local echo，远端确认后替换为 event ID，失败时进入 failed 状态。
- Synapse 未配置或用户未登录时保留明确的 fixture 模式，界面标识不会把它描述成远端数据。

## 验证证据

- identity/rooms unit、SQLite repository 与 mock HTTP：26/26。
- TEST-CATALOG #30 Chromium + 本地 Synapse：2/2，覆盖未认证错误、幂等产品建房、Matrix state、participant/space 错误、transaction 重试、sending/sent、回复、回应、刷新恢复和 localStorage token 隔离。
- TanStack 应用级 `tsc --noEmit` 通过。

## 下一出口

产品层好友请求、双向联系人、屏蔽约束和双用户邀请已经在[社交关系与 Matrix 邀请](./social-matrix-invitations.md)中完成；媒体、编辑/删除、typing、历史搜索、离线恢复与资料链路已经在[完整消息操作与资料基础](./matrix-message-profile-foundation.md)中完成。A2 至此闭环。
