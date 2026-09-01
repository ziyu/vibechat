# Space App 基础组件库 Active 实施跟踪

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-09-01
> 维护范围：`@vibechat/space-app-components`、组件 bundle/manifest、Space Project materialization、官方 Template 迁移和验收
> 稳定来源：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)
> 组件设计：[Space App 基础组件库设计](../space-app-component-library-design.md)

## 当前结论

阶段 0 工程基线、阶段 1 identity 和阶段 2 Chat 公共边界已经建立：package 现提供注入式 context、完整 Chat controller、SSR-safe Custom Element、semantic token、Foundation、User/Agent identity、Matrix message view、Composer、Mention、Attachment、Reaction/MessageActions、可恢复错误和 Timeline 容器。

2026-09-01 完成 Chat Author Card 的 package 与首轮 Template 消费：`@vibechat/space-app-components@0.11.1` 让所有可见消息作者名由公共 Timeline 提供 hover/focus 预览与 click/Enter/tap 固定交互，成员复用 `UserInfoCard`，Agent 复用 `AgentCard`。实现只消费现有 message author/SDK snapshot，每个 Timeline 只创建一个共享 top-layer 浮层并保留无 Popover fallback；五个官方 Template 已签锁相邻 development 版本和同一 exact component version/integrity，没有复制 profile 查询、DOM 或事件状态。隔离真实 Template iframe、响应式、键盘和触摸证据已通过；真实 Matrix 完整回归、人工 screen reader、生产 managed publish 与不可变 Release 仍是独立未完成出口，因此整体工作流保持 Active。

2026-08-27 已把首个官方迁移切片从相对 vendor 路径升级为长期依赖契约：`space-default@0.1.3` 使用语义化 `@vibechat/space-app-components/chat/inline` import、精确 `0.5.0` dependency 和 `space-app-dependencies.json` integrity；普通浏览器构建使用 `/chat`，只有当前自包含 HTML delivery 使用 `/chat/inline`。`@vibechat/space-app-dependencies` 通过注入 Registry 生成 prepared artifact，Runtime 的 Dev、发布、手工部署和冷启动共用该产物，并通过已有 `artifactObjectKey/artifactHash` 与 source object 分开持久化。源码不包含生成 vendor 目录，浏览器不访问 npm/CDN，公共 API 也不暴露 Registry artifact/object-key 路径。

随后审计补丁签锁 `@vibechat/space-app-components@0.6.0` 与相邻 development Template `space-default@0.1.4`：Host 在 SDK snapshot 显式下发 Chat permissions，message view 结合 ownership/status 生成 action availability，Timeline 通过公开 property/event/`::part` 正式组合 Actions/Reaction，并以 `chat-message-entry` 提供稳定测试入口。Default adapter 删除 Shadow DOM 查询和运行时 style 注入，使用组件公开 type-only imports；可见且打开时按最新 Matrix message ID 去重发送非阻塞 read receipt，并补齐 dock unread 累积与可访问名称本地化。`0.6.0` 当前完成本地可发布 package 与仓库 release lock，未上传生产 managed Registry/Object Store，也未生成不可变 Space Release。

本轮进一步新增 `@vibechat/space-app-components@0.7.0` 与相邻 development Template `space-default@0.1.5`，不覆盖 `0.1.4` lock。交互 Timeline 现在只呈现一套 canonical Reaction，候选 Reaction 与 reply/edit/delete/retry 进入 compact MessageActions；桌面使用浮层，窄屏使用带 backdrop 的 action sheet，覆盖焦点循环/恢复、Escape、外部点击、危险删除二次确认和英中内建文案。相邻同作者消息按五分钟窗口分组，重复 author/time/delivery 与 avatar chrome 被压缩；controls 使用 `fit-content` 跟随消息方向和气泡。独立 MessageActions 仍保持 inline 默认，因此这是新增 compact 能力与交互 Timeline 默认优化，不要求旧消费方迁移。`0.7.0` 当前仍只有本地 release lock/构建证据，未上传生产 managed Registry/Object Store。

本轮没有改写任何既有 Published Release。托管依赖解析、Registry 缺失/漂移 fail closed、旧 Space 后加依赖、prepared 缓存冷启动和 source/artifact 分离已有 unit 证据；`space-default@0.1.3` 也已在真实本地 Rivet/AgentOS Dev VM 中生成 ready Revision，并在完整开发栈冷启动后从同一 prepared artifact 恢复。首个抽屉式 Template `space-focus@0.1.3` 已固定 `@vibechat/space-app-components@0.7.0`，保留共享便签桌面并删除 Template 自有 Chat renderer/composer/state machine；单 Chromium 真实 Matrix iframe 已覆盖发送、回复、Reaction、抽屉 unread、刷新恢复和 390px 布局。生产 Object Store publish、不可变 Release、真实 Matrix 双浏览器和完整交互/a11y 矩阵仍未执行，因此 C1/C3/C5 与“可供所有生产 Space 使用”都不能标记 Complete。

当前基线已推进到 `@vibechat/space-app-components@0.7.4`：Default `0.1.6`、Campfire `0.1.5`、Focus `0.1.6`、Arcade `0.1.3` 与 Postcard `0.1.3` 固定同一 exact version/integrity。compact More 在支持 Popover API 时使用 top layer、native light-dismiss 和 `::backdrop`，不支持时保留 fixed/backdrop/document fallback；移动 action sheet 显式占用 `100vw - 1.5rem`，指针关闭在下一帧恢复 trigger 焦点。四个差异化 Template 均保留抽屉原有 `transform` 与 `backdrop-filter`，真实 E2E 证明公共组件不依赖 Template CSS workaround。五个官方 Template 已完成共享 Chat controller/elements 迁移，并分别保留全屏 Chat、夜航电台、共享便签、像素徽章和暖纸明信片场景。生产 publish、不可变 Release、双 Chromium 和完整 a11y 矩阵仍未执行，因此 C1/C3/C5 继续保持 Active。

2026-08-28 新增 `@vibechat/space-app-components@0.8.1` 的 side-effect-free `/recipes` 和自包含 `/recipes/inline`。`mountDefaultChatRecipe` / `mountChatDrawerRecipe` 统一 controller snapshot、typed events、增量 render、unread/read receipt 与幂等 dispose；Template 继续拥有 copy、markup、主题、launcher 和场景状态。Default/Focus 以相邻 development `0.1.7` 分别验证 full/dock 消费；Campfire/Arcade/Postcard 仍固定 `0.7.4`。真实 E2E 首轮发现 inline bundle 未注册 Custom Element 后，改由专用 browser entry 生成，并增加四个关键 Chat element 的 bundle 防回归检查。随后又发现本地 Registry 只接受当前版本，已改为 gitignored `dist/managed-registry/<version>/package` exact-version 缓存；`0.7.4` 与 `0.8.1` 可同时解析且 integrity 漂移 fail closed，不需要修改旧 Template 或既有 Revision。该本地缓存不替代生产 Registry/Object Store publish。

同日完成 managed Registry/Object Store 生产接线和隔离 Cloudflare preview。Backend 新增不可变 package release 表、专用 publish/只读 resolve API 和规范化 JSON envelope；Runtime 生产模式只使用远程 provider，开发模式仅在远程未命中后回退 gitignored cache。隔离 D1/R2 实跑同时发布 `0.7.4`/`0.8.1`，重复 `0.8.1` 幂等返回原记录、内容漂移返回 409，Runtime 远程 provider 分别解析 66/74 个文件。包内 README 属于不可变发布内容，因此文档与发布工具变化没有重签 `0.8.1`，而是新增 browser API/behavior 不变的 patch `0.8.2`；其重复发布和 74 文件远程解析也已通过。该证据证明 Cloudflare D1/R2 路径和发布控制面可运行，但尚未向真实部署环境发布组件、生成本轮不可变 Space Release 或完成跨 Runtime 恢复，因此 C1/C3 继续保持 Active。

组件库主线随后以向后兼容 minor 签锁 `@vibechat/space-app-components@0.9.0`，补齐 Agent P0 的 provider-neutral activity 层：`createSpaceAgentActivityView` 只投影有限 stage、queue count 和 activity label/detail，明确丢弃 provider `input/output/arguments/payload`；`createSpaceAgentController` 只订阅注入 SDK；`AgentQueueStatus`、`AgentActivity` 和 `AgentActivityPanelRecipe` 均为只读、SSR-safe，并提供文本状态、polite live region、forced-colors/reduced-motion fallback。离线 catalog 在同一 dark signal/light field-note DOM 中完成 390px 无横向溢出和无 console warning/error 走查。该版本没有升级任何官方 Template 或既有 Space，也没有修改 Runtime/Backend；下一切片才由 Template 显式升级后替换手写 build panel。

当前切片已推进到 `@vibechat/space-app-components@0.9.3`，并由 Default/Focus 相邻 development `0.2.0` 消费 Agent activity。`0.9.1` 引入的 Chat Recipe 兼容桥保持不变：三个 deprecated `build/buildTitle/buildStage` 节点全部存在时行为不变，全部不存在时使用脱离文档的隐藏占位，只删除部分节点仍 fail closed；可见 Agent 状态只由 `AgentActivityPanelRecipe` 投影。`0.9.3` 又将默认可见性收敛为 active/queued-only，idle 同时设置 `hidden`、`aria-hidden` 与 `display:none`，需要常驻状态的 Space 才显式传入 `showWhenIdle: true`。两个 Template 复用同一 SDK/context，同时挂载 full/dock Chat Recipe 与只读 Agent Recipe，删除手写 build DOM/CSS；隔离 Chromium 2/2 已覆盖 idle 隐藏、动态 stage/queue/activity、390px、200% 字体、forced-colors、reduced-motion 和无 console/page error。既有 Template/Revision/Release 不自动升级；Default `0.2.0` 已完成真实 Matrix/Pi/DeepSeek 双浏览器 ready Revision 和 `0.9.3` 单浏览器 Pi/积分结算走查，Focus 和不可变 Release 尚未验证。

