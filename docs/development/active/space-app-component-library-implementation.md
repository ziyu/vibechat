# Space App 基础组件库 Active 实施跟踪

> 生命周期：开发中
> 文档类型：计划
> 状态：Active
> 更新日期：2026-08-27
> 维护范围：`@vibechat/space-app-components`、组件 bundle/manifest、Space Project materialization、官方 Template 迁移和验收
> 稳定来源：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)
> 组件设计：[Space App 基础组件库设计](../space-app-component-library-design.md)

## 当前结论

阶段 0 工程基线、阶段 1 identity 和阶段 2 Chat 公共边界已经建立：package 现提供注入式 context、完整 Chat controller、SSR-safe Custom Element、semantic token、Foundation、User/Agent identity、Matrix message view、Composer、Mention、Attachment、Reaction/MessageActions、可恢复错误和 Timeline 容器。

2026-08-27 已把首个官方迁移切片从相对 vendor 路径升级为长期依赖契约：`space-default@0.1.3` 使用语义化 `@vibechat/space-app-components/chat/inline` import、精确 `0.5.0` dependency 和 `space-app-dependencies.json` integrity；普通浏览器构建使用 `/chat`，只有当前自包含 HTML delivery 使用 `/chat/inline`。`@vibechat/space-app-dependencies` 通过注入 Registry 生成 prepared artifact，Runtime 的 Dev、发布、手工部署和冷启动共用该产物，并通过已有 `artifactObjectKey/artifactHash` 与 source object 分开持久化。源码不包含生成 vendor 目录，浏览器不访问 npm/CDN，公共 API 也不暴露 Registry artifact/object-key 路径。

随后审计补丁签锁 `@vibechat/space-app-components@0.6.0` 与相邻 development Template `space-default@0.1.4`：Host 在 SDK snapshot 显式下发 Chat permissions，message view 结合 ownership/status 生成 action availability，Timeline 通过公开 property/event/`::part` 正式组合 Actions/Reaction，并以 `chat-message-entry` 提供稳定测试入口。Default adapter 删除 Shadow DOM 查询和运行时 style 注入，使用组件公开 type-only imports；可见且打开时按最新 Matrix message ID 去重发送非阻塞 read receipt，并补齐 dock unread 累积与可访问名称本地化。`0.6.0` 当前完成本地可发布 package 与仓库 release lock，未上传生产 managed Registry/Object Store，也未生成不可变 Space Release。

本轮进一步新增 `@vibechat/space-app-components@0.7.0` 与相邻 development Template `space-default@0.1.5`，不覆盖 `0.1.4` lock。交互 Timeline 现在只呈现一套 canonical Reaction，候选 Reaction 与 reply/edit/delete/retry 进入 compact MessageActions；桌面使用浮层，窄屏使用带 backdrop 的 action sheet，覆盖焦点循环/恢复、Escape、外部点击、危险删除二次确认和英中内建文案。相邻同作者消息按五分钟窗口分组，重复 author/time/delivery 与 avatar chrome 被压缩；controls 使用 `fit-content` 跟随消息方向和气泡。独立 MessageActions 仍保持 inline 默认，因此这是新增 compact 能力与交互 Timeline 默认优化，不要求旧消费方迁移。`0.7.0` 当前仍只有本地 release lock/构建证据，未上传生产 managed Registry/Object Store。

本轮没有改写任何既有 Published Release。托管依赖解析、Registry 缺失/漂移 fail closed、旧 Space 后加依赖、prepared 缓存冷启动和 source/artifact 分离已有 unit 证据；`space-default@0.1.3` 也已在真实本地 Rivet/AgentOS Dev VM 中生成 ready Revision，并在完整开发栈冷启动后从同一 prepared artifact 恢复。单 Chromium iframe 已确认 `0.5.0` Composer/Timeline 可见且无新 console error，但没有发送消息。生产 Object Store publish、不可变 Release、真实 Matrix 双浏览器、完整交互/a11y 矩阵和抽屉式 Template 迁移仍未执行，因此 C1/C3/C5 与“可供所有生产 Space 使用”都不能标记 Complete。

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
| C1 | Bundle 与版本 | §12、§15 阶段 0 | Active | `0.7.0` tracked managed release lock、exact version/integrity、注入式 Registry、不可变 build 校验 | 生产 managed Registry/Object Store publish 证据 |
| C2 | Context 与 renderer | §7、§9 | Active | SDK 注入、snapshot controller、SSR-safe `vc-space-avatar` | component lifecycle/DOM/a11y 扩展 |
| C3 | Project/Runtime 固化 | §12、§15 阶段 0 | Active | source/prepared 双 artifact、49 个定向 unit、本地真实 AgentOS Dev 与完整栈冷启动同 hash | 不可变 Release/生产 Object Store 同 hash |
| C4 | User/Agent identity | §8、§15 阶段 1 | Active | `0.2.0` Foundation/User/Agent exports、两主题离线 catalog、unit/SSR/浏览器证据 | 真实 Template artifact 中完成 #40.3 a11y/E2E 场景 |
| C5 | Chat 与 Template 迁移 | §8、§15 阶段 2–4 | Active | `0.7.0` + `space-default@0.1.5` 渐进式操作、单一 Reaction、消息分组与响应式 action sheet；旧 vendor 与 Shadow DOM adapter 已删除 | 对 `0.7.0` 做真实 Matrix 双浏览器交互后迁移抽屉式 Template |

