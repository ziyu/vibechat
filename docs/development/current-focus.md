# 当前开发重点

> 生命周期：开发中
> 状态：工程基线
> 更新日期：2026-08-14
> 事实来源：仓库根目录 `README.md` 与长期稳定设计

## 当前阶段

仓库已经完成 Vibe Chat 产品 Web 前端宿主、A2 聊天基础闭环，以及账户、定价、积分、推荐、提现、支付和 AI 能力迁移。当前活动源码只保留单一 Web/Backend/Admin 实现，完整浏览器回归已在真实 SQLite + Synapse 环境通过，主线重新进入 A3“氛围空间 Runtime”。

Email OTP、[Matrix Identity 生命周期](./active/matrix-identity-lifecycle.md)、[Synapse Appservice Adapter](./active/synapse-appservice-adapter.md)、session 撤销 worker、[真实 Matrix 房间与 Timeline](./active/matrix-room-timeline.md)、[社交关系与 Matrix 邀请](./active/social-matrix-invitations.md)、[完整消息操作与资料基础](./active/matrix-message-profile-foundation.md)以及[登录后产品状态真实化](./active/real-product-state-cutover.md)均已完成。账户/商业化/AI 的完成证据见[产品能力迁移完成记录](../archive/legacy-capability-migration.md)与[2026-08-14 发布说明](../stable/release-notes/2026-08-14-product-capability-migration.md)。外部支付、AI 与对象存储沙盒仍需各自凭据进行上线前验收；这不再阻止 A3 本地产品开发。

工程边界已采纳并实施[Apps 边界与 Desktop 架构 RFC](./app-boundaries-and-desktop-architecture-rfc.md)：官网、产品 Web、Admin 与共享 Backend 已成为独立构建单元。旧通用 Admin 中仍有价值的运营能力已恢复到 `apps/admin-app`，其服务端 API 归属共享 Backend；账户、服务定价、支付结果与 AI 页面进入唯一产品 Web shell，数据库、支付/AI provider、积分、推荐和提现写入只存在于 Backend。后续 A4 空间审核也进入这一唯一 Admin 宿主。A3 可以继续设计，但新增宿主能力必须通过共享 contract/platform port 表达，不再把产品逻辑直接固化到 TanStack route、相对 `fetch` 或浏览器全局对象中。

跨宿主 workspace packages 已建立并接入：`api-contracts`、`auth-client`、`product-core`、`product-client`、`matrix-client`、`platform-contracts`、`i18n`、`validators`、`ui` 与 `react-shared`。这些边界有独立 manifests、exports、依赖和构建门槛；`libs/*` 只保存 Backend 单宿主领域实现，不再承担跨应用共享源码。

## 当前约束

- 产品 Web/PWA 只以 `apps/web-app` 的 TanStack Start 实现为准；活动路由包含认证、onboarding、聊天、账户、服务/上传、支付结果与 AI 产品面。
- 官网位于 `apps/site-app`，本地端口 `8003`；只承载公开首页、Blog 与产品入口。
- 共享 backend 位于 `apps/backend`，本地端口 `8002`；承载 Better Auth、产品 `/v1`、上传、账户/计费、推荐提现、支付、AI、健康检查和官网 Blog 读取。
- 文档站位于 `apps/docs-app`。
- 独立 Admin App 位于 `apps/admin-app`，本地端口 `8005`；只消费 Backend API，不直接导入数据库或 Backend 内部领域实现。
- Admin 的 `/$lang/*` 页面路由必须排除保留段 `api`，确保 `/api/*` 总是进入同源 Backend 网关；运营 E2E 必须禁用接口重定向并校验 JSON 响应及页面实际数据请求，不能只用最终 `200` 或标题可见作为通过证据。
- 经评审保留的旧能力已经迁入活动 app/package/lib 边界；不再保留第二份 `legacy` 源码或历史 E2E 快照，历史决策只由 `docs/archive` 保存。
- `scripts/check-app-boundaries.mjs` 阻止 app-to-app 导入，以及 Site/Web 对数据库、支付、AI、存储和服务端 Auth 的直接导入。
- 跨宿主且需要稳定导出的能力进入 `packages/*`；单一 Backend 内部领域实现继续放在 `libs/*`，是否升级为 package 依据第二个真实消费者、独立发布或隔离依赖的证据评审。
- backend 的首轮 runtime 继续使用 TanStack Start server routes，核心合约和 service 放入 `libs/*`；Web 只保留同源网关，不保留业务 handler。
- Better Auth 是浏览器身份权威，产品 API 不签发第二套 session；Matrix 尚未配置时必须显式返回 unavailable，不得生成 fixture token。
- 产品 profile/identity mapping 已明确属于产品库，Matrix device/room/timeline 属于 Synapse；device token 使用标准 appservice scoped login，Synapse 生产拓扑仍需在部署前完成评审。

## 当前文档治理工作

- 新增内容先进入“开发中”，避免未经核验就成为稳定承诺。
- 原脚手架文档正在按 Vibe Chat 名称、多应用边界和正确文档类型重整。
- 操作型用户文档统一作为 Runbook 维护，不再使用含义过宽的 `user-guide` 类型。

完成阶段性工作后，应更新本页或用新的开发计划替代本页，并把本页归档。