同日补齐真实 Runtime progress 到组件的 SDK bridge：Host 已投影的 `turn_started`、`status`、`activity`、`queue_updated` 和完成事件现在归并到同一 `space.agent` snapshot，真实 Agent identity 从结构化 mention target 解析，activity 按 `toolCallId/label` 原位更新、以时间正序保存且尾部为最新，最多保留四条；没有 active Turn 时 progress fail closed。该补丁不修改组件 package、Template lock 或 Agent 调度权威。Node 24 下 Runtime/SDK/Agent/Host 定向 unit 4 files、20/20 已通过；经用户明确授权，真实 Pi/DeepSeek 双浏览器 Revision E2E 1/1（25.5 秒）也已通过。

用户走查随后确认 idle Agent panel 不应占用默认 Chat 纵向空间。`@vibechat/space-app-components@0.9.3` 将 Panel Recipe 的默认可见性收敛为 active/queued-only：idle 同时设置 `hidden`、`aria-hidden` 和 `display:none`，避免 Template 的宿主 `display:block` 覆盖浏览器默认 hidden；需要常驻身份状态的 Space 可显式 `showWhenIdle: true`。Default/Focus development `0.2.0` 已重签到 exact `0.9.3`/integrity，既有 prepared Revision/Release 不自动升级。该版本已通过正常鉴权端点发布到本地 managed Registry，并在新建真实 Default Space 中确认组件版本 `0.9.3`、idle `visible=false`、结构化 Pi Conversation 回复和真实 credits 结算。

组件库主线现已签锁兼容 minor `@vibechat/space-app-components@0.10.0`，建立 User/Member 公共层：只读 User Directory controller、带文字的 UserPresence、MemberListItem/MemberList、统一 MentionTargetItem 与 typed member-select event。内部按 identity/directory/mention/register 拆分，Chat MentionMenu 只复用 target identity，既有结构化 Mention event、键盘和 Agent 调度边界不变。离线 catalog Chromium 已覆盖 390px + 200% 字体下的 container-query 重排、forced colors、reduced motion、空状态、长文和完整 roving keyboard；本轮没有升级任何 Template、Project、Revision 或 Release。

相邻 Template 消费已由不可变 patch `0.10.2` 完成：已发布的 `0.10.1` 因 `/user/inline` 仅注册 elements、未导出 controller/context 而保留为历史，`0.10.2` 用独立 inline browser entry 同时注册并导出正式 User API。Campfire development `0.1.6` 固定 exact `0.10.2`，通过同一个注入 SDK/context/User Directory controller 渲染真实 `vc-space-member-list`，删除手写成员 HTML，同时保持电台主题、presence 场景和共享 Chat 不变。受管 Registry 发布、重复幂等、90 文件 exact resolve、组件/Template unit、App typecheck、组件 catalog + Campfire Chromium 2/2 与 Impeccable detector 均已通过；历史 `0.1.5` 和既有 Revision/Release 未改写。隔离完整栈中的真实 `chat-matrix-room.spec.ts` 6/6 又证明 Campfire iframe 精确加载 `0.10.2`、Matrix 成员经公共 MemberList 呈现，发送、回复、Reaction、刷新恢复与 Default 恢复均无回归。随后 package README 修正 `0.10.1` 历史说明时，immutable build gate 正确拒绝改变 `0.10.2` 内容，因此新增代码 API 不变的文档 patch `0.10.3` 并单独发布，Campfire 继续固定已验收的 `0.10.2`。screen reader 仍待独立环境验证。

## 状态定义

| 状态 | 含义 | 证据要求 |
| --- | --- | --- |
| 未开始 | 只有设计，没有实现入口 | 设计和完成条件 |
| Active | 已有代码切片并持续验证 | package、测试、bundle/hash 和文档证据 |
| Blocked | 外部依赖阻止继续验证 | 阻塞、owner 和解除条件 |
| Complete | 对应阶段的完成条件全部满足 | 真实 Runtime/Template/浏览器证据与回归 |

## 工作流与设计追踪

| ID | 工作流 | 设计章节 | 状态 | 当前证据 | 下一出口 |
| --- | --- | --- | --- | --- | --- |
| C0 | Package 与公共边界 | §5–§7 | Active | `packages/space-app-components`、显式 exports、边界策略、package/type/build 全绿 | 阶段 1 公共 API 与 SemVer 证据 |
| C1 | Bundle 与版本 | §12、§15 阶段 0 | Active | `0.11.1` tracked managed release；Focus `0.2.0` 已有 exact `0.9.3` 不可变 Release 与第二 Runtime 同 artifact 恢复；历史版本已有本地/隔离 D1/R2 publish/resolve | 当前版本真实云部署 publish 与 Release 证据 |
| C2 | Context 与 renderer | §7、§9 | Active | SDK 注入、snapshot/User Directory controller、SSR-safe Avatar/User elements；Campfire `0.1.6` 的坏图 fallback、ARIA tree、键盘、390px/200% 与真实 Matrix iframe 均通过 | VoiceOver/NVDA 人工扩展 |
| C3 | Project/Runtime 固化 | §12、§15 阶段 0 | Active | source/prepared 双 artifact、定向 unit、本地真实 AgentOS Dev/冷启动，以及 Focus 不可变 Release/第二 Runtime 同 artifact 恢复 | 真实云生产 Object Store 演练 |
| C4 | User/Agent identity/activity | §8、§15 阶段 1、3 | Active | `0.10.2` User/Member 公共层与 Campfire MemberList；`0.9.3` Agent activity、Default/Focus 隔离 iframe、Default 真实 Agent及 Focus 不可变 Release | 补 Focus 真实 Agent 与 VoiceOver/NVDA |
| C5 | Chat 与 Template 迁移 | §8、§15 阶段 2–4 | Active | 五个官方 Template 已共享 Chat，并以 Default/Focus `0.2.1`、Campfire `0.1.7`、Arcade/Postcard `0.1.4` 固定 `0.11.1` Author Card；隔离 full/dock/touch Chromium 通过，旧版本真实 Matrix、Default Agent 与 Focus Release 已有证据 | 补当前五 Template 真实 Matrix Author Card、Focus 真实 Agent与真实云部署 publish |

## 当前 Active 切片

Recipe 第一切片已完成：五个 Template 曾重复的 controller snapshot → Timeline/Composer/Mention/Error 装配、typed event、unread/read receipt 和 lifecycle 已收敛到语义化 `/recipes` 公共入口。Recipe 只接收注入 context、Template copy 和既有标准元素，不拥有主题、launcher markup、场景状态、Matrix/Agent 权威或 Kernel 操作。Default 全屏和 Focus 抽屉以相邻 development `0.1.7` 固定 exact `0.8.1`/integrity；另外三个 Template 与既有版本继续固定 `0.7.4`，由本地多版本 Registry 和 prepared artifact 保持可运行。

managed Registry/Object Store 接线已完成代码、迁移、unit 和隔离 Cloudflare D1/R2 preview；Focus 又补齐不可变 Release 与第二 Runtime 同 artifact 恢复。Agent activity 公共能力与首批 Template 消费已完成：package、catalog、Default/Focus 相邻版本和隔离 iframe 共同固定 provider-neutral view/controller/element/recipe；Default 另有真实 Matrix/Pi/DeepSeek 双浏览器 ready Revision 证据。Focus 真实 Agent、当前 tracked release 的真实云 publish 和 VoiceOver/NVDA 仍是独立出口，不能以 mock SDK、旧版本 Release 或浏览器 accessibility tree 冒充。

### 目标

在不增加 Agent 调用权威和 provider 泄漏的前提下，让 Default/Focus 相邻 Template 通过 exact `0.9.3` 消费可由所有 Space 复用的 Agent activity 公共层：view model/controller 只消费注入 SDK，Queue/Activity element 提供稳定文字、ARIA、part 和 responsive contract，Panel recipe 只负责只读装配并默认仅在 active/queued 时可见；既有 Template、Revision 和 Release 不自动升级。

当前 `0.10.0` 切片把阶段 1 从单个身份卡扩展为可组合的 User/Member 公共层：新增只读 User Directory controller、UserPresence、MemberListItem、MemberList 和统一 MentionTargetItem。组件只消费注入 SDK 与结构化 target，保留 SDK 顺序和现有 Mention typed event；本切片不升级 Template、不引入 Matrix/Agent 调度权威，也不改写既有 `0.9.3` package 或 Revision/Release。

下一相邻切片先保留并发布 immutable `0.10.0`，再以 patch 增加自包含 `agentos-app-v1` 所需的语义化 `/user/inline` delivery entry。浏览器走查发现已上传本地 Registry 的 `0.10.1` 仅完成 elements 注册、没有导出 controller/context，因此该版本不覆盖，改由 `0.10.2` 使用独立 inline browser entry 同时注册和导出正式 API。首个消费方只升级 Campfire development `0.1.6`：同一个注入 SDK 建立 context/User Directory controller，以公共 `vc-space-member-list` 替换手写成员 pill renderer；Campfire 主题、presence 场景和既有 Chat adapter 保持不变，历史 `0.1.5` Version/Project/Revision/Release 不改写。

### 任务

