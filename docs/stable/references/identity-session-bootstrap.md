# Email OTP 与产品 Session Bootstrap 实现参考

> 生命周期：长期稳定
> 文档类型：参考资料
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：Better Auth Email OTP、产品 session bootstrap、TanStack 登录界面与相关 E2E
> 稳定来源：[VibeChat MVP 版本产品与技术设计](../designs/vibechat-mvp-product-and-technical-design.md)

## 目标

交付 A2 的第一条真实服务切片：用户通过 Better Auth 官方 Email OTP plugin 自动注册或登录，随后由产品 API 从 Cookie session 获取当前身份。该切片建立 Matrix identity service 的入口，但在 Synapse adapter 和持久化映射尚未实现前不返回 Matrix 凭据。

## 本轮决定

- MVP 产品 API 首轮继续使用 TanStack Start server routes；route 只处理 HTTP、session guard、contract 校验与错误映射。
- 浏览器身份权威保持为 Better Auth Cookie session，不新增 JWT 或产品 session token。
- Email OTP 使用 Better Auth `emailOTP` server/client plugin；OTP 存储使用 `hashed`，有效期 10 分钟，最多尝试 5 次。
- `/v1/session/bootstrap` 返回产品 profile 投影和 Matrix 可用状态。未配置 Synapse 时返回 `status: "unavailable"`，且不包含任何 Matrix token。
- 现有 `/api/auth` 在迁移期保留；统一迁入 `/v1/auth` 必须作为独立兼容性变更处理，不能在本切片中静默破坏旧客户端和测试。
- 旧密码登录暂时保留为兼容入口；产品主流程默认展示 Email OTP。

## 非目标

- 不创建 `matrix_identities`、`matrix_session_bindings` 或 outbox 数据。
- 不调用 Synapse Admin API，不生成 Matrix access token 或 device ID。
- 不把聊天 fixture timeline 改写为远端数据。
- 不完成联系人、好友请求或房间索引持久化。

## 接口边界

`GET /v1/session/bootstrap`

- 认证：Better Auth Cookie session。
- 成功：返回 `user`、`matrix.status` 和 contract 版本。
- 未认证：返回 401 与产品标准错误结构。
- Matrix 未配置：返回 `matrix.status = "unavailable"` 和稳定 reason code。

共享响应 schema 放在 `@vibechat/api-contracts`，通过 package exports 同时约束 Backend route、Web client 和未来 Desktop client，避免各自定义类型。

## 验收

Plain-language 场景记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) #26，自动化实现位于 [`tests/e2e/specs/chat-auth-bootstrap.spec.ts`](../../../tests/e2e/specs/chat-auth-bootstrap.spec.ts)。

## 完成证据

- Better Auth Email OTP server/client plugin 已接入，OTP 使用哈希存储、10 分钟有效期和 5 次尝试限制。
- 登录页默认使用 Email OTP，并保留密码兼容入口；hydration 完成前交互保持禁用，避免 SSR 页面产生无效点击。
- `GET /v1/session/bootstrap` 已使用共享 Zod contract，并在 Matrix 未配置时返回明确的 unavailable 状态。
- `chat-auth-bootstrap.spec.ts`：3/3 通过，覆盖本文定义的 5 项验收场景。
- `chat-foundation.spec.ts`：5/5 回归通过。
- `pnpm docs:check`、TanStack typecheck、Cloudflare build 通过；Workers 本地预览中登录页返回 200，未登录 bootstrap 返回 401。

## 下一出口

后续的 [Matrix Identity 生命周期切片](../../development/active/matrix-identity-lifecycle.md)已经形成持久化模型、Synapse adapter 合约和 Better Auth session 到 Matrix device 的创建/撤销状态机。真实 device/access token 签发方式仍须先完成决策，不直接从 route 调用 Synapse Admin API。
