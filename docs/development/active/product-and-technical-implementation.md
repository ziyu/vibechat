# VibeChat MVP 产品与技术设计 Active 实施跟踪

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-11
> 维护范围：VibeChat MVP 产品与技术设计的实施、验收与决策闭环
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 1. 文档职责

稳定设计定义目标状态和长期约束；本文件记录从当前仓库到目标状态的实际开发进展。设计是否写完与功能是否实现是两件事，任何“已完成”都必须附代码、测试或运行证据。

本文件不复制稳定设计正文。目标或约束发生变化时，先在开发中形成变更提案，评审后更新稳定设计；这里只同步实施影响。

## 2. 当前结论

> **产品实现状态：A1 已完成，A2 Active。**

仓库已有 TanStack Start 工程骨架、共享 SaaS 能力、Vibe Chat 品牌和文档基线，但这些不能证明产品与技术设计中的核心能力已经实现。

截至 2026-08-11，已经形成以下实现证据：

- `/messages`、`/contacts`、`/discover`、`/me`、`/rooms/:roomId` 目标信息架构已在 TanStack Start 中实现。
- `libs/chat` 提供共享领域契约，宿主页面通过稳定 action 使用 fixture 数据。
- `tests/e2e/specs/chat-foundation.spec.ts` 已覆盖桌面/移动宿主、房间、新建聊天、联系人和发现流程，最近一次结果为 5/5。
- [聊天宿主基础实现](../../stable/references/chat-host-foundation.md)记录了已实现边界与真实服务接入顺序。
- Better Auth Email OTP、持久化产品 profile、Matrix identity/session binding schema、Synapse adapter 合约和 integration outbox 已形成可执行实现。
- identity 单元/SQLite 集成测试 9/9，通过 OTP/bootstrap 与聊天宿主浏览器回归 8/8；Cloudflare build 与 Workers 运行态探测通过。

尚未实现的核心范围包括真实 Synapse device 凭据签发与 timeline、社交数据、氛围空间 iframe Runtime、CLI/审核链路和生产恢复体系。聊天宿主不等于真实消息服务；A2 必须继续逐步替换 fixture timeline。

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
| A1 | 产品壳与信息架构 | §5 | Complete | `libs/chat`、`apps/web-app/src/features/chat`、目标路由、聊天宿主 E2E 5/5 | 保持宿主契约稳定，由 A2 替换 fixture 数据 |
| A2 | 身份、社交与 Matrix 消息底座 | §8、§9、§10、§14 阶段 1 | Active | [Email OTP 与产品 Session Bootstrap](../../stable/references/identity-session-bootstrap.md)、[Matrix Identity 生命周期](./matrix-identity-lifecycle.md)、identity 测试 9/9、浏览器回归 8/8 | 决定真实设备凭据签发方式，并以本地 Synapse 合约测试验证 adapter |
| A3 | 氛围空间 Runtime | §6、§14 阶段 2 | 未开始 | 无 | manifest、协议、capability 与沙箱 spec 可执行 |
| A4 | 开发、发布、市场与审核 | §7、§8.6、§14 阶段 3 | 未开始 | 无 | CLI、模拟宿主、版本与审核流程验收通过 |
| A5 | 安全、生产与恢复 | §11、§12、§13、§14 阶段 4 | 未开始 | 只有通用构建能力 | 威胁模型、监控、备份、恢复和发布门槛通过 |

## 5. 并行治理切片：A0 工程基线与差距盘点

### 目标

把稳定设计转化为能够开始编码的验收边界，明确哪些旧 SaaS 能力保留、替换或删除，并避免在后端复审前提前固化错误架构。

### 任务

- [ ] 建立稳定设计章节到代码目录、API、数据模型和测试的追踪矩阵。
- [ ] 盘点当前路由与目标路由差距，明确旧 `/ai`、`/pricing`、`/dashboard` 等页面的保留或退场策略。
- [ ] 在 `tests/e2e/TEST-CATALOG.md` 写 A1 产品壳验收场景，不先写 Playwright selector。
- [ ] 明确 MVP 设计系统、响应式断点、主导航和房间画布的实现边界。
- [ ] 为后端、数据库、认证、Matrix/Synapse 和部署拓扑分别建立待评审决策项。
- [ ] 列出阶段 1 开始前必须删除或隔离的脚手架耦合。

### 完成条件

- 追踪矩阵不存在“设计章节无 owner/工作流”的空白。
- A1 的页面、URL、状态和交互验收已进入 E2E 目录。
- 后端相关内容保持候选状态，没有把现有 Better Auth、数据库和支付实现误写成产品最终决策。
- `pnpm docs:check`、`pnpm typecheck`、`pnpm build` 通过。

## 6. 最近完成切片：A2 Email OTP 与产品 Session Bootstrap

A2 第一条切片遵循[实现参考](../../stable/references/identity-session-bootstrap.md)，以下完成条件已全部满足：

1. Better Auth 官方 Email OTP plugin 提供验证码生成、哈希存储、尝试次数与自动注册登录。
2. 登录页默认使用 Email OTP，旧密码登录仅作为迁移兼容入口保留。
3. `GET /v1/session/bootstrap` 只接受 Better Auth Cookie session，并返回稳定的共享 contract。
4. Matrix 未配置时显式返回 unavailable，响应中不存在 access token、device ID 或伪造 Matrix user ID。
5. TEST-CATALOG #26 对应 E2E、`pnpm docs:check`、`pnpm typecheck` 与 `pnpm build` 通过。

## 7. 待决策清单

| 决策 | 当前状态 | 必须在何时解决 |
| --- | --- | --- |
| 产品后端框架与部署目标 | 首轮采用 TanStack Start server routes + Cloudflare Workers；worker/reconciler 前复审 | A2 outbox worker 实现前 |
| Product PostgreSQL 与 Matrix 数据权威边界 | 产品 profile/identity mapping 属于产品库；Matrix device/room/timeline 属于 Synapse | 真实 adapter 联调时复核 |
| Better Auth 用户与 Matrix user/device 映射 | 一个 Better Auth user 对应一个 Matrix identity；每个 auth session 对应独立 binding | 已落 schema 与 service，注销链路接入时复核 |
| Synapse device access token 正式签发方式 | 待决策；Admin “login as user”不可作为设备签发 | 真实 adapter 开码前 |
| Synapse 本地与生产拓扑 | 待设计 | A2 真实 adapter 合约测试前 |
| 氛围空间包格式、签名与版本不可变 | 待设计 | A3 实现前 |
| iframe sandbox、CSP 与外部联网授权 | 待设计 | A3 安全实现前 |
| SDK/CLI 包边界与公开仓库策略 | 待设计 | A4 开始前 |

## 8. 进度更新规则

- 每次实现变更只更新受影响工作流，不用主观百分比表示进度。
- 进入 Active 时附验收目录或开发变更；进入 Complete 时附代码入口、自动化测试和人工验证结果。
- 发现稳定设计不可实现或需要调整时，不在本文件悄悄改目标，必须创建变更提案并反向更新稳定设计。
- 当前 Active 切片完成后，把下一工作流改为 Active，并更新[当前开发重点](../current-focus.md)。