- [x] 将 component package 与 CSS token contract 升级为向后兼容的 `0.2.0`，保留阶段 0 Avatar API。
- [x] 实现 semantic token、IconButton、StatusDot、UserAvatar、UserName 和 UserInfoCard。
- [x] 实现 AgentAvatar、AgentBadge、AgentStatus 和 AgentCard；Agent 状态只消费显式 view model/SDK snapshot，不触发 Agent。
- [x] 增加 `/user`、`/agent`、`/styles` 公共出口和统一 element registrar，保持 SSR-safe 与领域 tree-shaking 边界。
- [x] 扩展离线 catalog，以完全不同的 dark signal / light field-note 主题复用相同 identity 组件。
- [x] 将 package/CSS token 升级为向后兼容的 `0.3.0`，增加 `/chat` export 并由根 registrar 聚合注册 Chat elements。
- [x] 实现只消费 `snapshot.chat.messages` 的 message/reply/reaction/author view model，覆盖 unknown member、Agent、deleted/edited/delivery 与缺失 reply。
- [x] 实现分别订阅 messages、typing、members、mentions、agent 的只读 timeline controller；typing/presence-only 更新保持 messages 引用稳定，dispose 幂等。
- [x] 实现 MessageMeta、ReplyPreview、ChatBubble、ChatMessage 和 TypingIndicator；typed property、SSR-safe attribute、open Shadow DOM、semantic token 与 `::part` 形成公开契约。
- [x] 将 Chat 长文案、reply/deleted/failed/Agent 状态加入同 DOM 双主题离线 catalog，并建立 unit/SSR/浏览器证据。
- [x] 将 package/CSS token 升级为向后兼容的 `0.4.0`，保留 `0.1.0`–`0.3.0` 已有 API。
- [x] 实现完整 `createSpaceChatController`，覆盖全部 SDK Chat commands、结构化 Mention、typing timer、pending/error recovery 与幂等 dispose；保留既有只读 timeline controller。
- [x] 实现 Timeline、Composer、MentionMenu、Attachment、ReactionBar、MessageActions 与 ChatErrorState；交互只发 bubbling/composed typed events，Template adapter 决定何时调用 controller。
- [x] 建立 Enter/Shift+Enter/IME guard、Mention keyboard、结构化 `mentionIds`、安全附件 URL、显式 action permission、reaction 语义、滚动锚点与失败恢复的 unit/DOM/浏览器证据。
- [x] 发布兼容补丁 `@vibechat/space-app-components@0.4.1`，让 `/chat` 直接公开 context/controller/typed events/elements，并为迁移 E2E 增加稳定 `data-testid`。
- [x] 签锁 `space-default@0.1.3`，将固定 `chat.js` artifact materialize 到普通 Project 文件并校验 source/artifact/manifest hash。
- [x] 用薄 adapter 接收同一个注入 SDK，以 controller snapshot 驱动 Timeline、Composer、Mention、Error、Actions 和 Reaction；删除 Template 内重复实现。
- [x] 增加 `@vibechat/space-app-dependencies`、`space-app-dependencies.json`、managed Registry release 和 `@vibechat/space-app-components@0.5.0` 语义化 subpath exports；Space 源码使用普通 package import。
- [x] 增加 Host→SDK `chat.permissions`，由 message view 结合 ownership/status 生成 actions；Timeline 公开 `interactive`、`interactionDisabled`、`reactionChoices`、稳定 `chat-message-entry` 与嵌套 action/reaction parts。
- [x] 将 Default 升到 development `space-default@0.1.4` / exact `0.6.0`，删除 Timeline Shadow DOM 查询和 style 注入，改用组件公共类型与 parts；read receipt 按最新消息去重且不占全局 command pending。
- [x] 将组件升到 `0.7.0`、Default 升到相邻 development `0.1.5`；交互 Timeline 只保留 canonical Reaction + compact More，新增五分钟消息分组、气泡锚定 controls、桌面浮层/移动 action sheet、键盘焦点管理和危险删除确认，同时保持 standalone MessageActions inline 默认兼容。
- [x] 将首个抽屉式官方 Template `space-focus` 升到相邻 development `0.1.3`，固定同一个 `@vibechat/space-app-components@0.7.0`；保留共享便签桌面、主题和抽屉开关，只删除 Template 内重复的 Chat renderer/composer/state machine，并验证既有 `0.1.2` release lock 与已存储 Space Revision 不被改写。
- [x] 将组件升级到 `0.7.4`，让 compact More 在支持 Popover 时进入 top layer，并为无 Popover 浏览器保留 fixed/backdrop fallback；覆盖 390px 全宽 action sheet、native light-dismiss、Escape、外部点击和确定性焦点恢复。
- [x] 将 Campfire 升到 development `0.1.5` 并迁移共享 Chat controller/elements；Default/Focus 分别升到 `0.1.6`，三者固定同一 exact `0.7.4` 与 managed integrity，既有中间版本锁不改写。
- [x] 将 Arcade 升到 development `0.1.3` 并固定 exact `0.7.4`/managed integrity；保留像素徽章、共享 signal、presence、主题及原抽屉 transform/blur，删除重复 Chat renderer/composer/state machine，且不改写 `0.1.2` lock。
- [x] 将 Postcard 升到 development `0.1.3` 并固定 exact `0.7.4`/managed integrity；保留卡片状态、最多十张限制、寄出表单、presence、暖纸张主题及原抽屉 transform/blur，删除重复 Chat renderer/composer/state machine，且不改写 `0.1.2` lock。
- [x] 以向后兼容 minor 版本新增 `/recipes` 与 `/recipes/inline`，保留 `/chat`、`/chat/inline` 和已有公开 API；recipe bundle 继续满足 Chat gzip 预算、SSR import-safe、无远程 runtime import。
- [x] 实现 `mountDefaultChatRecipe` / `mountChatDrawerRecipe` 与幂等 handle：统一完整 typed event 装配、增量 render、unread、可见时 read receipt 和 dispose，不读取全局 SDK，不固定 Template 主题、launcher markup 或场景状态。
- [x] 将 Default/Focus 升到相邻 development `0.1.7` 并固定新的 exact component version/integrity；删除两份重复 `bootstrapChat` 主体，保留各自 copy、markup、主题、全屏/抽屉模式和既有历史 lock。
- [x] 用 unit/package/bundle/Template TypeScript、Catalog/hash 和真实 Matrix 全文件 E2E 证明 full/dock 两种 recipe 消费；未迁移 Campfire/Arcade/Postcard 继续固定 `0.7.4`，既有 Space/Revision/Release 不自动升级。
- [x] 在 Candidate 隔离树中校验并 materialize exact version/integrity，只改写 prepared `package.json`；source 和 Agent workspace 禁止生成 vendor/resolved manifest。
- [x] 将 prepared artifact 接入 Dev Preview、Publish、手工部署和冷启动，并通过 `artifactObjectKey/artifactHash` 与 source object 分开持久化；旧无 lock Space 保持原 Revision ID 算法。
- [x] 建立 Registry unavailable、version/hash drift、generated path collision、旧 Space 后加依赖、prepared tamper、冷启动不访问 Registry和最后 ready Revision 保留的 unit 证据。
- [x] 定义规范化 managed package object envelope；发布记录只保存 name、exact version、integrity、project formats、object key/hash 和创建时间，不保存 Git/dist 路径或公共下载 URL。
- [x] 增加独立发布凭证、幂等 publish 与只读 resolve 内部 API；同版本同内容返回原记录，同版本内容漂移返回冲突，Runtime 凭证不能执行 publish。
- [x] Runtime 生产默认只使用远程 Registry；开发模式可在远程未命中时使用 gitignored 多版本 cache，生产不得回退到 workspace `dist`。
- [x] 覆盖无本地 `dist` 冷启动、`0.7.4`/`0.8.1` 共存、对象缺失/篡改、错误 integrity/project format 和 Existing Revision/Release 不升级，并完成 PG/SQLite/D1 migration 与 Cloudflare preview。
- [x] 新增 provider-neutral Agent activity/queue view model；只保留有长度/数量上限的公开 stage、label、detail 和 count，不投影 provider payload、模型、积分或 Kernel 字段。
- [x] 新增只读 Agent controller，复用注入 `SpaceAppClient`、去重等价 snapshot、幂等 dispose，不提供 `agent.invoke()` 或第二个 SDK client。
- [x] 新增 `vc-space-agent-queue-status`、`vc-space-agent-activity` 和 `AgentActivityPanelRecipe`，保持普通入口 SSR-safe、registrar-only side effect、typed property、安全 attribute、公开 part 与英中内建文案。
- [x] 将组件 package 升为向后兼容 `0.9.0`，更新离线双主题 catalog、package README、bundle gate 和 managed release lock；未升级任何官方 Template 或既有 Space。
- [x] 签锁兼容 patch `0.9.1`：保留 deprecated Chat build element 类型字段；完整旧 DOM 继续工作、完全缺失时使用 detached hidden placeholder、部分缺失 fail closed。
- [x] 将 Default/Focus 升到相邻 development `0.2.0`，首次固定 exact `0.9.1`/integrity，复用同一 context 挂载 full/dock Chat Recipe 与 `AgentActivityPanelRecipe`，删除手写 build DOM/CSS 且不改写历史 lock。
- [x] 将真实 Runtime `turn_started/status/activity/queue_updated/completion` 事件归并到 injected SDK 的同一 `space.agent` snapshot；实际 Agent identity/stage/queue/tool activity 触发已有 controller，孤立 progress fail closed，不注入演示状态。
- [x] 签锁 `0.9.3` 并将 Default/Focus development `0.2.0` 重签到该 exact version/integrity；Panel Recipe 默认只在 active/queued 时显示，idle 同时退出布局与辅助技术树，`showWhenIdle: true` 保留显式常驻扩展点。
- [x] 用隔离 Chromium 2/2 验证动态 Agent stage/queue/activity、390px、200% 字体、forced-colors/reduced-motion、无横向溢出、无动画、无 console/page error和 Composer 可见性。
- [x] 以兼容 minor `0.10.0` 新增 User Directory snapshot/controller；只订阅注入 SDK 的 members，保持 self + members 顺序、等价更新去重和幂等 dispose。
- [x] 新增 UserPresence、MemberListItem、MemberList 与 `vc-space-member-select` typed event；覆盖可见状态文字、空状态、selected/disabled、44px target、roving keyboard、390px/200% 字体和 forced-colors/reduced-motion。
- [x] 新增统一 MentionTargetItem，并由 Chat MentionMenu 内部复用；保持既有 targets property、ArrowUp/ArrowDown/Enter/Escape 与 `vc-space-mention-select` API 不变，不增加 Agent 调用入口。
- [x] 扩展离线 catalog、unit、SSR/register/bundle gate，签锁 `0.10.0` source/artifact/integrity；本切片不迁移 Template，首个 Template 消费留给后续相邻版本。
- [x] 将已经签锁的 `0.10.0` 通过正常鉴权端点发布到 managed Registry，并验证重复发布幂等与 exact integrity resolve。
- [x] 以 `0.10.2` 新增可消费的 `/user/inline` 独立 browser entry，并补 semantic export、SSR/package、bundle metadata 和无远程 import gate；已发布的 `0.10.0`/`0.10.1` 不覆盖。
- [x] 将 Campfire 升到相邻 development `0.1.6`，固定 exact `0.10.2`/integrity，通过同一 SDK/context/User Directory controller 渲染真实 MemberList；保留 Chat、主题和 presence 场景并删除手写成员 HTML。
- [x] 完成 Campfire MemberList 定向 unit/Chromium、App typecheck 和 Impeccable detector，并记录 source/manifest/integrity 与剩余未覆盖项。
- [x] 在可用的本地 Synapse/完整开发栈中执行 Campfire 真实 Matrix Chat 发送、回复、Reaction 和刷新恢复回归。
- [x] 建立 long name、图片失败、keyboard、浏览器 accessibility tree、200% 字体、forced-colors 与 reduced motion 的 unit/DOM/浏览器证据；VoiceOver/NVDA 人工实测不由该自动化证据冒充。
- [x] 在真实本地 Rivet/AgentOS Dev 与完整开发栈冷启动恢复中验证相同 component artifact/revision hash。
- [x] 在 Focus `0.2.0` 不可变 Release、受管 Object Store pointer 和第二独立 Runtime 恢复中验证相同 prepared/component dependency artifact；真实云生产部署仍由 C1/C3 单独跟踪。
- [x] 经用户明确授权向已配置模型 provider 发送测试 Space 源码后，在真实 Matrix/AgentOS 双浏览器 ready Revision 中验证 Default `0.2.0` 的 Chat 与 Agent activity。
- [ ] 在真实 Matrix/AgentOS 双浏览器中补 Focus `0.2.0`，并在不可变 Release 中验证 Default/Focus 的 Chat 与 Agent activity；Focus immutable Release/跨 Runtime 半侧已通过，真实 Agent 源码外发仍需单独明确授权。
- [x] 更新 Space 内 Pi 生成约束：内建公共 component catalog 与 exact release/integrity，优先复用 User/Chat/Agent/Recipe，禁止复制组件源码、读取 Shadow DOM 或引用 Registry 路径。
- [x] 在公开 Docs 中提供中英文 API 参考和真实交互 playground，并覆盖双主题、Agent 状态、成员键盘选择、Composer、390px 和 console error。
- [x] 提供默认 dry-run、显式 `--write` 的仓库级迁移计划工具；只更新 `package.json` 与 `space-app-dependencies.json`，未知 schema fail closed。
- [x] 评估 React adapter：当前 Project JSX/browser build 契约未稳定，继续延后并复用同一 Web Component/controller contract，不为完成阶段 5 复制第二套 API。
- [x] 以向后兼容 minor 版本为 `SpaceChatAuthorView` 增加可选成员 presence 与 Agent status/summary/queue 投影；旧消费者构造的 author 对象继续安全降级。
- [x] 将每个可见消息作者名改为可访问触发器，Timeline 只维护一个共享作者卡浮层；hover/focus 预览、click/tap 固定、Escape/外部点击/再次激活关闭且无 listener/timer 泄漏。
- [x] 成员作者真实组合 `UserInfoCard`，Agent 作者真实组合 `AgentCard`；覆盖 unknown identity、长名字、RTL、390px、200% 字体、forced-colors、reduced-motion、触摸和键盘。
- [x] 为五个官方 Template 签发相邻 development 版本并固定同一 exact component version/integrity；历史 Version、Project、Revision 与 Release 不改写。
- [ ] 完成 package/unit/bundle、五 Template typecheck/catalog、隔离 Chromium full/dock 与真实 Matrix 回归，并记录未执行的人工 screen-reader/真实云证据。

