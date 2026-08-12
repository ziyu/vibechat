# Legacy Backend Snapshot

> 生命周期：开发中
> 状态：隔离
> 更新日期：2026-08-12

本目录保存从新共享 `apps/backend` 运行时中退出的旧 SaaS HTTP 路由，包括支付、积分、AI、推广和通用后台 API。它不是 workspace app，不参与产品构建、类型检查或部署。

当前 `apps/backend` 只承载 VibeChat 产品 `/v1/*`、Better Auth、产品上传、健康检查与官网 Blog 读取。恢复本目录中的任何能力前，必须先完成产品范围与安全评审，并建立明确的 app、owner、测试和部署边界。

删除条件：相关能力完成退场确认，或已迁入被批准的独立应用。
