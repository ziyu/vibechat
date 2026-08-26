# AI 对话、图片与视频 Runbook

> 生命周期：长期稳定
> 文档类型：Runbook
> 状态：生效
> 更新日期：2026-08-26
> 维护范围：AI provider、任务持久化、积分结算与用户页面

## 前置条件

- 应用与数据库迁移已完成；新账号默认获得 `CREDITS_NEW_USER_GRANT` 配置的欢迎积分，可直接开始首轮 AI/Agent 对话。
- 仅为要启用的 provider 配置根 `env.example` 所列密钥：聊天支持 Qwen、DeepSeek、OpenAI；图片支持 Qwen、fal、OpenAI、Gemini；视频支持 fal、火山引擎和阿里云。
- 模型、尺寸和时长已进入 `config/ai*.ts` 的服务端白名单。

## 操作

1. 启动 `pnpm dev`，登录 `http://localhost:8001`。
2. 在 `/ai`、`/image-generate` 或 `/video-generate` 选择允许的 provider/model。
3. 发起请求时 Web 生成稳定 `requestId`；重试同一次交互必须复用它。
4. Backend 校验输入与用户积分，写入预留/消费和任务状态，再调用 provider。
5. 对话按 provider usage 结算；图片/视频保存结果或失败状态；失败通过确定性交易 ID 退款。

Space Agent 使用相同账本语义，但入口必须是 Matrix 中已确认的结构化 Agent Mention：人类消息先写入 Matrix，Backend 按精确 `eventId` 核对 sender、实时 `m.room.member=join` 与 Agent target 后预留积分，再把 turn 交给 Space Runtime。Runtime 返回标准化 token usage；Backend 把结算/退款 callback 写入 Product DB outbox 后返回 202，再由 reconciler 以稳定 transaction ID 投递，Runtime 不能直接修改余额。Agent 失败不撤回已确认的人类消息；callback 和 reconciler 重放都只能产生一次结算或退款效果。

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
- Space Agent callback 已返回 202 但账本未变化：检查 `space_runtime_outbox` 的 `credits_callback` 事件、`available_at`、attempt 和 Backend reconciler 日志；不要绕过 outbox 手工创建新的交易 ID。
