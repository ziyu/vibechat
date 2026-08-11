# 当前开发重点

> 生命周期：开发中
> 状态：工程基线
> 更新日期：2026-08-12
> 事实来源：仓库根目录 `README.md` 与长期稳定设计

## 当前阶段

仓库已经完成 Vibe Chat 产品 Web 前端宿主的首轮验收，并已用真实产品 session、Synapse room 与 Matrix timeline 替换身份和消息主链路；未经产品评审的旧 SaaS 能力继续隔离。

当前 Active 主线是[VibeChat MVP 产品与技术设计实施跟踪](./active/product-and-technical-implementation.md)中的 A2“身份、社交与 Matrix 消息底座”。Email OTP、[Matrix Identity 生命周期](./active/matrix-identity-lifecycle.md)、[Synapse Appservice Adapter](./active/synapse-appservice-adapter.md)、session 撤销 worker 和[真实 Matrix 房间与 Timeline](./active/matrix-room-timeline.md)切片已经完成；下一步实现产品层好友请求/联系人，并用双用户 Matrix 邀请跑通会话。A0 的脚手架清理与追踪矩阵仍作为并行工程治理工作保留。

## 当前约束

- 产品 Web 应用只以 `apps/web-app` 的 TanStack Start 实现为准。
- 文档站位于 `apps/docs-app`。
- 共享能力继续放在 `libs/*` 与 `config/*`，但是否进入产品范围仍需依据稳定设计评审。
- 产品 API 的首轮实现继续使用 TanStack Start server routes，核心合约和 service 放入 `libs/*`；独立后端框架是否需要引入，在 A2 扩展到 worker/reconciler 前再次评审。
- Better Auth 是浏览器身份权威，产品 API 不签发第二套 session；Matrix 尚未配置时必须显式返回 unavailable，不得生成 fixture token。
- 产品 profile/identity mapping 已明确属于产品库，Matrix device/room/timeline 属于 Synapse；device token 使用标准 appservice scoped login，Synapse 生产拓扑仍需在部署前完成评审。

## 当前文档治理工作

- 新增内容先进入“开发中”，避免未经核验就成为稳定承诺。
- 原脚手架文档正在按 Vibe Chat 名称、单一 TanStack 应用和正确文档类型重整。
- 操作型用户文档统一作为 Runbook 维护，不再使用含义过宽的 `user-guide` 类型。

完成阶段性工作后，应更新本页或用新的开发计划替代本页，并把本页归档。
