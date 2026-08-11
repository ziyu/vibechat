# 完整消息操作与资料基础实施记录

> 生命周期：开发中
> 文档类型：计划
> 状态：Complete（A2 收口切片）
> 更新日期：2026-08-12
> 维护范围：Matrix 日常消息操作、离线恢复、首次资料设置、资料更新与联系人备注
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 完成边界

- Matrix adapter 使用 `m.room.message`、`m.replace`、redaction 与 `m.typing` 表达文字、媒体、编辑、删除和正在输入；宿主把关系事件投影回原消息位置。
- 图片和文件先上传 Synapse media repository，再发送 `m.image` 或 `m.file`；界面只保留远端内容 URI 和元数据，不把媒体内容或文件句柄写入 localStorage。
- 会话搜索覆盖已加载消息正文和附件名称；被删除内容不再作为可读搜索结果。
- 失败发送复用 Matrix SDK 已存在的 pending event 和 transaction ID 重发，避免离线恢复产生重复事件；重连采用有限退避并监听浏览器 online 事件。
- `user_profiles.onboarding_completed_at` 同步进入 PostgreSQL 与 SQLite/D1 migration。新账号被聊天宿主守卫到 `/onboarding`，完成昵称和唯一用户名后才进入 Matrix 消息页。
- `GET/PATCH /v1/profile` 和共享 schema/service/repository 提供资料读写、唯一用户名冲突和稳定错误；“我的”页面热更新产品资料与当前 Matrix display name，不依赖整页刷新。
- `PATCH /v1/contacts/:userId` 只允许联系人写入方向性备注；备注只覆盖设置者自己的联系人、选人和成员投影，清空后恢复公开昵称。

## 验证证据

- identity/rooms/social 相关 Vitest：10 个文件、34/34。
- TEST-CATALOG #33：双 Chromium context + 本地 Synapse，1/1；覆盖 typing、编辑、删除、媒体、搜索、刷新恢复、凭据隔离和离线幂等重发。
- TEST-CATALOG #34：双 Chromium context + SQLite/本地 Synapse，1/1；覆盖首次守卫、资料校验/唯一性、头像失败恢复、资料热更新和私有备注权限。
- 聊天基础全量 Playwright：15/15，覆盖 OTP、fixture、真实 Matrix 房间/消息、社交邀请、会话管理和 device 撤销。
- TanStack TypeScript、生产 client/SSR build 通过；Cloudflare 本地预览在应用 0000–0008 D1 migration 后，SSR 首页返回 200，未认证 bootstrap 返回预期 401 产品错误。
- in-app Browser 人工走查完成“新邮箱 OTP → 首次资料设置 → Matrix 消息页”，控制台没有业务错误。

## 已记录的普通问题

- Matrix SDK 客户端 chunk 约 815 KB，crypto WASM 约 7.8 MB；当前未初始化 E2EE，不影响基础链路，后续按会话能力做懒加载和 bundle 拆分。
- 本地 Cloudflare preview 需要配置 `BETTER_AUTH_SECRET` 并先执行 D1 migration；缺失可选邮件、短信、OAuth 和存储变量时会给出开发 warning 或可恢复头像上传错误。
- Matrix SDK 会记录默认 push rule warning；当前未实现 Web Push，不影响 timeline 同步。
- 注册压力回归可能触发 Better Auth 限流；E2E helper 已用有限指数退避恢复。
- Radix 对话框仍有一处 description 无障碍 warning，交互不受影响，进入无障碍专项时处理。

## 下一出口

A2 身份、社交和 Matrix 消息底座已完成。下一工作流是 A3 氛围空间 Runtime：先定义 manifest、宿主协议、capability、权限提示和 iframe sandbox 验收，再开始实现。
