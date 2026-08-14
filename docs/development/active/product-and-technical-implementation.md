# VibeChat MVP 产品与技术设计 Active 实施跟踪

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-12
> 维护范围：VibeChat MVP 产品与技术设计的实施、验收与决策闭环
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 1. 文档职责

稳定设计定义目标状态和长期约束；本文件记录从当前仓库到目标状态的实际开发进展。设计是否写完与功能是否实现是两件事，任何“已完成”都必须附代码、测试或运行证据。

本文件不复制稳定设计正文。目标或约束发生变化时，先在开发中形成变更提案，评审后更新稳定设计；这里只同步实施影响。

## 2. 当前结论

> **产品实现状态：A1、A2 已完成，下一主线为 A3。**

仓库已有 TanStack Start 工程骨架、共享 SaaS 能力、Vibe Chat 品牌和文档基线，但这些不能证明产品与技术设计中的核心能力已经实现。

截至 2026-08-12，已经形成以下实现证据：

- `/messages`、`/contacts`、`/discover`、`/me`、`/rooms/:roomId` 目标信息架构已在 TanStack Start 中实现。
- `packages/api-contracts`、`auth-client`、`product-core`、`product-client`、`matrix-client` 与 `platform-contracts` 提供有独立 exports、依赖声明和构建门槛的跨宿主边界；未配置环境显式失败关闭。
- `tests/e2e/specs/chat-real-product-state.spec.ts` 覆盖产品路由守卫、空账号、服务端目录、收藏、偏好和账号隔离。
- [聊天宿主与产品状态参考](../../stable/references/chat-host-foundation.md)记录了当前实现边界与数据权威。
- Better Auth Email OTP、持久化产品 profile、Matrix identity/session binding、session revoke worker、Synapse Appservice adapter、room index 和 integration outbox 已形成可执行实现。
- 浏览器 `matrix-js-sdk` 已接管 room/timeline，同步缓存、local echo、消息、回复、回应和 transaction ID 幂等均通过本地 Synapse/Chromium 验证。
- 产品好友请求、双向联系人、屏蔽、房间参与者 ACL、Matrix 邀请确认与双浏览器会话管理已经通过真实链路验证。
- Matrix 媒体、编辑、删除、typing、历史搜索和离线 pending event 幂等重发已经通过双用户真实链路验证。
- 新用户首次资料设置、资料热更新、唯一用户名和私有联系人备注已接入产品 profile 与社交投影。
- identity/rooms/social/product-state 与新 product packages 相关单测 45/45；活动产品 Chromium 全量回归 36/36；六个 package 与 Backend/Web/Site 根级 typecheck/build、Workers build/health 和文档构建通过。

尚未实现的产品专属范围包括氛围空间 iframe Runtime、CLI/审核链路和生产恢复体系；它们分别进入 A3、A4 和 A5，不再属于聊天基础闭环。

## 3. 状态定义

| 状态 | 含义 | 证据要求 |
| --- | --- | --- |
| 未开始 | 尚未形成可执行 spec 或代码 | 无 |
| Active | 已有验收场景并正在实现 | TEST-CATALOG 条目、开发分支或变更集 |
| Blocked | 有明确外部决策或依赖阻塞 | 阻塞原因、责任边界、解除条件 |
| Complete | 稳定设计中的该范围已实现 | 代码入口、测试结果、浏览器/运行证据 |

不得使用“基本完成”“差不多”等不可验证状态。

## 4. 工作流与设计追踪

| ID | 工作流 | 对应稳定设计 | 当前状态 | 当前证据 | 下一出口 |
| --- | --- | --- | --- | --- | --- |
| A0 | 工程基线与差距盘点 | §4、§12、§13、§14 阶段 0 | Active | TanStack 应用、文档分类、构建基线已存在 | 完成目标路由、依赖和旧脚手架保留/删除清单 |
| A1 | 产品壳与信息架构 | §5 | Complete | `packages/product-core`、`packages/product-client`、`packages/matrix-client`、`apps/web-app/src/features/chat` 与目标路由 | 保持宿主契约稳定；继续把 router-bound screens 迁入 `product-react` |
| A2 | 身份、社交与 Matrix 消息底座 | §8、§9、§10、§14 阶段 1 | Complete | Email OTP、identity/device、session revoke、Matrix timeline、社交、资料与[登录后产品状态真实化](./real-product-state-cutover.md)均通过本地 Synapse；19/19 聊天 E2E | 维持真实服务边界与回归，转入 A3 |
| A3 | 氛围空间 Runtime | §6、§14 阶段 2 | 未开始 | 无 | manifest、协议、capability 与沙箱 spec 可执行 |
| A4 | 开发、发布、市场与审核 | §7、§8.6、§14 阶段 3 | 未开始 | 无 | CLI、模拟宿主、版本与审核流程验收通过 |
| A5 | 安全、生产与恢复 | §11、§12、§13、§14 阶段 4 | 未开始 | 只有通用构建能力 | 威胁模型、监控、备份、恢复和发布门槛通过 |

