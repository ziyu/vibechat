# Legacy Web App Snapshot

> 生命周期：开发中
> 状态：隔离
> 更新日期：2026-08-12

本目录保存从活动 `apps/web-app/src` 路由图中退出的旧 SaaS 页面和组件，包含 AI、计费、推广和演示功能。它不是 workspace app，不参与产品构建、类型检查或部署。

原通用 Admin 页面已经迁入 `apps/admin-app`，不再保留两份活动实现。

这些文件仅用于审计迁移来源。恢复任何功能前必须先完成产品范围评审，并将实现放入已确认的 app 或共享 package；不得直接把本目录重新加入 TanStack route tree。

删除条件：相关能力完成退场确认，或已迁入有 owner、测试与部署边界的目标应用。
