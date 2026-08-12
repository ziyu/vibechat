# Legacy Backend Snapshot

> 生命周期：开发中
> 状态：隔离
> 更新日期：2026-08-12

本目录保存从新共享 `apps/backend` 运行时中退出的旧 SaaS HTTP 路由，包括支付、AI、推广和用户侧旧积分接口。它不是 workspace app，不参与产品构建、类型检查或部署。

当前 `apps/backend` 承载 VibeChat 产品 `/v1/*`、Better Auth、产品上传、健康检查、官网 Blog 读取以及已经评审的 Admin 运营 API。原通用 Admin API 已迁出本目录。恢复剩余 legacy 能力前，必须先完成产品范围与安全评审，并建立明确的 app、owner、测试和部署边界。

删除条件：相关能力完成退场确认，或已迁入被批准的独立应用。
