# AI 对话、图片与视频 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-14
> 维护范围：AI provider、任务持久化、积分结算与用户页面

## 前置条件

- 应用与数据库迁移已完成，用户有可用积分。
- 仅为要启用的 provider 配置根 `env.example` 所列密钥：聊天支持 Qwen、DeepSeek、OpenAI；图片支持 Qwen、fal、OpenAI、Gemini；视频支持 fal、火山引擎和阿里云。
- 模型、尺寸和时长已进入 `config/ai*.ts` 的服务端白名单。

## 操作

1. 启动 `pnpm dev`，登录 `http://localhost:8001`。
2. 在 `/ai`、`/image-generate` 或 `/video-generate` 选择允许的 provider/model。
3. 发起请求时 Web 生成稳定 `requestId`；重试同一次交互必须复用它。
4. Backend 校验输入与用户积分，写入预留/消费和任务状态，再调用 provider。
5. 对话按 provider usage 结算；图片/视频保存结果或失败状态；失败通过确定性交易 ID 退款。

视频异步任务由 `GET /api/video-generate/status?taskId=...` 查询。接口核验任务所有者；浏览器轮询只展示状态，不决定账务。

## 验证

```bash
pnpm vitest run tests/unit/ai
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/account-services-ai.spec.ts
```

没有 key 时三类请求都必须明确失败，余额恢复，重复失败请求不再次扣费。有 sandbox key 时还要逐 provider 验证真实响应、任务完成和最终扣费。

## 故障处理

- `generation_failed`：检查对应 key/base URL、模型白名单和 provider 错误日志。
- 流连接中止：按 request ID 核对 consume 与 failure refund；不要创建新的补偿 ID。
- 视频长期 processing：状态接口会对未确认 provider task 的陈旧记录失败并退款；核对 provider task ID 后再决定是否重试。
- 余额异常：按[积分账本 Runbook](./credits.md)处理。