### 完成条件

- `0.1.0` 已公开的 Avatar、Context、manifest 与 materialization API 继续兼容；新增 API 记录为 minor change。
- identity 组件只接受 typed property/安全 attribute，不读取全局 `space`，不使用颜色作为状态唯一信号。
- 两套主题只覆盖 `--vc-space-*` token 和布局，不复制 Avatar/User/Agent identity 逻辑。
- keyboard、浏览器 accessibility tree、200% 字体、长文案和图片失败状态通过；forced-colors/reduced-motion 同时进入样式契约和真实浏览器模拟。VoiceOver/NVDA 人工实测若执行，作为额外平台证据单独记录。
- bundle 保持离线、自包含；Foundation/core 领域入口低于 20 KiB gzip，Chat 入口低于 35 KiB gzip，聚合入口按 Chat 预算治理；package、边界、unit、typecheck、build、文档与浏览器检查通过。
- 受管 Registry 与 Runtime 接线已有代码/unit 和隔离 Cloudflare D1/R2 preview；本地真实 Dev/完整栈冷启动、Focus 不可变 Release和第二 Runtime 同 artifact 恢复已通过。当前 tracked `0.11.1` 的真实云部署 publish 仍未执行，因此 C1/C3 保持 Active。
- `0.8.1` Recipe、`space-default@0.1.7`、`space-focus@0.1.7` 与继续固定 `0.7.4` 的 `space-campfire@0.1.5`、`space-arcade@0.1.3`、`space-postcard@0.1.3` 已完成 package/bundle、定向 unit、真实 Matrix 单 Chromium E2E 和本地 ready Revision 验证，证据见本节后续记录。生产 managed publish、真实 Matrix 双浏览器消息交互、不可变 Release 和完整 a11y 矩阵继续保持未完成。
- `0.9.3` Agent activity 公共 API 与 Default/Focus `0.2.0` exact-version 消费已完成 component/Template typecheck、bundle/managed integrity、Catalog lock 和隔离 Chromium 2/2；#40.3 的 idle 隐藏、动态显示、390px、200% 字体、forced-colors/reduced-motion 场景已通过。Default 真实 Matrix/Pi/DeepSeek Agent build 1/1 与 `0.9.3` 单浏览器 Pi/积分结算走查已通过；Focus 不可变 Release/第二 Runtime 已通过，但 Focus 真实 Agent、VoiceOver/NVDA 与真实云 publish 未执行，因此 C1/C3/C4/C5 继续保持 Active。
- SDK bridge 已以真实 Runtime event 形状完成 `space.agent` identity/stage/activity/queue/completion 的 3/3 unit；Runtime 对相同 tool call 原位更新、只保留最新四条且保持时间正序，连同组件/Host 定向测试在 Node 24 下为 4 files、20/20；真实 Pi/DeepSeek 双浏览器 ready Revision 1/1（25.5 秒）通过。
- `0.10.0` User/Member API 已完成 39/39 package unit、typecheck、managed build/bundle/integrity 和 catalog Chromium 1/1；source/browser/integrity 为 `sha256:21e5a30003d9e1ce5761381fd6cda151f39246388ead5c46b65f811612beddfe` / `sha256:c7d5199ecc59e1072cfacc792068bbd223483b9112c877ee5b001c107c94037f` / `sha256:61920297d2b7ef56c9c8b5a0a6571b8480b405e8f5dd2bd60cd97ea4ea82ad03`。本轮没有 Template 消费证据，因此 C2/C4 继续保持 Active。
- `0.10.0` 已通过本地受管 Registry 正常鉴权 publish、重复 publish 幂等与 88 文件 exact resolve。`0.10.1` 也已不可变发布并保留为历史，但 Chromium 证明其 `/user/inline` 只注册 elements、未导出 controller/context；没有覆盖该版本。修复版 `0.10.2` 的 source/browser/integrity 为 `sha256:31bea66c93a6033aabde4c16f3b105186a12525ed9e1759759690a0e23235274` / `sha256:f9a8f552156fde6bf96a046c27ba5664172f7959a6441288835c13f42ea2827e` / `sha256:4ace2dc2efdb24f0698edba7a641d128fbe68d8e5808b27b6289904a178a6128`，本地 publish 与重复幂等均通过；Runtime POST 鉴权 exact resolve 返回 90 文件，并确认 `user/inline.js` 同时包含 `createSpaceComponentContext` 与 `createSpaceUserDirectoryController`。
- README 历史说明修正触发 immutable package drift gate 后，没有改写 `0.10.2`，而是签锁 API 不变的文档 patch `0.10.3`。其 source/browser/integrity 为 `sha256:9cb78ff26721f90282f5914ba4c9e4a1faee08c1c5d7ff521c5f3973b1717cf1` / `sha256:f9a8f552156fde6bf96a046c27ba5664172f7959a6441288835c13f42ea2827e` / `sha256:939d4e1c6e73fe91d816a187efba3fb9cd52dfbf5630fae596c9d994f879017b`；本地 Registry Published + 重复 Verified，Runtime exact resolve 返回 90 文件并同时核对 User inline API 与修正后的 README。Campfire lock 继续为 `0.10.2`，没有为文档 patch 重签 Template。
- Chat Author Card 最终签锁为 `@vibechat/space-app-components@0.11.1`：source/browser artifact/integrity 分别为 `sha256:b945847c966506ab142fdb7f0292d67191f71a7782e462b7e796efd38d98294a`、`sha256:05488b66327d21b370db2e024dc3e39cc40682c7e8d5e6eda6ab488cda653ed6`、`sha256:e44df709c57b798bff752b27a7206642991a8bc7e45ca17ebea11bc492596100`。package unit 7 files、42/42，连同 Template catalog 为 8 files、51/51；package/五 Template TypeScript、managed bundle gate 和 catalog codegen/lock 通过，browser/chat/recipes gzip 为 35,108 / 27,424 / 29,942 bytes。`space-template-chat-author-card.spec.ts` 隔离 Chromium 3/3 覆盖 Default full、Focus dock 和真实 touch context；成员/Agent/unknown fallback、单一卡片、hover→card 防闪退、focus/Enter/click/tap、Escape 焦点恢复、外部点击、再次激活、scroll、重复 render、disconnect、消息删除、1280/390px、200%、CJK/RTL、forced-colors/reduced-motion 与无 console/page error 均通过。五个 Template current development lock 分别为 Default/Focus `0.2.1`、Campfire `0.1.7`、Arcade/Postcard `0.1.4`，均固定 exact `0.11.1`/同一 integrity；当前版本真实 Matrix、人工 VoiceOver/NVDA、生产 managed publish 和不可变 Release未执行。
- Campfire development `0.1.6` 的 source/manifest 为 `sha256:13a9ae94303f79451e67214f0dc433ec6bb73e4f27d849d81516ae47f9553b59` / `sha256:1989528dcbfaa55c13523a6210a9ec2968fc7448952bf7e86a75ca715f210241`；组件与 Template 定向 unit 7 files、48/48、Campfire App typecheck、catalog codegen/lock 和组件 catalog + Campfire 隔离 Chromium 2/2 均通过。浏览器从可控真实 SDK snapshot 更新成员，最终由公共 controller/MemberList 投影，Impeccable detector 返回空结果。隔离完整栈又以正常鉴权将历史 `0.10.2` 发布到真实 Registry，重复发布返回 Verified，Runtime POST exact resolve 返回 90 文件；真实 `chat-matrix-room.spec.ts` 全文件 6/6，Campfire iframe 断言 exact `0.10.2`、Matrix 成员 MemberList、发送、回复、Reaction、刷新唯一恢复与 Default 恢复，同时覆盖 Default/Focus `0.9.3` idle hidden 和其余官方 Template 回归。
- 最终文档链接、组件 bundle、Template generated catalog、应用边界、21/23 workspace typecheck、21/23 workspace build 和 docs-app production build 均通过。仓库 Turbo 远程 TLS 初始化因本机无可用钥匙串失败，验证改用相同 filter 集合的 pnpm recursive 命令；Backend build 中 Wrangler 写用户目录日志遇到 sandbox `EPERM`，但 Vite/SSR 构建完成且整体退出 0。

