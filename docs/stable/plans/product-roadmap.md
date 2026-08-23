# VibeChat 产品路线图

> 生命周期：长期稳定
> 文档类型：计划
> 状态：生效
> 更新日期：2026-08-22
> 维护范围：产品与工程阶段顺序

路线图表达当前认可的交付顺序，不承诺未经评审的日期。详细边界以 [VibeChat MVP 产品与技术设计](../designs/vibechat-mvp-product-and-technical-design.md) 为准；当前差距见 [Space App 设计演进与实施记录](../../development/active/space-app-design-transition.md)。

## P0：已完成的聊天、市场与工程基线

- Site、Web、Backend、Admin 和 Docs 是独立构建单元。
- Better Auth、Matrix identity/device、社交、真实 timeline 和完整消息操作已形成。
- Discover、官方 Space 目录、分类、详情、收藏、版本和模板建 Space 是活动能力。
- 跨宿主 contracts/client/core/platform/i18n/ui packages 已有稳定导出和门禁。
- 文档生命周期、类型和验证治理已形成。

完成证据：现有 Active 文档、TEST-CATALOG #26–#39 与 2026-08-14 发布说明。

## P1：Space 语义与兼容护栏

- 用户语义统一为 Space；Matrix Room 只作为底层协议/兼容 ID。
- 保留 `/v1/spaces`、Discover、收藏、`spaceId/spaceVersionId` 和模板创建。
- 将现有 `room_index` 原地升级为唯一 SpaceInstance；历史私聊、群聊和新增多人 Space 共用一套实例模型。
- 建立 Template lineage、Project/Revision/Release/State/Agent schema，不新建平行 `space_instances` 表。
- 为 v1/v2 Matrix state、历史 Space bootstrap 和空白创建建立双读/回滚方案。
- 评审 `apps/space-runtime`、内部认证、Agent/Runtime provider 和网络边界。

完成标准：旧 Space/客户端继续工作，市场与 Chat 不降级，新契约有可执行 spec。

## P2：Kernel、Chat、App 与 Space SDK

- 支持空白或模板两种 Space 创建模式，并支持空白 Space 后续应用模板。
- 新增与 `chat-app-server` 同构的 Node/Hono `apps/space-runtime`：SpaceInstanceServer、SSE/command、串行 Turn、ProjectStore、agentOS Apps Dev/Release。
- 建立固定 Kernel、完整 Chat 和隔离 App 三边界。
- 实现 members/messages/presence/state/event/chat/agent/theme 的最小 Space SDK。
- 建立 membership/ACL、Runtime session、snapshot、bridge 和双浏览器恢复。

完成标准：模板/种子 App 可在真实 Space 中多人互动；现有一对一/群聊与多人 Space 解析为同一 Instance Server；App 故障不影响完整 Chat。

## P3：Agent Adapter、Space Dev 与 Draft

- 建立 provider-neutral Agent Registry/Adapter，首批用 Pi 与 fake/第二 Adapter 验证。
- 普通人类 Chat 不触发 Agent；显式 Agent 请求以 Matrix `eventId` 幂等入队。
- 同 Space 串行、跨 Space 有限并行；Conversation 只回复，Revision 进入 Space Dev。
- 持久化 Project、queue、lease、Agent session ref、App State 和 Draft。
- 接入逐请求积分预留、usage、结算、失败退款和恢复。

完成标准：成员可以选择 Agent 定制 App，切换 Agent 不改变平台契约，失败不破坏 Chat/Draft/Live。

## P4：不可变发布、治理与恢复

- Publish 固定 Revision 并成为顺序屏障。
- 构建不可变 Release、artifact hash、SBOM/provenance，并原子激活 Live。
- Admin 支持 Template/Agent/Release 审核、冻结、撤销和审计。
- 完成 Runtime 扩缩容、压测、监控、备份恢复、安全审计和账务 reconciliation。

完成标准：成功、失败、重试、重启、撤销和恢复链路在真实 provider 上通过。

## P5：生产就绪与市场演进

- 现有认证、社交、完整 Chat 和 Space 市场回归持续全绿。
- TEST-CATALOG #40、文档、构建和安全门槛全部通过。
- 在官方市场基础上独立评审第三方模板提交、审核、签名、更新、排名和分成。
- 逐步增加语义更清晰的 Template API；旧 API 只在所有消费者迁移后考虑兼容处置。

完成标准：Space 市场、Chat、Agent 和 App 达到生产门槛，没有以新能力换取基础功能回退。

## 后续独立项目

公共 Space/社区、第三方模板生态、Agent 市场、多 Agent 协作、自带 provider key、Space fork、外部网络 capability、E2EE、原生客户端、音视频和大型项目导入均需独立设计评审。