## 当前 Active 切片

### 目标

在不读取全局 SDK、不过度固定视觉布局的前提下，让首个官方 Default Chat 固定并组合完整、provider-neutral 的 Chat controller/elements。Template 只保留 SDK 注入、全屏布局、主题和事件适配；Matrix timeline 仍是唯一消息源，Agent 只通过结构化 Mention Chat event 触发，不把 Agent build/progress 伪装成消息。

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
- [x] 在 Candidate 隔离树中校验并 materialize exact version/integrity，只改写 prepared `package.json`；source 和 Agent workspace 禁止生成 vendor/resolved manifest。
- [x] 将 prepared artifact 接入 Dev Preview、Publish、手工部署和冷启动，并通过 `artifactObjectKey/artifactHash` 与 source object 分开持久化；旧无 lock Space 保持原 Revision ID 算法。
- [x] 建立 Registry unavailable、version/hash drift、generated path collision、旧 Space 后加依赖、prepared tamper、冷启动不访问 Registry和最后 ready Revision 保留的 unit 证据。
- [ ] 建立 long name、图片失败、keyboard、screen reader、200% 字体、high contrast 与 reduced motion 的 unit/DOM/浏览器证据。
- [x] 在真实本地 Rivet/AgentOS Dev 与完整开发栈冷启动恢复中验证相同 component artifact/revision hash。
- [ ] 在不可变 Release、生产 Object Store 和跨 Runtime 恢复中验证相同 component artifact hash。
- [ ] 在真实 Matrix 双浏览器、ready Revision/不可变 Release 中验证 Default Chat，并迁移至少一个抽屉式官方 Template。

### 完成条件

- `0.1.0` 已公开的 Avatar、Context、manifest 与 materialization API 继续兼容；新增 API 记录为 minor change。
- identity 组件只接受 typed property/安全 attribute，不读取全局 `space`，不使用颜色作为状态唯一信号。
- 两套主题只覆盖 `--vc-space-*` token 和布局，不复制 Avatar/User/Agent identity 逻辑。
- keyboard、screen reader、200% 字体、长文案和图片失败状态通过；high contrast/reduced motion 契约进入样式与机械检查。
- bundle 保持离线、自包含；Foundation/core 领域入口低于 20 KiB gzip，Chat 入口低于 35 KiB gzip，聚合入口按 Chat 预算治理；package、边界、unit、typecheck、build、文档与浏览器检查通过。
- 受管 Registry 与 Runtime 接线已有代码/unit；本地真实 Dev/完整栈冷启动已通过，但不可变 Release、生产 Object Store 和跨 Runtime 恢复未验证前 C1/C3 保持 Active。
- `0.7.0` 与 `space-default@0.1.5` 已完成最终 package/bundle、43 个定向 unit、真实 Matrix 单 Chromium E2E 和本地 ready Revision 验证，证据见本节后续记录。生产 managed publish、真实 Matrix 双浏览器消息交互、不可变 Release 与抽屉式 Template 继续保持未完成。

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

## 待决策清单

1. catalog 在阶段 1 继续作为离线构建产物，还是增加只读 Preview route。
2. 何时为大型媒体/recipe artifact 增加 revision-local hashed asset route。
3. 首个抽屉式迁移选择 Campfire，还是选择结构差异更大的另一 Template。

## 进度更新规则

- 只勾选已有代码和实际执行证据；package 构建不代替 AgentOS/浏览器证据。
- 官方 Template source 变化必须按版本规则新增相邻版本，不能覆盖 release lock。
- 每次修改公共 export、attribute、part、token、event 或默认行为，都记录 SemVer 影响与迁移方式。
- 进入阶段 2 前先更新 TEST-CATALOG #40.3 的真实 DOM 场景，再编写 Playwright selector。