## 2026-08-26 验证记录

本轮使用 Node `24.19.0` 与 pnpm `9.4.0` 验证。组件 browser artifact 连续构建保持 `sha256:7de87b7ce81d882dcb6b7ce03c5e781b2be73458519da83e77ff1afb979b1312`，gzip 为 `8297` bytes，仍低于 `20 KiB` 上限。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| package typecheck/build/bundle | 通过 | `@vibechat/space-app-components` typecheck、build、`check:bundle`；无远程 runtime import |
| 聚焦 unit | 通过 | `tests/unit/space-app-components` 共 3 files、15 tests；在阶段 0 覆盖上增加 User/Agent view、状态推导、SSR renderer、注册器和安全 attribute 场景 |
| repository boundaries | 通过 | 368 个 active source files；新 package 仅允许依赖 `@vibechat/space-app-sdk` |
| package/all-app typecheck | 通过 | packages 15/15；全仓 20/20 |
| package/docs/all-app build | 通过 | packages 15/15、docs-app 3/3、全仓 20/20 |
| docs check | 通过 | archive 以外文档链接与治理检查通过 |
| offline catalog browser | 通过 | 1280px、390px 与桌面 200% 等效重排（1280→640）；无横向溢出或 console warning/error；两主题组件标签一致，User/Agent card 具备 Shadow DOM 与 ARIA group/label，404 avatar 保留 AC/WA initials 与可访问名称 |
| keyboard/touch target | 通过 | IconButton 内部为原生 button，44×44px、非空 accessible name，Space 键聚焦后显示 3px focus-visible outline |
| UI 静态检查 | 通过 | Impeccable detector 对 Foundation/User/Agent/styles/catalog 返回空结果；forced-colors、prefers-contrast 和 prefers-reduced-motion fallback 已进入组件 CSS |

未执行真实 AgentOS Dev、不可变 Release、冷启动恢复、官方 Template E2E，也未在真实 Template iframe 中完成 high contrast/reduced motion/完整 keyboard screen-reader 矩阵；这些仍是 C3/C4/C5 的未完成出口。全仓构建仍有既有 proxy、chunk size、动态/静态 import、第三方 `use client` 和 Shiki WASM fallback 警告，本切片未扩大处理范围。

### 阶段 2 第一切片验证

`0.3.0` browser artifact 连续 package/package graph/full build 均复现 `sha256:79c82d22e64e4851d70f2f933ddef164c09cbe63dd6467a3aa4c84f6228904a0`，source hash 为 `sha256:408f86ead926647cfda27ace32787d673927be8a0026fbca3370c76cb28361eb`，gzip 为 `13323` bytes，仍低于 `20 KiB` 上限。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| Chat view/controller unit | 通过 | 聚焦 suite 共 4 files、19 tests；验证只消费 Matrix timeline、保持 SDK 顺序、unknown/Agent/reply/deleted/edited/delivery/reaction、安全 SSR markup、五类针对性订阅、typing/presence reference stability 和幂等 dispose |
| package/boundary | 通过 | package typecheck/build/`check:bundle`；372 个 active source files 边界通过，无远程 runtime import、全局 SDK 或新增 Host capability |
| package/all-app typecheck | 通过 | packages 15/15；全仓 20/20 |
| package/docs/all-app build | 通过 | packages 15/15、docs-app 3/3、全仓 20/20；artifact hash 在三次构建中一致 |
| docs | 通过 | `docs:check` 与 docs production build 通过 |
| offline catalog browser | 通过 | 1280px、390px 与 200% 等效 640px；两档 `scrollWidth === clientWidth`，同一组 8 个 Chat message/2 套主题完成长文、Agent reply、missing reply、failed、deleted、reaction 和 typing 呈现；生产 catalog console 无 warning/error |
| accessibility/visual contract | 通过 | open Shadow DOM 的作者、时间、Agent badge、reply fallback、delivery 和 `role=status` 进入可访问树；failed delivery 有文字而非只靠颜色；浅色失败态对比修正后复验；forced colors/contrast/reduced motion CSS fallback 存在 |
| UI 静态检查 | 通过 | Impeccable detector 对 Chat elements/catalog 返回空结果 |

阶段 2 第一切片当时没有实现 Composer、IME、Mention、Attachment、reply/edit/delete/reaction/retry commands、read receipt 或 command error recovery；这些差距由下方 `0.4.0` 迁移前置切片补齐。在该历史切片时 Default Chat 与抽屉 Template 都尚未迁移；此后的 Default 源码迁移也不包含真实双 Chromium Matrix 和完整 screen-reader/high-contrast/reduced-motion 证据，因此 #40.3 的复合场景继续保持未勾选。

### 阶段 2 迁移前置切片验证

`0.4.0` manifest 同时固定兼容聚合入口和四个领域入口：`browser.js`、`foundation.js`、`user.js`、`agent.js`、`chat.js`。当前 source hash 为 `sha256:e6502c30847c15530ae11db2d36dfa28d5df8afddddbc899e9eacd12b08ddb24`，artifact hash 为 `sha256:4487f360d3630b7a88557c50d33ccd86c5da92864fd7fa69eeabd34d2076be27`；gzip 分别为 21,365、3,133、5,126、5,597、14,193 bytes。聚合入口和 Chat 入口低于 35 KiB，Foundation/User/Agent 均低于 20 KiB，全部入口无远程 runtime import 或第二个 SDK。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| 可写 controller unit | 通过 | 完整 Chat command surface、结构化 `mentionIds`、reply/edit、失败保留 draft/context、clear/retry、typing 去重/cleanup 与五类 timeline listener |
| 迁移前置 view/element unit | 通过 | 聚焦 suite 共 5 files、24 tests；覆盖安全 attachment metadata/SSR、typed event 常量、44px/forced-colors/responsive 样式契约和完整 element registrar |
| bundle/领域出口 | 通过 | aggregate + Foundation/User/Agent/Chat 五个内容寻址入口；按领域预算通过且 materialization/hash contract 保持不变 |
| offline catalog browser | 通过 | 同一 DOM 的 Night relay/Field notes 在桌面、390px、200% 等效 640px 下无横向溢出；Composer 三列不重叠，Timeline 初始底部锚定，console 无 warning/error |
| keyboard/event/a11y DOM | 通过 | Enter 发送、Shift+Enter 换行、Mention 结构化 Agent ID、ArrowDown、unavailable target、Reaction/Reply/dismiss-error typed event、44px action target 与可访问 role/name/state 均有真实 DOM 证据；IME guard 由 composition 分支与 unit contract 覆盖 |
| UI 静态检查 | 通过 | Impeccable detector 对迁移前置 elements/catalog 返回空结果 |
| repository gates | 通过 | boundaries 377 files；packages/full typecheck 15/15、20/20；packages/docs/full build 15/15、3/3、20/20；`docs:check` 与 `git diff --check` 通过 |

该历史切片已经达到“可以开始迁移现有 Template”的代码门槛；随后完成的 Default Chat 源码迁移记录见下一节。当前 catalog 证据仍不替代 #40.3 的真实 Template iframe、双 Chromium、high-contrast/reduced-motion 或 screen-reader 验收。

### Default Template 首个迁移切片验证

`@vibechat/space-app-components@0.4.1` 将迁移所需公共 API 直接收敛到 `/chat`，source hash 为 `sha256:d29166e027fdddfb7c4dfc9e0140ae54ea85b768fc026ce9c86125e03656faa7`，artifact hash 为 `sha256:a3735a3b262da719ce3717ac8d5607608ebfc25e255ee46c0a001b4ff0abbcc4`；`browser.js`/`chat.js` gzip 分别为 21,480/17,806 bytes，继续低于 35 KiB 预算。`space-default@0.1.3` 的 source/artifact hash 为 `sha256:5e516cc77b01f42c3217b6a605d69e42f404c87ff6c88cdb9b3708a0fb82cec2`，manifest hash 为 `sha256:e4647b727e0a43fe94b578d86d64c6cbcf96d24df22aec10159f155036d1a358`。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| Template 固化与边界 | 通过 | `chat.js` 作为 Project 内固定 vendor module 由 Blob ES module 加载；无 npm/CDN、全局 SDK、第二个 SDK 或新增 Host URL |
| Default adapter | 通过 | 同一个注入 SDK 创建 context/controller；snapshot 驱动共享 elements，不合并 `snapshot.agent.messages`，Agent 只走结构化 Mention event；`pagehide` 释放 controller、context、timer 和 listener |
| 重复实现移除 | 通过 | 删除 Template 自有 message state machine、Composer、Mention、message projection、renderer 与 HTML helper；保留全屏布局、主题和事件适配 |
| 聚焦 unit | 通过 | `tests/unit/space-templates` 与 `tests/unit/space-app-components` 共 6 files、33 tests |
| mock SDK 浏览器预览 | 通过 | 1280px、390px 与 200% 等效 640px 无文档/timeline 横向溢出；Mention 选择生成 `@wayfinder `，发送后 draft 清空并出现消息；组件版本为 `0.4.1`；Composer、actions、reactions 均为至少 44px；console 无 warning/error |
| UI 静态检查 | 通过 | Impeccable detector 唯一提示为 Composer context 的 3px side border，移除后未重复运行 detector |
| repository gates | 通过 | bundle budget、377 files 边界、docs、packages 15/15 typecheck/build、全仓 20/20 typecheck/build 与 `git diff --check`；构建仅保留既有 proxy、chunk、第三方 `use client` 和 Shiki WASM fallback 警告 |