## 5. 并行治理切片：A0 工程基线与差距盘点

### 目标

把稳定设计转化为能够开始编码的验收边界，明确哪些旧 SaaS 能力保留、替换或删除，并避免在后端复审前提前固化错误架构。

### 任务

- [ ] 建立稳定设计章节到代码目录、API、数据模型和测试的追踪矩阵。
- [x] 已在[Apps 边界与 Desktop 架构 RFC](../app-boundaries-and-desktop-architecture-rfc.md)盘点当前路由与目标路由差距，并提出旧 `/ai`、`/pricing`、`/dashboard` 等页面的评审/隔离原则。
- [ ] 在 `tests/e2e/TEST-CATALOG.md` 写 A1 产品壳验收场景，不先写 Playwright selector。
- [ ] 明确 MVP 设计系统、响应式断点、主导航和房间画布的实现边界。
- [ ] 为后端、数据库、认证、Matrix/Synapse 和部署拓扑分别建立待评审决策项。
- [x] 已在 Apps RFC 列出 app、API、路由、Cookie、浏览器全局对象和旧 SaaS 的隔离边界；首批六个 workspace packages 已实际接入 Web/Backend。

### 完成条件

- 追踪矩阵不存在“设计章节无 owner/工作流”的空白。
- A1 的页面、URL、状态和交互验收已进入 E2E 目录。
- 后端相关内容保持候选状态，没有把现有 Better Auth、数据库和支付实现误写成产品最终决策。
- `pnpm docs:check`、`pnpm typecheck`、`pnpm build` 通过。

## 6. 最近完成工作流：A2 身份、社交与 Matrix 消息底座

A2 从[身份与 Session Bootstrap 实现参考](../../stable/references/identity-session-bootstrap.md)开始，以下阶段完成条件已全部满足：

1. Better Auth 官方 Email OTP plugin 提供验证码生成、哈希存储、尝试次数与自动注册登录。
2. 产品 profile、Matrix identity、每 session device binding 与撤销 outbox 形成可恢复生命周期。
3. 好友、联系人、备注、屏蔽、房间 ACL、Matrix 邀请和浏览器会话管理形成完整产品链路。
4. Matrix 标准事件覆盖文字、回复、回应、媒体、编辑、删除和 typing；SDK 缓存、失败状态与幂等重发通过刷新/离线验证。
5. 新用户必须完成资料设置；用户名唯一，资料变更同步当前 Matrix 展示，联系人备注保持方向性私有。
6. TEST-CATALOG #26–#37、45 项相关单测和 36 项活动产品 E2E 全部通过；`pnpm typecheck`、`pnpm build` 与真实 Synapse 走查通过。

## 7. 待决策清单

| 决策 | 当前状态 | 必须在何时解决 |
| --- | --- | --- |
| 产品后端框架与部署目标 | 首轮采用 TanStack Start server routes + Cloudflare Workers；worker/reconciler 前复审 | A2 outbox worker 实现前 |
| Product PostgreSQL 与 Matrix 数据权威边界 | 产品 profile/identity mapping 属于产品库；Matrix device/room/timeline 属于 Synapse | 真实 adapter 联调时复核 |
| Better Auth 用户与 Matrix user/device 映射 | 一个 Better Auth user 对应一个 Matrix identity；每个 auth session 对应独立 binding | 已落 schema 与 service，注销链路接入时复核 |
| Synapse device access token 正式签发方式 | 已决定使用标准 `m.login.application_service` scoped device login | 已通过固定版本 Synapse 合约测试 |
| Synapse 本地与生产拓扑 | 本地固定 Synapse 1.157.0 + appservice profile；生产拓扑待设计 | A2 生产部署前 |
| 氛围空间包格式、签名与版本不可变 | 待设计 | A3 实现前 |
| iframe sandbox、CSP 与外部联网授权 | 待设计 | A3 安全实现前 |
| SDK/CLI 包边界与公开仓库策略 | 待设计 | A4 开始前 |
| 官网、Web 产品、API 与未来 Desktop 的 app/package 边界 | [Apps 边界与 Desktop 架构 RFC](../app-boundaries-and-desktop-architecture-rfc.md)评审中；建议共享产品 packages、独立部署入口、禁止 app-to-app import | A3 宿主实现扩张前完成 Phase 0 评审 |

## 8. 进度更新规则

- 每次实现变更只更新受影响工作流，不用主观百分比表示进度。
- 进入 Active 时附验收目录或开发变更；进入 Complete 时附代码入口、自动化测试和人工验证结果。
- 发现稳定设计不可实现或需要调整时，不在本文件悄悄改目标，必须创建变更提案并反向更新稳定设计。
- 当前 Active 切片完成后，把下一工作流改为 Active，并更新[当前开发重点](../current-focus.md)。
