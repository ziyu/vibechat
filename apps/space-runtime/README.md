# Space Runtime

Node 22–24、TypeScript ESM 与 Hono 服务。首版从 `chat-app-server` 移植同 Space 串行 turn、跨 Space 有限并行、SSE/command、ProjectStore、agentOS Apps Dev Preview 与 immutable Release。

产品 Backend 完成 Better Auth 和 Matrix Space membership 校验后才代理到本服务；本服务只接受 `SPACE_RUNTIME_INTERNAL_TOKEN`。公共契约使用通用 `agentId`，当前默认注册 `pi` Adapter。

## 本地运行

根目录 `pnpm dev` 或 `pnpm dev:web` 会同时启动本服务；也可以单独执行 `pnpm dev:space-runtime`。需要在 `.env` 配置：

- `SPACE_RUNTIME_INTERNAL_TOKEN`：Backend 与 Runtime 共享的本地内部 token。
- `SPACE_RUNTIME_CALLBACK_ORIGIN`：积分结算回调的 Backend origin，默认 `http://127.0.0.1:8002`。
- `SPACE_AGENT_DEFAULT_ID`：首版默认 `pi`，但公共 API 和队列不依赖 Pi。
- `PI_MODE`：默认 `auto`；存在本机 Pi CLI 会话时走 `host`，具备 AgentOS provider credential 时可设为 `agentos`。
- `SPACE_RUNTIME_DATA_DIR`：可选的 Project/App State 本地持久化目录。
- `SPACE_RUNTIME_TMP_DIR`：可选的 agentOS Apps 工作目录。未指定时使用短且按进程隔离的 `/tmp/vc-space-runtime-<pid>`，避免 macOS Unix socket 路径超限。

本服务依赖的 `isolated-vm` 尚不支持 Node 26；开发和构建使用仓库约定的 Node 22–24。仅有 Claude Code credential 而没有 AgentOS provider credential 时，使用 Host Pi 模式。

## 请求链路

1. Web 先把真人消息写入 Matrix；只有显式 `@agent` 才把 Matrix event ID 作为幂等键提交给 Backend。
2. Backend 校验 Better Auth、`room_index`/Matrix Space membership 和积分预留，再用内部 token 调用 Runtime。
3. `SpaceInstanceServer` 持久化请求并按 Space 串行执行；不同 Space 在配额内并行。
4. Agent 写入 Project 后，agentOS Apps 创建 Dev Draft；Web 的 App iframe 默认加载 Dev。
5. 有权限的成员显式发布后生成不可变 Release；Live 不会被后续 Draft 自动覆盖。

内部 `/runtime/*` 与 `/api/apps/*` 不应直接暴露到浏览器。公开 SDK 由 Backend 的 `/v1/space-app-sdk` 提供，App bridge 只开放经过 Host 和 Backend 校验的命令。

## 首版限制

- Project、queue、Draft/Live 和 App State 已支持单实例本地恢复；生产 DB/Object Store、跨副本 lease/接管仍待实现。
- 账务链已经具备逐请求预留、拒绝退款和 Runtime 回调，但 Pi 的真实 token usage 尚未接入，当前成功请求以空 usage 结算。
- Agent 回复目前由 Runtime SSE 合并显示在 Space Chat UI，尚未作为 Matrix virtual-user event 回写 timeline。
- agentOS Apps `0.2.15` 停止 Dev/Release worker 时可能输出 guest metadata/RPC timeout 噪声；已发布 artifact 仍可正常读取，升级前保留为已知问题。