上述浏览器证据使用 mock 注入 SDK 与单一 Chromium 预览，不是运行中的真实 Template Revision。真实 Synapse/Matrix 双浏览器、AgentOS Dev/Release、冷启动恢复、ready Revision、Published Release、受管 Registry provider、抽屉式 Template 以及完整 screen-reader/high-contrast/reduced-motion 验收仍未执行。

### 2026-08-27 managed package 与 Runtime 固化验证

`@vibechat/space-app-components@0.5.0` 的可发布 package 保留未合并 ESM module boundary，source/browser artifact hash 为 `sha256:5152dfc65729876657a2fa3eece6665081091562feb25653395b79d177e16be5` / `sha256:5470312b1b770ef19e7dcd3c6655219b23a17711f4b2fffdce211a9a1213954d`，tracked managed package integrity 为 `sha256:9754fd6cb4b084c3c23c7f945a4e8784192ed04aa2b1b3fb8517bc8b4e780049`。`space-default@0.1.3` 最终重签后的 source/artifact hash 为 `sha256:a3c634456525b7aab93ff3ade653e49832adb10eb05ba99c7dcde3a5a9211526`，manifest hash 为 `sha256:7a614d15d2d7c7ab07e93cad8b5a034ebfad78e91f8d5341dace417f9f1c2bca`。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| source contract | 通过 | Default Template 使用 exact dependency + lock + package import；`src/vendor/space-app-components-chat.ts` 已删除，源码中没有 generated vendor/resolved manifest |
| Registry/release | 通过（本地契约） | Git 只跟踪当前 `managed-release.json`；`dist/package`、tarball 和逐版本编译目录均不提交。可发布 package 可重复构建，name/version/files 与 release integrity 任一漂移都会拒绝同版本 build |
| package surface/tarball | 通过 | `/foundation|user|agent|chat`、`/chat/inline` 和 `/register/*` 语义出口通过；仅 registrar 声明 side effect。`release:pack` 生成 `dist/releases/vibechat-space-app-components-0.5.0.tgz`，66 个文件不包含 `src`、`node`、`testing`、`managed-release.json`、`artifacts` 或逐版本目录 |
| Candidate | 通过（unit） | managed import 被重写到 `.space-dev` 的 verified package 文件；旧无 lock Project byte-for-byte 保持原算法；缺 lock、版本不符、Registry unavailable、内容漂移和生成路径冲突 fail closed |
| cold start | 通过（unit） | 已持久化 prepared artifact 可在 Registry 不可用时用相同 artifact/revision hash 重建本地 Preview |
| Project storage | 通过（unit） | source 与 prepared artifact 写入不同 Object Store key；pointer 分别保存 sourceHash 与 artifactHash，加载时重新校验 prepared files、manifest、package integrity 和 import map |
| ready isolation | 通过（unit） | 新依赖 Candidate 解析失败后最后 ready Revision 仍可按精确 version 访问 |
| 定向验证 | 通过 | 组件/依赖/Template/固化链路 10 test files、49 tests；Node 24 下完整 `tests/unit/space-runtime` 14 files、38 tests；dependency/components/templates/runtime typecheck 与 component managed build 通过 |
| repository gates | 通过 | 全仓 typecheck/build 21/21、docs-app production build、379 files boundaries 和 `docs:check` 通过；最终再次通过 49/49 定向测试、四个受影响 workspace 的 TypeScript 和 managed bundle/package immutability 检查 |
| 本地真实 Dev/冷启动 | 通过 | Alice 通过 Web/真实 Synapse 创建 `space-default@0.1.3`；Rivet/AgentOS Dev VM 以 prepared artifact `sha256:2548105d1ea72db86dbe3c9eec6960698de3e05e18ca51552771b29a5d4aca40` 生成 ready Revision `2548105d1ea72db8`，完整停止并重启 `pnpm dev` 后恢复同一 revision |
| 真实 Template iframe | 通过（单 Chromium 空状态） | 响应实际携带组件版本 `0.5.0`；`vc-space-chat-composer` 已注册并拥有 open Shadow DOM，Timeline、附件、原生 textarea 与发送按钮可见，空文本发送禁用，重载后无新 console error；本轮未发送消息 |

本轮真实走查同时发现并修复两个运行时集成缺口：Dev 编译器不再把 managed package 的 `.d.ts` 声明文件交给 TypeScript emitter；Space App CSP 为既有 `/chat/inline` ESM adapter 允许 `blob:` script，同时继续保持 opaque iframe、`connect-src 'none'` 和无 `allow-same-origin`。以上证据仍不等于生产 Object Store publish、不可变 Published Release、跨 Runtime/主机恢复、双 Chromium Matrix 消息交互或完整 a11y 矩阵，对应复合场景继续保持 Active。

### 2026-08-27 Default 公开交互契约审计补丁

`@vibechat/space-app-components@0.6.0` source/browser artifact hash 为 `sha256:23e09f9e83642f353849a832033dfac33faca5834fa3737bb4d072438df28565` / `sha256:7b9dcf2cc12de5fda6aa2f0eacc96f4bdbc73fc5faf12c641b0087c48c0a5b50`，本地 managed package integrity 为 `sha256:4187cc990c2ed9aea01fdd596535593e22460d77e28ca7b2d143ae7184be9b25`。`space-default@0.1.4` source/artifact hash 为 `sha256:446fa544386fe4f1b95b8a6f6e99b1e3dc402f1544ea2b85eb2b9603610b09ce`，manifest hash 为 `sha256:b4384f73bac9a1bf48a57b1fd4146556f4f2596109c2615083eedc230916c691`。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| 公开 API/权限 | 通过（代码/unit） | SDK 空 snapshot permissions 全部 fail closed；Host 当前真实 Chat surface 显式启用 9 项能力；view model 覆盖 own/member/Agent/failed/deleted action availability |
| Timeline 组合 | 通过（代码/机械） | Actions/Reaction 由 Timeline 内部组合；Default 无 `shadowRoot`、`data-message-id` 或运行时 style 注入，主题只使用公开 `::part`；交互 Reaction 不与只读 Reaction 重复 |
| read receipt | 通过（unit/代码） | controller 并发 `markRead()` 去重且不设置 command pending；Default 只在打开且 document visible 时按最新 message ID 触发，并清理 `visibilitychange` listener |
| package/bundle | 通过 | browser/chat gzip 为 22,313 / 18,707 bytes；语义 exports、side-effect 边界、无远程 runtime import 与 managed integrity 校验通过 |
| 定向 unit | 通过 | components/dependencies/templates 共 5 files、30 tests；Default、SDK 与 component 定向 TypeScript 通过 |
| 真实 Runtime/浏览器 | 未执行 | `0.6.0` 未上传生产 Registry/Object Store，`0.1.4` 未生成 ready Revision/不可变 Release，也未执行真实 Matrix 双浏览器/a11y E2E |

### 2026-08-27 Default 操作密度修复最终验证

`@vibechat/space-app-components@0.7.0` source/browser artifact hash 为 `sha256:c22df8454e0866229dd596c5b0938d3a255398a0ac37f60dc6cc0bc36745d7d7` / `sha256:60e66b2f9e2db6d595fa9c7bd66cd749624db7aa51ed3c43c3e65d76edc44c83`，本地 managed package integrity 为 `sha256:7640548144e75ce7305d893c26e43f2ae14d1c6adefdd099cd58af80d54e3103`。`space-default@0.1.5` source/artifact hash 为 `sha256:5e26e8fc2d6cf530bfff971b94029ba32d366cb90c8daf42d8115cc5ccce4449`，manifest hash 为 `sha256:8e3363f923328a46b9b668488d4a3753c6a8e214bd332b5a4646162a4f725dfa`；既有 `0.1.4` lock 未改写。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| package/bundle | 通过 | browser/chat gzip 为 25,431 / 21,804 bytes；managed integrity、semantic exports、side-effect 边界、无远程 runtime import 和 Catalog lock 一致性通过 |
| 定向 unit/TypeScript | 通过 | components/dependencies/templates 共 7 files、43 tests；组件与 Default Template TypeScript、Catalog `--check` 和 `git diff --check` 通过 |
| Timeline 稳定性 | 通过 | equivalent actions/reaction choices/locale 不重建 More；列表只在真实顺序变化时移动节点，5.2 秒 snapshot 刷新后菜单仍打开；Delete 确认在关闭/重开后复位，Escape 恢复 trigger 焦点 |
| 响应式与视觉 | 通过 | 桌面 fixed menu 根据 trigger 与上下可用空间定位且完整落在 iframe viewport；390×844 action sheet 两侧各 12px、backdrop 可见、外部点击关闭；Impeccable 最终 detector 返回空结果 |
| 真实 Matrix E2E | 通过 | `chat-matrix-room.spec.ts` 整文件 3/3：原有创建/发送/回复/Reaction/刷新/恢复长链继续通过，新增独立 Default 用例发送真实 Matrix 消息并覆盖 4.5 秒刷新、确认/焦点和 390px action sheet |
| 当前本地验收 Space | 通过 | `space-default@0.1.5` 在真实本地 Runtime 生成 ready Revision `04b4b51`；桌面 More 保持打开且边界为 top 187 / right 826 / bottom 461（iframe 891×882），验收 tab 保持打开 |

本轮仍未把 `0.7.0` 上传生产 managed Registry/Object Store，也未生成不可变 Published Release、执行跨 Runtime/主机恢复、双 Chromium 同房消息交互或完整 screen-reader/high-contrast/200% 字体矩阵，因此 C1/C3/C5 继续保持 Active。

### 2026-08-27 Popover top-layer 与 Campfire 迁移最终验证

