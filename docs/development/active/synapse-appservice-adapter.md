# Synapse Appservice Adapter 实施计划

> 生命周期：开发中
> 文档类型：计划
> 状态：Complete（本切片）
> 更新日期：2026-08-11
> 维护范围：Application Service 用户注册、device login、token 撤销、本地 Synapse 合约测试
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)

## 决策

产品服务使用 Matrix Application Service 的专属用户 namespace，并采用标准 `m.login.application_service` 流程：

1. 使用 appservice `as_token` 和 `m.login.application_service` 注册无密码用户，`inhibit_login: true`。
2. 使用同一 appservice token 调用标准 `/login`，为该用户签发单用户 scoped token 和真实 device。
3. 每次外部 device 创建使用唯一 ID；产品数据库唯一约束选择并发 winner，loser 用自己的 access token 调用标准 `/logout` 立即回收。
4. Better Auth session 撤销后，outbox worker 读取 binding、解密 access token，并通过 `/logout` 撤销 Matrix session。

官方 Matrix 规范明确：Application Service 可用 `/login` 获取单用户 scoped token，返回 token 必须关联请求提供或服务器生成的 device。参考：[Client-Server API Appservice Login](https://spec.matrix.org/v1.19/client-server-api/#appservice-login)、[Application Service API](https://spec.matrix.org/latest/application-service-api/#server-admin-style-permissions)。

## 排除方案

- 不使用 Synapse Admin `login as user`：它不会创建真实 device。
- 不为产品用户创建或保存第二套 Matrix 密码。
- 不使用 Synapse 非标准 JWT login：标准 appservice login 已满足专属 namespace 与 scoped token 要求。
- appservice token、Matrix token 和 token encryption key 只存在于服务端 secret，不进入浏览器构建、日志或产品错误正文。

## 并发不变量

- repository 的 `ensureSessionBinding` 必须明确返回本次调用是否创建成功，不能靠比较随机密文判断 winner。
- 每个外部 login 产生独立 device/token，避免同一 device 的后一次 login 使 winner token 失效。
- loser 必须先确认数据库已有 winner，再注销自己的 token；如果注销失败，抛错并留下可观测的清理失败，不把 loser token 写入数据库。
- 顺序重复 bootstrap 直接读取既有 binding，不再次调用 Synapse。

## 配置

- `MATRIX_HOMESERVER_URL`：产品服务访问的 homeserver URL。
- `MATRIX_PUBLIC_HOMESERVER_URL`：返回浏览器的公开 homeserver URL；未设置时沿用服务端 URL。
- `MATRIX_SERVER_NAME`：Matrix user ID 的 server name。
- `MATRIX_APPSERVICE_TOKEN`：Application Service `as_token`。
- `MATRIX_TOKEN_ENCRYPTION_KEY`：32 字节 base64url AES-GCM key。
- `MATRIX_USER_PREFIX`：appservice 专属 localpart 前缀，默认 `vibe_`。

配置必须全有或全无：全部缺失表示开发环境 unavailable；部分配置是部署错误，必须失败。

## 验收

Plain-language 场景记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) #28。本切片必须通过 mock HTTP adapter 单测、并发 winner/loser 测试、固定版本本地 Synapse 合约测试、OTP/bootstrap E2E、typecheck、Cloudflare build 与 Workers 预览。

## 完成证据

- `SynapseAppserviceAdapter` 已实现 appservice 无密码注册、profile 同步、唯一 device scoped login 与标准 logout。
- Matrix 配置采用全有/全无策略，服务端/浏览器 homeserver URL 分离，secret 不进入错误正文。
- 并发 binding repository 明确返回 winner/loser；loser device 使用自身 scoped token 立即注销。
- identity unit/SQLite/mock HTTP 测试 17/17，通过固定 Synapse 1.157.0 真实合约测试 1/1。
- 真实 Email OTP → product profile → Matrix user/device/token → 加密 binding bootstrap E2E 3/3。

## 下一出口

把 Better Auth 当前 session 退出/指定 session 撤销接入 identity outbox，并实现可重试的 `matrix.device.revoke` worker；随后由宿主 Matrix client 接管真实 room/timeline。
