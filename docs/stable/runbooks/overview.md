# Vibe Chat Runbook 索引

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：稳定操作文档导航

Vibe Chat 的操作型文档统一称为 Runbook。每份 Runbook 应提供前置条件、可执行步骤、验证方式和必要的故障处理。

## 开始与开发

- [快速开始](./get-started.md)
- [开发流程](./best-practices.md)
- [TanStack Start](./tanstack-start.md)
- [构建验证](./build-verification.md)
- [本地 E2E](./e2e-local.md)
- [手动与 API 测试](./testing/manual-and-api-testing.md)

## 平台能力

- [基础配置](./basic-config.md)
- [数据库](./database.md)
- [认证](./auth/overview.md)
- [验证码](./captcha.md)
- [存储](./storage.md)
- [积分](./credits.md)
- [返利](./affiliate.md)

## 运营能力

- [Admin 动态定价](./payment/dynamic-pricing.md)
- [积分账本](./credits.md)
- [佣金与提现运营](./affiliate.md)

AI 与支付 provider 当前不属于活动基线，历史 Runbook 位于 `docs/archive/legacy-provider-runbooks/`。

## 部署与文档

- [部署方式](./deployment/overview.md)
- [Cloudflare Workers](./deployment/cloudflare-workers.md)
- [传统 Node.js](./deployment/traditional.md)
- [Docker](./deployment/docker.md)
- [文档站](./docs-app.md)

架构与取舍不在 Runbook 重复维护，请从[稳定文档入口](../README.md)进入设计和参考资料。
