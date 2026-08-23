# Matrix Identity 生命周期实施计划

> 生命周期：开发中
> 文档类型：计划
> 状态：Complete（本切片）
> 更新日期：2026-08-22
> 维护范围：产品 profile、Matrix identity、session binding、integration outbox、Synapse adapter 合约
> 稳定来源：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 目标

在现有 Better Auth Cookie session bootstrap 上建立持久化 identity 边界，使产品资料、Matrix 用户映射和 session-device 生命周期可以被独立测试和替换。真实 Synapse 未配置时，bootstrap 仍创建并读取产品 profile，但不产生 Matrix token 或 binding。

## 数据模型

- `user_profiles`：产品展示资料权威，`user_id` 对应 Better Auth user。
- `matrix_identities`：Better Auth user 到 Matrix user 的一对一映射。
- `matrix_session_bindings`：Better Auth session 到 Matrix device/access token 的一对一映射；token 只保存密文。
- `integration_outbox`：承载 `matrix.device.revoke` 等跨系统最终一致事件。

PostgreSQL 与 SQLite/D1 schema 必须同步；所有唯一约束同时承担并发幂等保护。

## Service 与 adapter 边界

`IdentityService` 负责流程编排：

1. 幂等获取或创建产品 profile。
2. 查询 Matrix adapter 可用性。
3. 幂等获取或创建 Matrix identity。
4. 按 Better Auth session ID 幂等获取或创建设备 binding。
5. 只把 Matrix 明文 token交给 token protector；repository 只接收密文。
6. 撤销时由 repository 完成 binding 标记与幂等 outbox 写入；实现先落 outbox 再标记，任一步失败都可安全重试，worker 后续调用 adapter 删除设备。

route 只负责解析 Better Auth session、调用 service 和映射稳定响应，不直接查询 identity 表，也不直接调用 Synapse。

## Synapse 决策边界

- `PUT /_synapse/admin/v2/users/:userId` 可以作为幂等用户 provision 能力。
- 设备删除可以映射到 Synapse device admin API。
- Synapse “login as user”明确不会创建可见设备，不能用于本产品的 session-device 绑定。
- 浏览器 Matrix device/access token 的正式签发方式必须另行决策；在此之前生产 adapter 保持 unavailable。
- Synapse Admin token 只允许存在于产品服务端 secret，不进入浏览器、日志或生成的 Space App。

## 非目标

- 不接入 `matrix-js-sdk` timeline。
- 不启动 Synapse Docker 服务。
- 不实现 outbox worker/reconciler 的调度基础设施。
- 不把 Matrix access token 写入日志、localStorage 或未加密数据库字段。

## 验收

Plain-language 场景记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) #27。实现需要通过 identity 单元测试、Email OTP/bootstrap E2E、聊天宿主回归、类型检查、构建和 Workers 预览。

## 完成证据

- PostgreSQL 与 SQLite/D1 的 4 张表、唯一约束和 Drizzle migration 已同步。
- `libs/identity` 已实现 repository、service、Synapse adapter、AES-GCM token protector 与 unavailable production adapter。
- identity 单元/SQLite 集成测试 9/9；Email OTP/bootstrap 与聊天宿主浏览器回归 8/8。
- TanStack 直接 typecheck、Cloudflare build、文档检查通过；Workers 预览中登录页返回 200，未登录 bootstrap 返回 401。
- 仓库 Turbo typecheck 包装器受本机 macOS keychain TLS 初始化失败影响，直接应用级 `tsc --noEmit` 作为等价类型验证已通过。

## 下一出口

[Synapse Appservice Adapter](./synapse-appservice-adapter.md) 已用标准 `m.login.application_service` 完成真实 device/access token 签发与本地合约测试。下一步实现 Better Auth session 撤销 hook 和 outbox worker；Admin “login as user”继续排除，因为它不会创建真实设备。
