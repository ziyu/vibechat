# 当前开发重点

> 生命周期：开发中
> 状态：工程基线
> 更新日期：2026-08-12
> 事实来源：仓库根目录 `README.md` 与长期稳定设计

## 当前阶段

仓库已经完成 Vibe Chat 产品 Web 前端宿主和 A2 聊天基础闭环验收，并已用真实产品 session、Synapse room 与 Matrix timeline 替换身份和消息主链路；未经产品评审的旧 SaaS 能力继续隔离。

Email OTP、[Matrix Identity 生命周期](./active/matrix-identity-lifecycle.md)、[Synapse Appservice Adapter](./active/synapse-appservice-adapter.md)、session 撤销 worker、[真实 Matrix 房间与 Timeline](./active/matrix-room-timeline.md)、[社交关系与 Matrix 邀请](./active/social-matrix-invitations.md)、[完整消息操作与资料基础](./active/matrix-message-profile-foundation.md)以及[登录后产品状态真实化](./active/real-product-state-cutover.md)均已完成。当前主线进入 A3“氛围空间 Runtime”：先形成 manifest、版本不可变、sandbox 和 capability 协议的可执行 spec，再实现第三方空间运行边界。

工程边界已采纳并开始实施[Apps 边界与 Desktop 架构 RFC](./app-boundaries-and-desktop-architecture-rfc.md)：官网、产品 Web 与共享 backend 已成为独立构建单元，旧 SaaS 页面/API 已退出活动路由图。A3 可以继续设计，但新增宿主能力必须通过共享 contract/platform port 表达，不再把产品逻辑直接固化到 TanStack route、相对 `fetch` 或浏览器全局对象中。

首批跨宿主 workspace packages 已建立并接入：`api-contracts`、`auth-client`、`product-core`、`product-client`、`matrix-client` 与 `platform-contracts`。这些边界有独立 manifests、exports、依赖和构建门槛；`libs/*` 继续保存尚只属于 Backend 或仍待评审的领域实现，不再承担所有共享源码。

## 当前约束

- 产品 Web/PWA 只以 `apps/web-app` 的 TanStack Start 实现为准；活动路由只包含认证、onboarding 与聊天产品。
- 官网位于 `apps/site-app`，本地端口 `8003`；只承载公开首页、Blog 与产品入口。
- 共享 backend 位于 `apps/backend`，本地端口 `8002`；承载 Better Auth、产品 `/v1`、产品上传、健康检查和官网 Blog 读取。
- 文档站位于 `apps/docs-app`。
- 旧 SaaS 页面、API 和 E2E 分别隔离在 `legacy/web-app`、`legacy/backend` 与 `tests/e2e/legacy`，不参与活动构建或默认产品回归。
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
