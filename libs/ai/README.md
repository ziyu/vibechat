# `@libs/ai`

Backend 内部 AI 领域库，覆盖三类活动能力：

- 对话：Qwen、DeepSeek、OpenAI，支持流式输出、预留积分、按 usage 结算和失败退款；
- 图片：Qwen、fal、OpenAI、Gemini，持久化请求状态并按固定模型成本结算；
- 视频：fal、火山引擎、阿里云，持久化异步 provider task、状态查询和失败补偿。

HTTP adapter 位于 `apps/backend/src/routes/api/chat.ts`、`api/image-generate.ts` 和 `api/video-generate/*`；Web 页面位于 `apps/web-app/src/features/ai`。配置键见根 `env.example`，运行与验证步骤见 [`docs/stable/runbooks/ai.md`](../../docs/stable/runbooks/ai.md)。

所有请求都必须带稳定 `requestId`。Provider/model/尺寸/时长由服务端白名单校验，任务读取绑定当前用户，缺少 key 或 provider 失败时必须显式失败并通过幂等账本退款。
