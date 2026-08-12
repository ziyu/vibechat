# 返利佣金系统发布说明

> 生命周期：已归档
> 文档类型：发布说明
> 状态：已归档
> 更新日期：2026-08-11
> 维护范围：返利、佣金和提现能力

> 归档原因：本文记录的用户返利闭环已从活动产品移除；当前只保留 Admin 历史数据运营。替代入口为[佣金与提现运营 Runbook](../stable/runbooks/affiliate.md)。

本次交付在 Vibe Chat 的 TanStack Start 产品应用中接入返利佣金闭环，并把核心业务逻辑集中在共享库。

## 交付内容

- 推荐码生成、`ref` 参数归因和推荐 Cookie。
- 新用户 claim、禁止自荐与禁止覆盖已有推荐关系。
- 推荐人与被推荐人的可配置注册积分奖励。
- 支付成功 Webhook 后的幂等佣金计算。
- 单币种佣金余额、最低提现额和提现申请。
- 用户统计、佣金记录、提现记录和管理员审批 API。
- 管理员佣金与提现页面。
- PostgreSQL、SQLite 和 D1 的余额更新路径。

## 配置

功能默认关闭。启用前需要设置 `AFFILIATE_ENABLED=true`，并核对佣金率、佣金币种、最低提现额、Cookie 有效期和注册奖励。

## 安全与账务

- 佣金只在签名验证成功的支付 Webhook 后处理。
- `orderId` 防止重复佣金。
- 订单币种必须与 `AFFILIATE_CURRENCY` 一致。
- 提现与管理接口在服务端校验会话和权限。

当前设计见[返利系统设计](../designs/affiliate-system.md)，配置和操作见[返利系统 Runbook](../runbooks/affiliate.md)。