`@vibechat/space-app-components@0.7.4` source/browser artifact hash 为 `sha256:38aa4979ee10c2e54004e6c50824b1fd97b2e71b22f3fbe3cdc8705c84669578` / `sha256:7c53377c043aaad983c14b63eec9ed28246dcaf888953a27147afccb317d3d4f`，本地 managed package integrity 为 `sha256:4a7d7296653b0164005283b5d836788300504e1d7590f803bbd2ba52fd15e201`。Default `0.1.6`、Campfire `0.1.5`、Focus `0.1.6` 的 source/manifest hash 分别为 `sha256:c6c6db8ead9aff2a1b1003132cedb19d349f07add2bed0d5e66076179c228575` / `sha256:0345a489c8e3077630be2075c5e75eab03b747ad408ebaba898307c6fe2f20fb`、`sha256:eb94f43a24bbe331406dd4bbc4bb8af38938e3a3e440f5d8805be75bf0b357ba` / `sha256:62174e22dd89707c45e26c81cab2897cc512af7077e94acee884cb0965a5bcd4`、`sha256:a0e9de7a34fe116305b4a6055a30c426f3febbeea760da57ca8851222cc19db9` / `sha256:0f57b6fa82054445597c08ff0d21a38d2bcf46b573752d9b02abcb0a706edabf`。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| package/bundle | 通过 | Node 24 下 browser/chat gzip 为 25,647 / 22,033 bytes；semantic exports、side-effect 边界、无远程 runtime import、managed integrity 与 Catalog lock 一致 |
| 定向 unit/TypeScript | 通过 | components/templates 共 3 files、21 tests；组件、Default、Campfire、Focus TypeScript 与 Catalog `--check` 通过 |
| top-layer/降级契约 | 通过 | 支持 Popover 时只安装 native light-dismiss/toggle/`::backdrop`；fallback 才安装 document pointer listener；桌面 menu 在 viewport 内，390px action sheet 两侧各 12px，外部点击与 Escape 均关闭并恢复 trigger 焦点 |
| Template CSS 独立性 | 通过 | Campfire/Focus 恢复抽屉 `translateX(0)` 与自身 `blur(26px)`；Campfire 在 active transform/backdrop-filter 下打开 More、回复和 Reaction，未再出现 renderer crash |
| 真实 Matrix E2E | 通过 | `chat-matrix-room.spec.ts` 整文件 4/4，覆盖未认证拒绝、Campfire 创建/发送/回复/Reaction/刷新/恢复、Default 菜单稳定性与移动 action sheet、Focus 便签/unread/消息/刷新/390px 布局 |
| UI 静态检查 | 通过 | Impeccable detector 对共享 MessageActions、Campfire Chat UI 和 Focus foundation 返回空结果 |

本轮仍未把 `0.7.4` 上传生产 managed Registry/Object Store，也未生成不可变 Published Release、执行跨 Runtime/主机恢复、双 Chromium 同房消息交互或完整 screen-reader/high-contrast/200% 字体矩阵，因此 C1/C3/C5 继续保持 Active。

### 2026-08-27 Arcade 共享 Chat 迁移验证

Arcade `0.1.3` 的 source/artifact hash 为 `sha256:6cfd57f84f9972b3f1081817c70dba189ef1e96cdd3fcd899a1ecc5ebb12dd6e`，manifest hash 为 `sha256:46366ddea6e8e441bd9d25fb5e9252ccfbee9f3b632dbbe7b26e96a96d03cc69`；既有 `0.1.2` lock 保持 `sha256:ce92262abad8cea95133bd21e6daf5d20b8ac23d3db306b7833131059f20e627` / `sha256:04e9d65ed6151280c7c941c8118620f524fdc7b0cca83cf8dadb35d3f9655ef4`，未被原地重签。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| 依赖与重复实现 | 通过 | exact `@vibechat/space-app-components@0.7.4` + managed integrity；删除 Arcade 自有 composer/dom/messages/render，保留 Template App controller、markup/theme 与语义化 `/chat/inline` import |
| 场景与布局 | 通过 | 像素徽章计数、共享 signal、presence、主题和 `dock` launcher 保持；抽屉继续使用 active transform 与 `blur(26px)`，390px 打开后占满可用 iframe 视口 |
| 定向 unit/TypeScript | 通过 | Catalog 1 file、9 tests；Space Templates package 与 Arcade App TypeScript 通过，`0.1.3` source/manifest/artifact lock 与 managed dependency contract 一致 |
| 真实 Matrix E2E | 通过 | `chat-matrix-room.spec.ts` 整文件 5/5；Arcade 独立场景覆盖徽章写入/刷新恢复、组件版本标记、发送、回复、Reaction、抽屉 unread、Matrix 历史恢复与 390px 布局 |
| UI 静态检查 | 通过 | Impeccable detector 对 Arcade 共享 Chat adapter、markup 和四个样式分区返回空结果 |

本轮没有生成不可变 Published Release，也未执行生产 managed publish、双 Chromium 同房交互、Existing custom Project 端到端不升级或完整 screen-reader/high-contrast/200% 字体矩阵，因此 C1/C3/C5 仍保持 Active；Postcard 已在下一节完成最后一个官方 Template 源码迁移切片。

### 2026-08-27 Postcard 共享 Chat 迁移验证

Postcard `0.1.3` 的 source/artifact hash 为 `sha256:92d5f04f6f2c351fba6e0e61cd5a69bfbdf6ed1ca5f3922211ddc5f2c3c28360`，manifest hash 为 `sha256:0ecadc2d72e2464d57995e731e96ae18de940bbf186a5b0f19c7a2dd5954fad4`；既有 `0.1.2` lock 保持 `sha256:16ed93f878e3acc0b455ee78495c74edf423605d7276b2684b6e56b1d01b7e97` / `sha256:448fc8da2a9802ef6cdc617f3d1b05d74df525a55b3517c7442a7457aea73c47`，未被原地重签。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| 依赖与重复实现 | 通过 | exact `@vibechat/space-app-components@0.7.4` + managed integrity；删除 Postcard 自有 composer/dom/messages/render，保留 Template App controller、markup/theme 与语义化 `/chat/inline` import |
| 场景与布局 | 通过 | `postcard.messages`、最多十张卡片、寄出表单、presence、暖纸张主题和 `dock` launcher 保持；抽屉继续使用 active transform 与 `blur(26px)`，390px 打开后占满可用 iframe 视口 |
| 定向 unit/TypeScript | 通过 | Catalog 1 file、9 tests；Space Templates package 与 Postcard App TypeScript 通过，`0.1.3` source/manifest/artifact lock 与 managed dependency contract 一致 |
| 真实 Matrix E2E | 通过 | `chat-matrix-room.spec.ts` 整文件 6/6；Postcard 独立场景覆盖卡片写入/刷新恢复、组件版本标记、发送、回复、Reaction、抽屉 unread、Matrix 历史恢复与 390px 布局 |
| UI 静态检查 | 通过 | Impeccable detector 对 Postcard 共享 Chat adapter、markup 和四个样式分区返回空结果 |

本轮没有生成不可变 Published Release，也未执行生产 managed publish、双 Chromium 同房交互、Existing custom Project 端到端不升级或完整 screen-reader/high-contrast/200% 字体矩阵，因此 C1/C3/C5 仍保持 Active。五个官方 Template 的共享 Chat 源码迁移已完成，下一步进入 recipe 与剩余生产化/可访问性验证。

### 2026-08-28 Chat Recipe 与多版本 Registry 验证

`@vibechat/space-app-components@0.8.1` source/browser artifact hash 为 `sha256:9383001b8b7262f9258a8965313654fe99796912fdaea281050079cc07133d73` / `sha256:4d776ed99e9062571daf71bdb432314b1ff952dd872f8f661530afc6e453a905`，本地 managed package integrity 为 `sha256:6d980005ca07a1a9ac76dad9c18524bb3e1885261616252f949d9787af996dc2`。Default `0.1.7` source/manifest hash 为 `sha256:2773c71af78fadc791978669d30d8ed5ed2aaa3b2e10448efff3a5f3b0b66651` / `sha256:466f81bb1feabdc3b8d31358cc73905846f5e53760e4f86b8dc41720ed16cc47`；Focus `0.1.7` 为 `sha256:93daabc0d3e9c199d27912b0f11ac19f46e93c291df79e028db5f7a87cb31c3e` / `sha256:ebbdf498767ab5b83f707cd510348caa69a6e68067e86a00ec11482f95719ee3`。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| Recipe API/lifecycle | 通过 | `/recipes`、`/recipes/inline`、full/dock mount 与标准 element resolver；unit 覆盖事件只装配一次、unread、不可见时不 mark read、恢复可见后补发、dispose 幂等及 listener 全释放 |
| inline 注册 | 通过 | `/recipes` 保持 side-effect-free；`/recipes/inline` 使用专用 browser entry 注册 Timeline/Composer/Mention/Error，bundle gate 明确检查四个 element name，防止再次出现“只有壳没有输入框” |
| bundle/package | 通过 | recipes gzip `23,059` bytes，低于 Chat `35 KiB` 预算；semantic exports、SSR-safe 普通入口、无远程 runtime import、managed integrity 与 Catalog locks 一致 |
| 多版本 Registry | 通过 | gitignored `dist/managed-registry/<version>/package` 同时按 exact version 提供 `0.7.4` 与 `0.8.1`；历史缓存从已有 prepared Project 按 dependency lock/integrity 恢复，错误 integrity fail closed；Git 未新增版本化编译目录 |
| 定向 unit/TypeScript | 通过 | components/dependencies/templates 共 7 files、45/45；组件、Default/Focus App TypeScript 与 Catalog lock 通过 |
| 真实 Matrix E2E | 通过 | `chat-matrix-room.spec.ts` 整文件 6/6；Default/Focus 断言 `0.8.1` full/dock Recipe，Campfire/Arcade/Postcard 继续断言 `0.7.4`，覆盖创建、发送、回复、Reaction、刷新、恢复、unread、Popover/action sheet、场景状态和 390px 布局 |

