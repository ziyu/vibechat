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
4. Agent 写入 Project 后，agentOS Apps 在独立版本实例中构建 Candidate；成功后该固定 revision 成为新的 ready App，Web iframe 按 `version` 精确加载。
5. 有权限的成员显式发布后生成不可变 Release；Live 不会被后续 Draft 自动覆盖。

Dev Preview Manager 不用单个可变进程代表整个 Space。Candidate 与 ready Revision 使用不同 actor key，启动 Candidate 不会停止成员正在使用的 ready App；当前进程保留最近三个 ready 版本供 iframe 重载和页面刷新按 revision 读取。Candidate 构建或启动失败只更新诊断，不改变最后 ready 指针。

## Project 与模板血缘

- 官方 Template Version 来自 `@vibechat/space-templates`，包含不可变源码快照、SHA-256 `sourceHash`、content-bound `integrity`、SDK/Runtime 兼容性和 provenance。
- 创建 Space 时，本服务把固定版本复制为实例独享的 Project，并同时记录模板源 hash 与当前 Project hash。后续 Agent 修改只改变当前 Project hash，不回写模板。
- Project 是完整的受限多文件树，不是三个字符串字段：`package.json`、`tsconfig.json`、`src/index.ts` 为必需入口，Agent 可在 `src/` 下按职责拆分或新增模块；Project Store、Dev Preview、Revision 与 Release 始终按完整树排序、校验和计算 hash。
- 加载本地 Project 时会重新计算 source hash；带 hash 的 JSON 若内容不一致会拒绝加载，避免静默运行损坏或被绕过记录修改的源码。
- 内置兼容升级只接受“当前 Project hash 与模板 lineage hash 完全一致”的实例。任何源码定制都会保留，不能再依靠 summary、HTML marker 或版本号正则推断。

官方模板维护流程和生产存储边界见 [`packages/space-templates/README.md`](../../packages/space-templates/README.md)。

内部 `/runtime/*` 与 `/api/apps/*` 不应直接暴露到浏览器。公开 SDK 由 Backend 的 `/v1/space-app-sdk` 提供，App bridge 只开放经过 Host 和 Backend 校验的命令。

## 首版限制

- Project、queue、Draft/Live 和 App State 已支持单实例本地恢复，Project 源码已具备 hash 校验和 Template lineage；生产 DB/Object Store、跨副本 lease/接管仍待实现。
- 账务链已经具备逐请求预留、拒绝退款和 Runtime 回调，但 Pi 的真实 token usage 尚未接入，当前成功请求以空 usage 结算。
- Agent 回复目前由 Runtime SSE 合并显示在 Space Chat UI，尚未作为 Matrix virtual-user event 回写 timeline。
- 当前 ready Preview 只在单进程内保留最近三个版本；生产环境仍需把保留策略、跨副本路由和 artifact 恢复升级为持久协调能力。
- agentOS Apps `0.2.15` 停止 Dev/Release worker 时可能输出 guest metadata/RPC timeout 噪声；已发布 artifact 仍可正常读取，升级前保留为已知问题。