本轮本地 Registry cache 只模拟 managed Registry 的 exact-version 语义，不是生产发布渠道。该差距已由下一节的隔离 Cloudflare D1/R2 preview 补上，但尚未完成真实部署 publish、本轮不可变 Published Release、双 Chromium 同房交互或完整 screen-reader/high-contrast/200% 字体矩阵，因此 C1/C3/C5 继续保持 Active。

### 2026-08-28 managed Registry/Object Store 接线验证

主发布对象确定为 `vibechat.space-app-managed-package-object/v1` 规范化 JSON envelope；npm tarball 只保留为可选 mirror。PG 与 SQLite/D1 新增同一不可变 `space_app_managed_package_release` 模型，Backend 的 PUT publish 使用独立 `space-app-package-registry` audience，POST resolve 继续使用 Runtime callback credential。发布前先按 canonical content hash 查询既有记录，内容漂移在 Object Store 写入前拒绝；数据库唯一约束继续处理并发竞态。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| envelope/repository/service | 通过 | exact name/version、integrity、Project formats、object key/hash 全绑定；同内容幂等、内容漂移冲突、对象缺失/篡改和错误 lock 全部 fail closed |
| 权限与 Runtime provider | 通过 | 发布 token/audience 与 Runtime callback credential 隔离；生产 provider 不使用 workspace/`dist` fallback，开发只在远程 404 后使用多版本 cache |
| migration/build | 通过 | PG/SQLite migration 已生成；隔离 D1 从 0000 应用到 0014；Backend Node/Cloudflare build、Runtime/Backend/components typecheck 通过 |
| 隔离 Cloudflare D1/R2 | 通过 | `0.7.4` → object `5ac435ac…`，`0.8.1` → `03c2a80b…`，`0.8.2` → `18fc0fdf…`；重复发布返回 Verified，漂移返回 409 |
| Runtime exact resolve | 通过 | 远程 provider 从 workerd 按 exact lock 解析 `0.7.4` 66 个文件、`0.8.1`/`0.8.2` 各 74 个文件，无本地 package 解析依赖 |

真实部署环境尚未执行 publish；本轮也没有生成不可变 Space Release 或跨 Runtime 恢复证据，因此不把 C1/C3 标记 Complete。

### 2026-08-28 Agent activity 公共层验证

`@vibechat/space-app-components@0.9.0` source/browser artifact/integrity 分别为 `sha256:b522904eaf23c94cda1850d5f49e52a7187dc13ffaf92b7bd699cb81e6e98856`、`sha256:dfa862ed56a5a5c098054ed84928ab30ad8d8ceca4a0b7961d8ab4b1685956c4`、`sha256:e4addfc9684062d79d192bde3c847185248b9930a46e390c357e7a624793a73e`。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| view/controller 安全边界 | 通过（unit） | activity 仅白名单投影 label/title/name/tool/stage 与 summary/detail，限制最多 12 条和单字段长度；`input/output/arguments` 测试载荷不进入序列化 view；等价 Agent 更新不重复通知，dispose 释放 listener |
| elements/recipe contract | 通过（代码/unit） | QueueStatus/Activity 使用文字 + polite live region、typed property、安全 declarative attribute、公开 part；Panel recipe 只连接同一个 context/controller，幂等释放，不拥有 Agent 调度或 Template 状态 |
| package/bundle | 通过 | 组件 TypeScript、34/34 package unit 与 managed integrity gate 通过；browser/foundation/user/agent/chat/recipes gzip 分别为 30,561 / 3,132 / 5,507 / 7,465 / 23,848 / 26,055 bytes，均低于预算；普通 `/agent`、`/recipes` SSR-safe且无远程 import |
| offline catalog browser | 通过（本地单 Chromium） | Night relay/Field notes 两主题各渲染同一 `vc-space-agent-activity`；DOM snapshot 暴露 status、Agent identity、stage、queue 和两条文字 activity；390×844 下 `scrollWidth === clientWidth === 390`、两 panel 宽 321px 且无 console warning/error |
| 真实 Template/完整 a11y | 未执行 | 本轮刻意不升级 Template 或修改 Runtime/Backend；screen reader、200% 字体、强制 high contrast/reduced motion 和真实 iframe Agent build 更新留给下一迁移切片 |

### 2026-08-28 Agent activity 首批 Template 迁移验证

`@vibechat/space-app-components@0.9.1` source/browser artifact/integrity 分别为 `sha256:511ca97c185edf3d4e5c2cb595005d9ecf3bf920a7a8ec63a21f414993e34785`、`sha256:92259060a408554cd5d91c22e6135380074bc957e366a82d2e5b35e75b3a9899`、`sha256:bf9d6ee624ca368380df425e9d284c9345ef255ecc5ac59c9233f58575ee6b68`。Default `0.2.0` source/manifest hash 为 `sha256:7b00be6a67984b0d4739bd406e6d0069daa3c69f851c115bd0898da42aa4b4ac` / `sha256:ab9c3d034e1ebb609d9a776193c6c23435f91122469778b9c96e500926f8be81`；Focus `0.2.0` 为 `sha256:5324d1cc9b760286d4153903f47ef02ac30438a2ccd5d4382419e37ada1f1fda` / `sha256:ae9c065506f0b7b227cea3fa4a99424b470b6ec7c64c8c808f8925a02908c07c`。

用户走查后的 active-only 修正版为 `@vibechat/space-app-components@0.9.3`，source/browser artifact/integrity 分别为 `sha256:a2a3eb0f095ad16ab34d6ca6f7f5d9552d14579c618aa687625da566fd9f2fe2`、`sha256:d8560e50a31d44f338efb4113a38fcf261587ffc2fa6bfba2401fe363f01ed81`、`sha256:9ad13ee6adee669d5a119668d34a67a8d1815451c5bc6999a8b80bf4edbb5081`。Default `0.2.0` 重签后的 source/manifest hash 为 `sha256:b58d32037d74a0c548ce19a73fda90c5503bfd9184c934e40df85c079313da50` / `sha256:298878233ce79fcefbecc39aff272a41ea991d882b373e2c527edfd202318117`；Focus `0.2.0` 为 `sha256:fadc4694a2a186a90a53116b199b39de9bde5200e47cf5deca4647a9cf3aba0d` / `sha256:0e85b4d7d9a97228a64b4370f738603170003d1abd0d01f2141d9afa19081ea4`。该 package 已通过正常鉴权端点发布到本地 managed Registry；既有 `0.9.1`/`0.9.2` 记录和已 prepared Revision 未被覆盖。

| 验证 | 结果 | 证据摘要 |
| --- | --- | --- |
| Chat Recipe 迁移桥接 | 通过 | `build/buildTitle/buildStage` 保留 deprecated 类型；完整旧 DOM 原样解析，三个节点全缺失时使用 detached hidden placeholder，部分缺失继续 fail closed；Chat Recipe unit 11/11 |
| Template 组合 | 通过 | Default full 与 Focus dock 复用同一 SDK/context，分别挂载 Chat Recipe 和 `AgentActivityPanelRecipe(maxActivities=3)`；源码删除 `#vcc-build`、旧 build snapshot/copy/CSS/脉冲动画，只通过 token、公开 part 和 `data-testid=agent-activity` 扩展 |
| 真实 SDK progress bridge | 通过（代码/unit） | Runtime `turn_started/status/activity/queue_updated/completion` 更新同一 injected `space.agent`；Agent identity 使用结构化 target，activity 原位更新、时间正序、尾部最新且最多四条，无 active Turn 时 fail closed；Node 24 Runtime/SDK/Agent/Host 定向 unit 4 files、20/20 |
| 真实 Pi/DeepSeek 双浏览器 ready Revision | 通过 | 用户明确授权后，Default `0.2.0` 两个 Chromium 通过公共 Mention 组件发送结构化 Pi target，同时看到真实 identity、working stage、1 active queue 与 tool activity；完成后两端 Agent idle、同一 ready Revision marker 可见、Release 不变，后续 Chat 与刷新恢复正常；1/1，25.5 秒 |
| package/bundle | 通过 | browser/foundation/user/agent/chat/recipes gzip 为 30,652 / 3,132 / 5,507 / 7,465 / 23,848 / 26,151 bytes；semantic exports、SSR/offline、无远程 import、managed integrity 与 exact Template lock 一致 |
| 定向 unit/TypeScript/Catalog | 通过 | components/templates 3 files、24/24；组件、Default/Focus App TypeScript 与 Catalog `--check` 通过，历史 Template lock 未改写 |
| 隔离 iframe a11y/responsive | 通过 | Chromium 2/2；mock SDK 动态更新 long stage、1 active/2 pending queue 和两条 activity，390×844 + 200% 字体下页面宽度保持 390px、Composer 在视口内；forced-colors/reduced-motion 下子树无动画且 console/page error 为空 |

隔离 E2E 继续承担 responsive/a11y 组合证据；真实 provider 证据由独立的 Matrix/Pi/DeepSeek 双浏览器用例提供。首次运行暴露本地 SQLite 缺失 managed Registry table，执行标准 `db:push:sqlite` 后又发现共享 `6420` Engine 来自另一工作树；未终止其他分支服务，改为当前工作树独立 `6520/6521/6530` Engine。随后真实用例通过公共 Mention 组件选择 Pi 并得到 `/turns` 202，Default ready Revision 1/1（25.5 秒）通过。不可变 Release、生产 managed publish、Focus 真实 Agent 和 screen reader 仍待后续独立验证。

## 待决策清单

1. 已决策：公开 component catalog/交互 playground 进入 `apps/docs-app`，package 离线 catalog 保留为 CI/本地门禁；不新增 Space Runtime 专用 Preview route。
2. 待决策：何时为大型媒体/recipe artifact 增加 revision-local hashed asset route。
3. 已决策：React adapter 在 JSX/browser build 与依赖解析稳定前延后；未来 adapter 必须复用同一 controller、typed event 和 contract tests。

## 进度更新规则

- 只勾选已有代码和实际执行证据；package 构建不代替 AgentOS/浏览器证据。
- 官方 Template source 变化必须按版本规则新增相邻版本，不能覆盖 release lock。
- 每次修改公共 export、attribute、part、token、event 或默认行为，都记录 SemVer 影响与迁移方式。
- 进入阶段 2 前先更新 TEST-CATALOG #40.3 的真实 DOM 场景，再编写 Playwright selector。
