# VibeChat MVP 产品与技术设计

> 生命周期：长期稳定
> 文档类型：设计
> 状态：生效
> 更新日期：2026-08-27
> 维护范围：VibeChat Web/PWA、Space Kernel、Chat、Space App Runtime、Agent 协作生成、Space 市场、Matrix 消息底座与发布系统
> 事实边界：本文定义目标状态；当前实现、迁移差距与完成证据见 [Active 实施跟踪](../../development/active/product-and-technical-implementation.md)
> 设计演进：[Space App 设计演进与实施记录](../../development/active/space-app-design-transition.md)
> 宿主设计系统实施：[VibeChat 宿主设计系统与主题工作流实施方案](../../development/active/host-design-system-and-theme-workflow.md)

## 1. 执行摘要

VibeChat 是一个以聊天为基础、可由 Agent 持续定制并实时更新的多人 **Space** 产品。Space 不是 Workspace、编辑器或试验场，也不是“先开发、后使用”的容器；它从创建完成起就是成员正在共同使用的在线空间。App 的更新发生在这个可用空间中：只有通过校验的 Revision 才能替换当前运行版本，构建中的 Candidate 和失败结果不会打断成员正在使用的 Space。

每个 Space 首先拥有完整且不可被 App 代码修改的 Chat Core：成员、邀请、消息、Mention、媒体、回复、编辑、删除、回应、已读、正在输入、历史同步、`@agent` 调度和权限由平台实现并保持可用。在 Chat Core 之上，每个 Space 拥有一份独立的 App Project。Kernel 顶条以下的整个界面都由 App 代码渲染；默认 Project 提供完整 Chat UI，成员可以通过模板或 Agent 任意改变聊天能力的呈现、布局和调用方式，但不能改写 Chat Core 的数据、权限、投递或 Agent 调度语义。

Space 可以通过两种方式开始：

1. 创建空白 Space，立即运行平台提供的默认 Chat App，之后再从市场选择模板或与 Agent 对话改变整个 Space 界面。
2. 从 Space 市场选择一个模板创建 Space，模板作为初始 App Project 的来源。

市场中的模板不是正在运行的聊天实例。模板被应用时会复制为该 Space 独有的 Project/Revision；之后的成员、消息、状态和定制都只属于当前 Space，不会反向修改市场模板。

Space 只有三个逻辑与信任边界；它们不等于三个固定视觉面板：

- **Kernel Bar**：唯一固定的宿主界面，位于 Space 顶部，负责 Space 身份、成员、权限、Agent 状态、实时版本、发布、恢复和治理。模板与 Agent 不能修改、遮挡或伪造它。
- **Chat Core**：平台可信的消息与调度能力层，不是固定 UI。它维护人与人聊天、Mention、`@agent`、关系事件、历史和权限；只能通过版本化 Space SDK 调用。
- **Space App**：Kernel Bar 以下的完整可编程界面，包括默认 Chat UI。它可以重新组织或完全改写聊天的呈现和交互，也可以成为游戏、工具、场景、仪式或其他实时多人体验。

源码、生成进度、版本历史、发布和恢复入口属于 Kernel Bar 展开的可信控制面板，不构成第四个 Studio/Workspace 边界。`Dev` 只表示 Runtime 的持续更新通道，不是用户进入的试验环境；Space 默认使用最后一个 ready Revision，并在新 Revision ready 后实时切换。用户可以将当前 Revision 发布为不可变版本。

Agent 不是固定为 Pi。Pi 只是在 demo 中验证了对话分类、项目修改、隔离预览和发布链路的一种实现选择。正式架构使用 provider-neutral 的 Agent Adapter；同一 Space 可以配置默认 Agent，后续可以接入不同模型、编码 Agent、领域 Agent 或多 Agent 协作。

Space Runtime 的技术路线明确采用 `chat-app-server` 已验证的同构方案，而不是只借鉴产品语义：Node 22 + TypeScript + Hono 服务、每个 Space 一个逻辑实例服务器、SSE 实时下行与受控命令上行、同实例串行 Turn 队列、Project Store、Dev Preview Manager、agentOS Apps 隔离开发/不可变发布，以及 iframe Space SDK bridge。正式实现只把 demo 的 Guest 身份、本地 JSON 和单机内存调度替换成 Better Auth + Matrix、Product DB/Object Store 和可恢复 lease；核心对象边界与执行顺序保持一致。

本设计保留已经完成的 Better Auth、产品资料、联系人、邀请、Matrix identity、Matrix room/timeline、Space 市场基础、收藏和跨宿主 package 基线，只在其上增加 Space App、Agent、Draft 和 Release 能力。

### 1.1 本次设计校正

以下结论是硬约束：

- 产品语义统一使用 **Space**；`Matrix room` 只表示底层协议对象，不作为用户可见产品名称。
- Space 市场、分类、详情、收藏、版本和模板选择继续存在，不因生成式 App 而退场。
- 空白 Space 与模板 Space 都必须拥有完整 Chat Core；默认 Chat App 必须可用，App 或 Agent 构建失败时仍保留最后一个 ready App 和 Chat 能力。
- 现有认证、资料、联系人、邀请、消息和 Space 目录能力必须保持兼容和回归全绿。
- Kernel Bar、Chat Core、Space App 是仅有的三个逻辑边界；只有 Kernel Bar 是固定宿主 UI，不再定义 Studio/Workspace Surface。
- Agent 是可插拔能力，Pi 仅是示例 provider，不进入公共产品契约或数据库核心命名。
- 创建 Space 时可以选择模板，也可以跳过模板创建空白 Space。
- 使用 Default Chat App 的 Space 可以直接应用模板；已有定制时必须先生成并验证 Candidate，不能静默覆盖当前 ready Revision 或 Published Release。

### 1.2 核心原则

1. **Chat Core 是产品基础；Chat UI 是默认 App 代码。**
2. **产品叫 Space；Matrix room 只是 Space 的消息与成员底座。**
3. **Kernel Bar、Chat Core、Space App 三个逻辑边界固定；只有 Kernel Bar 是固定宿主界面。**
4. **市场模板可复用，Space 实例的成员、消息、项目和状态独立。**
5. **普通人类对话不自动修改 App；面向 Agent 的定制请求才进入生成队列。**
6. **Agent provider 可替换；编排、权限、计费、项目和发布契约归平台所有。**
7. **Space 始终使用最后一个 ready Revision；新 ready Revision 实时更新当前 Space，显式发布用于固化不可变 Release。**
8. **同一 Space 的 App 写入严格串行，不同 Space 在配额内并行。**
9. **App 无法获取凭据、源码管理、Agent 控制、构建或发布能力。**
10. **App/Agent/Runtime 失败不能破坏 Chat Core，也不能替换最后一个 ready App 或已发布 Release。**

## 2. 产品定义与术语

### 2.1 核心实体

| 实体 | 定义 |
| --- | --- |
| User | Better Auth 管理的产品账号，并映射到一个 Matrix 用户 |
| Space | 用户可见、持续可用并实时更新的多人空间，拥有成员、Chat Core、Kernel Bar、App Project 和权限；不是 Workspace 或试验环境 |
| Matrix Room | Space 在 Matrix/Synapse 中的底层成员与消息容器，仅用于协议、代码和运维语境 |
| Space Template | 市场中可发现、收藏、版本化和审核的 Space 起始模板 |
| Template Version | 模板的一次不可变发布，包含初始 App source/artifact、能力声明、说明和 provenance |
| Space Kernel Bar | Space 中唯一固定的可信宿主 UI；维护身份、ACL、Agent 编排、模板来源、版本指针、状态和恢复 |
| Chat Core | 平台固定、无固定视觉形态的 Matrix 聊天与 Agent 调度能力；App 只能通过 SDK 调用，不能修改其实现和语义 |
| Default Chat App | 空白 Space 的默认 App Project，以可定制代码实现完整 Chat UI，并调用 Chat Core |
| Space App | Kernel Bar 以下的全部运行界面，包括默认或定制后的 Chat UI |
| App Project | 某个 Space 独有的源码、Candidate、当前 ready Revision、Published Release、Agent 上下文和模板 lineage |
| Revision | 一次通过基础校验的不可变源码快照 |
| Draft | 现有实现中的兼容指针名，目标语义是当前 Space 正在使用但尚未发布固化的 ready Revision，不表示试验空间 |
| Release | 从固定 Revision 构建出的不可变正式产物 |
| Agent | 通过受控 Adapter 参与 Space 对话和 App 定制的 AI 执行主体 |
| Agent Adapter | 将平台统一任务协议适配到 Pi 或其他 Agent/provider 的服务端实现 |
| Agent Turn | Agent 对一条或一批 Space 请求的可审计处理单元 |
| Space Instance Server | `chat-app-server.LocalRoomServer` 的正式同构实现；每个 Space 一个逻辑状态机，管理连接、App State、presence、Agent 队列、进度和恢复 |
| Space SDK | App 与 Kernel 之间唯一受控的浏览器能力桥 |

### 2.2 术语规则

- 用户界面、产品设计和公开文档统一使用 `Space`/“空间”。
- `roomId`、`Matrix room` 只允许出现在现有兼容 API、Matrix 事件和基础设施实现说明中。
- 市场对象统一称为 `Space Template`，运行中的协作对象称为 `Space`，避免模板与实例混淆。
- `Kernel Bar`、`Chat Core` 和 `Space App` 是三个逻辑边界；`Chat Core` 不是独立固定面板，生成面板、历史、发布与恢复是 Kernel 的功能，不使用 `Studio` 或 `Workspace` 命名。
- 公共契约使用 `agentId`、`agentProvider`、`agentSessionRef`；不得使用 `piSession` 等 provider 专属字段。
- `ready Revision` 表示当前 Space 实时使用的已验证版本；`Release` 表示由成员显式固化的不可变发布版本。现有 `Draft/Live` 名称只作为迁移兼容字段。

### 2.3 不变量

- 一个 Space、一个现有 `room_index` 记录、一个 Matrix Room、一个逻辑 Space Instance Server 和一个 App Project 构成同一实例；不得同时创建“聊天房间实例”和“多人 Space 实例”。
- 私聊、已有房间和多人 Space 只在成员数量与展示上不同，使用相同 ID 映射、Repository、Instance Server、SDK、队列和发布链路。
- 一个 Space 即使没有额外模板、Agent 不可用或余额不足，也拥有可调用的完整 Chat Core；创建时以 Default Chat App 作为第一个 ready Revision。
- Space Template 可以被多个 Space 使用，但每次应用都会创建独立 Revision，不共享可变 App State。
- 一个 Space 同时最多有一个当前 ready Revision 和一个 Published Release 指针；构建中的 Candidate 不对成员可见。
- Revision、Template Version 和 Release 一旦生成不可原地修改；指针可以前移或恢复。
- App 不能替换或遮挡 Kernel Bar，也不能修改 Chat Core、成员权威、发布确认、账号或支付能力；App 可以任意替换 Kernel Bar 以下的 Chat UI 和其他交互界面。
- 一个 Space 同一时间只有一个 App 写入批次；多个只读或不同 Space 请求可按配额并发。
- Matrix 是成员与聊天消息权威；Product DB 是 Space 索引、市场、Project、队列、版本和持久 App State 权威。
- Agent 只能通过平台授予的上下文、工具和预算工作，不能因 prompt 获得额外权限。
- App SDK 不暴露源码、构建、发布、Agent 工具、凭据、任意宿主请求或自定义高权限通道。

## 3. MVP 范围与成功标准

### 3.1 必须保留的基础能力

- Better Auth 登录、注册、OTP、session、资料设置和设备撤销。
- 联系人搜索、好友请求、接受/拒绝、屏蔽和从联系人发起 Space。
- Space 创建、邀请、成员同步和真实 Matrix timeline。
- 文字、媒体、回复、编辑、删除、回应、已读、typing、历史加载和错误恢复。
- Space 市场的目录、分类、详情、收藏、版本、权限说明和创建入口。
- 账号、偏好、积分、计费、Admin 和多应用/package 边界。

以上能力不因 Space App 改造降级。任何切片如果让 Chat 依赖 Agent、让市场入口消失或破坏旧 Space 可读性，都不能发布。

### 3.2 新增目标

- 创建 Space 时选择空白或市场模板；从模板详情也可以直接发起创建。
- 空白 Space 立即运行 Default Chat App，而不是空画布；之后可以应用模板或请求 Agent 改写整个 App Surface。
- Space 成员可以在 Chat 中选择或提及 Agent，进行普通问答或提出 App 定制请求。
- Agent 将定制请求转成受限项目修改；Candidate 验证成功后生成新的 ready Revision 并实时更新当前 Space，不自动创建 Published Release。
- Candidate 在隔离 Runtime 中验证；验证成功后成为新的 ready Revision，并通过持续更新通道实时替换当前 Space App。
- 有发布权限的成员通过 Kernel Bar 将当前 ready Revision 固化为不可变 Release；失败保持当前 ready Revision 和旧 Release。
- App 使用 Space SDK 获取成员、完整授权 Chat 能力、Mention、`@agent` 调度、presence、持久 state 和瞬时 event；UI 形态由 App 决定。
- Runtime/Agent 重启后恢复 Project、App State、队列、请求和账务状态。
- Agent Adapter 支持替换 provider，不要求数据库迁移或前端重写。

### 3.3 MVP 非目标

- App 修改 Chat Core、成员权威、认证、支付或 Kernel Bar；App 替换 Chat UI 属于目标能力，不在非目标内。
- App 直接调用 Agent 工具、读取源码或自行发布。
- 任意 URL、任意 npm 项目或未经审核压缩包直接成为市场模板。
- Agent 获得平台密钥、用户 Cookie、Matrix token、账单详情或任意外部网络。
- 多个 App 同时控制一个 Space 的主 App Surface。
- E2EE、音视频、Matrix 联邦和原生移动端。
- 在首个 Agent 切片中完成开放 Agent 商店、多 Agent 自主协商或用户自带 provider key。
- 把当前官方模板目录冒充已经上线的第三方创作者生态。

### 3.4 成功指标

| 指标 | MVP 目标 |
| --- | --- |
| 普通 Matrix 消息同区域对端渲染 | p95 < 500ms |
| App State/瞬时事件在线广播 | p95 < 300ms |
| 新 ready Revision 实时切换 | p95 < 2s |
| 已缓存 Published Release 首次 ready | p95 < 2s |
| Agent 请求接受反馈 | 1s 内展示排队或拒绝原因 |
| Agent 或 Runtime 故障期间 Chat | 保持可用，不丢已确认消息 |
| 已入队 Agent 请求 | 服务重启后可恢复，不静默丢弃 |
| Candidate/发布失败 | 100% 保持当前 ready Revision 和上一个 Published Release 可用 |
| 模板应用 | 不修改市场版本，不丢 Space Chat/成员/旧 Release |
| 可信宿主界面 | WCAG 2.2 AA |

Agent 完成时间依赖 provider 和变更复杂度，不承诺固定秒数；Kernel 必须持续展示队列、阶段、心跳和可恢复错误。

## 4. 用户体验与信息架构

### 4.1 一级入口

前端不再提供独立“消息”产品入口。用户进入的是持续运行的 Space；Chat Core 是每个 Space 内固定存在的能力，而它的界面由 Space App 代码定义。一级入口为：

1. Spaces
2. 联系人
3. 发现
4. 服务
5. 我的

| 路由 | 目标职责 |
| --- | --- |
| `/auth`、`/signin`、`/signup` | 认证流程 |
| `/onboarding` | 昵称、用户名和头像设置 |
| `/spaces` | 当前用户可访问的 Space 列表、未读、App/成员状态和创建入口 |
| `/spaces/:spaceId` | 一个实时可用的 Space：顶部固定 Kernel Bar，其下运行完整 Space App；首个迁移切片允许 `spaceId` 暂时解析现有 Matrix Room ID |
| `/contacts` | 联系人、好友请求、搜索和发起 Space |
| `/discover` | Space Template 市场、分类、详情、收藏和创建入口 |
| `/services` | 账号可用的付费与 AI 服务入口，不承担 Space Agent 编排 |
| `/me` | 账号、会话、偏好、积分和隐私 |

`/messages` 与 `/rooms/:roomId` 只保留为迁移期兼容重定向，分别转到 `/spaces` 与 `/spaces/:spaceId`；任何新导航、回跳、公开 CTA、测试或用户文档不得继续生成旧 URL。底层 `roomId`、Matrix Room 与 `/v1/rooms` 兼容 API 仍可存在，但不能泄露为前端产品对象。

### 4.2 创建 Space

```mermaid
flowchart LR
    Start["新建 Space"] --> People["选择参与人"]
    People --> StartMode{"如何开始"}
    StartMode -->|"空白"| Blank["创建空白 Project"]
    StartMode -->|"选择模板"| Market["浏览/选择 Space Template 版本"]
    Market --> Confirm["确认模板权限与版本"]
    Blank --> DefaultChat["复制 Default Chat App"]
    DefaultChat --> Create["创建 Matrix Room 与 Space 实例"]
    Confirm --> Create
    Create --> Enter["进入 Kernel Bar + 实时 Space App"]
```

- 从市场模板详情发起时，创建流程预选该模板，用户仍需选择成员并确认。
- 选择空白时不要求 initial prompt，不等待 Agent；创建事务复制平台 Default Chat App，Space 创建完成后立即是可聊天的 ready 状态。
- 空白 Space 在没有已发布定制 App 时，可以从 Kernel 或发现页应用模板。
- 已有定制时再次应用模板必须显示影响、创建 Candidate 并保留恢复点，不能清空消息、成员或历史版本。
- 创建事务以 `clientRequestId` 幂等；Matrix Room 创建成功但 Space/Project 索引未提交时由 outbox/reconciler 补偿。
- 模板不可用时可以回退为空白创建，不应阻塞基础聊天。

### 4.3 Kernel Bar、Chat Core 与 Space App

#### Kernel Bar：唯一固定的宿主界面

Kernel Bar 固定在 Space 顶部，是模板、Agent 和 App 代码都不能修改的可信边界，负责：

- 返回、Space 名称、成员、连接状态和系统菜单。
- Agent 选择、队列/生成状态、当前 ready Revision 与已发布 Release 状态。
- 源码/版本历史、发布、恢复、权限、举报和治理入口。
- App 崩溃、加载失败、余额不足和 Agent 不可用时，重载最后 ready Revision 或恢复 Default Chat App。

Kernel 的扩展内容只能由顶条打开可信抽屉或模态框。它不在 App DOM/iframe 内，App 不得覆盖其像素区域、拦截其输入或伪造相同来源的控制状态。

#### Chat Core：固定能力，不是固定界面

Chat Core 由 Matrix、Backend、权限系统和 Agent 调度共同实现：

- 支持成员消息、媒体、回复、编辑、删除、Reaction、已读、typing、历史和错误恢复。
- 支持对人类成员的 Mention，以及对允许 Agent 的结构化 `@agent` Mention。
- 人类消息先进入 Matrix；只有服务端确认的结构化 Agent Mention 才能按 `eventId` 幂等创建 Agent Turn。
- App 不能读取 Matrix token、伪造作者或系统/Agent 身份、绕过屏蔽/ACL、改变 Mention 解析、跳过计费确认或建立第二条消息 timeline。
- Chat Core 的接口、事件和错误语义由版本化 Space SDK 提供；Project 代码只能调用，不能覆盖实现。

#### Space App：Kernel Bar 以下的全部界面

Space App 不是附加画布，而是 Space 的完整可编程 Surface：

- Default Chat App 是空白 Space 的初始 Project，以 App 代码提供完整 Chat UI。
- 模板和 Agent 可以任意改变 Chat 的布局、文案、组件、入口和交互方式，也可以把聊天融入游戏、工具、场景或其他实时体验。
- 每个 ready Revision 必须仍提供用户可到达的 Chat Core 调用路径；具体可以是输入框、卡片、命令面板、场景动作或其他设计，不要求保留默认聊天布局。
- App 可以选择展示哪些消息投影和 Agent 状态，但不能改变平台保存的消息、Mention、Agent 调度、权限或审计结果。
- App 在隔离 origin/Runtime 中执行，只能通过 Space SDK 使用平台能力。

因此“三边界”是信任和能力分层，不是“三栏布局”。产品页面不再由宿主同时渲染固定 Chat Panel 和 App Panel。

### 4.4 聊天与 Agent 语义

- 所有人类消息先按标准 Matrix 消息保存和广播，不等待 Agent。
- 普通成员之间的对话默认不进入 Agent 队列。
- 用户通过 Space App 调用结构化 `@Agent` Mention，或通过 Kernel Bar 的可信 Agent 操作发起 Agent Turn；平台不依赖 App 自行解析纯文本。
- Space 可以配置一个默认 Agent；未明确选中时不得把每条人类聊天都自动送入付费 Agent。
- Agent 对请求分类：
  - **Conversation**：回答、解释、讨论或澄清，不修改 Project。
  - **Revision**：创建、修改、修复或删除 App 行为，产生候选源码。
- Conversation 只追加带明确 Agent 身份的 Matrix 回复。
- Revision 必须经过 Space Runtime 验证，成功后成为新的 ready Revision，并实时更新当前 Space；Kernel Bar 同时标记它是否已经固化为 Release。
- Agent 思考、工具调用和构建日志只显示为 Kernel 状态；最终回复和稳定失败摘要进入 Chat Core，再由当前 App 决定如何呈现。

### 4.5 Agent 选择与扩展

- Agent Registry 保存 `agentId`、provider、模型/能力、可用工具、费用策略、版本和状态。
- Space 保存默认 Agent 与允许 Agent 列表；成员权限决定谁能调用、切换或管理 Agent。
- MVP 可以先接入一个 Pi Adapter，但 UI、API、队列、表名、错误码和账务必须使用通用 Agent 术语。
- 新增 Agent Adapter 必须通过相同的权限、上下文裁剪、项目工具、usage、取消、超时和审计合约。
- 不同 Agent 不得直接共享隐藏 session；跨 Agent 上下文只能通过平台持有的可审计 Space 摘要、Project 和授权消息窗口。
- 未来多 Agent 协作应作为独立设计，不改变 Chat 权威或 App 发布规则。

### 4.6 多成员协作

- Agent 忙碌时，Chat 消息仍立即保存、同步和展示。
- 同一 Space 的相邻 Agent 定制请求可以在短窗口内按服务端接收顺序合并。
- 后续明确修正可以覆盖同批次前文；无法安全合并时 Agent 先在 Chat 中请求澄清。
- Publish 单独成批，是前后修改都不能跨越的顺序屏障。
- 在线成员看到同一队列数量、Agent 阶段、当前 ready Revision 和 Published Release 指针。
- 默认成员可聊天；`agent.invoke`、`agent.manage`、`app.edit`、`app.publish` 和 `space.manage` 独立授权。

### 4.7 实时版本、发布与恢复

- Agent 修改或模板应用先形成 Candidate；Candidate 只在隔离 Runtime 中构建，不是成员使用的 Space。
- Candidate 验证成功后成为新的 ready Revision，默认通过内部 `dev` channel 实时切换给当前 Space 的在线成员。`dev` 是交付通道名，不是产品中的 Workspace 或试验场语义。
- 构建失败不会替换最后一个 ready Revision；成员继续使用原 Space App，Chat Core 继续接收和同步消息。
- 具备 `app.publish` 权限的成员可以通过 Kernel Bar 将固定 ready Revision 发布为不可变 Release，用于版本留档、恢复、分享或稳定部署。
- 发布失败不改变当前 ready Revision 或上一个 Published Release；恢复只移动 ready/published 指针，不改写历史。
- 模板应用、Agent 修改、发布和手动恢复都形成 lineage，任何操作都不能删除 Chat 历史。
- Kernel Bar 使用“实时版本 / 已发布版本”等产品文案；`Draft`、`Dev`、`Live` 可以保留为内部兼容字段，但不能把 Space 描述成开发环境。

### 4.8 响应式与可访问性

- 桌面端保留 Space 列表与 Space 主区域；Kernel 不覆盖全局账号退出能力。
- 移动端 Space 独占视口；Kernel Bar 仍固定，Kernel 关键操作支持键盘与触摸，其下全部由响应式 App 代码渲染。
- Kernel Bar 与 Default Chat App 支持屏幕阅读器、200% 字体缩放、高对比和 `prefers-reduced-motion`；市场模板必须声明并验证相同最低门槛。
- App 崩溃、加载失败或不满足最低可用性要求时，Kernel Bar 提供重载最后 ready Revision、回滚或恢复 Default Chat App；不额外渲染一套固定宿主 Chat UI。

## 5. 系统架构

### 5.1 已实现底座与新增目标

| 边界 | 当前事实 | 目标 |
| --- | --- | --- |
| Auth/Profile/Social | Better Auth、资料、联系人和屏蔽已实现 | 保持 |
| Matrix Chat | identity、device、room、timeline、媒体与关系事件已实现 | 继续作为成员与聊天权威 |
| Space 创建 | 当前以 `/v1/rooms` 创建 Matrix Room，并要求内置 `spaceId` | 保持兼容，补充空白/模板模式和 Space 实例语义 |
| Space 市场 | 服务端内置目录、分类、详情、收藏和版本已实现 | 保持并升级为 Space Template 市场 |
| App Runtime | 未实现 | 新增隔离 App、Space SDK 与 Space Dev |
| Agent 协作 | 现有 AI 是独立能力 | 新增 provider-neutral Agent Registry、Adapter 和 Space 队列 |
| 发布 | 未实现 | 新增不可变 Revision/Release 和原子 Live 指针 |

### 5.2 目标拓扑

```mermaid
flowchart LR
    subgraph Browser["浏览器 / PWA"]
        Kernel["Fixed Kernel Bar"]
        AppFrame["Sandboxed Space App\nDefault Chat UI or custom UI"]
        SDK["Space SDK Bridge"]
        ChatAdapter["Trusted Chat Capability Adapter"]
        Kernel <-->|"validated control"| SDK
        SDK <--> AppFrame
        SDK <--> ChatAdapter
    end

    subgraph Product["产品平面"]
        Backend["apps/backend\nAuth / Space API / ACL / Billing"]
        ChatCore["Chat Core\nMention / Agent dispatch / message actions"]
        ProductDB["Product DB\nSpace / Market / Project"]
        Outbox["Outbox / Durable Queue"]
        Backend <--> ChatCore
        Backend <--> ProductDB
        Backend <--> Outbox
    end

    subgraph Runtime["Space Runtime 平面"]
        InstanceServer["SpaceInstanceServer\nper-Space logical actor"]
        Scheduler["Turn Scheduler\nserial per Space"]
        Adapter["Agent Adapter\nPi / other providers"]
        ProjectStore["SpaceProjectStore"]
        DevManager["SpaceDevPreviewManager\nagentOS Apps"]
        ReleaseRuntime["Immutable agentOS Release"]
        InstanceServer --> Scheduler
        Scheduler <--> Adapter
        Scheduler <--> ProjectStore
        Scheduler --> DevManager
        Scheduler --> ReleaseRuntime
    end

    subgraph Matrix["Matrix 平面"]
        Synapse["Synapse"]
    end

    subgraph Storage["对象与状态"]
        ObjectStore["Source / Artifact Store"]
    end

    ChatAdapter <--> ChatCore
    ChatCore <--> Synapse
    Kernel --> Backend
    Synapse -->|"Appservice events"| Backend
    Outbox --> InstanceServer
    InstanceServer <--> Backend
    ProjectStore <--> ObjectStore
    AppFrame --> ReleaseRuntime
```

### 5.3 应用与 package 边界

| 位置 | 责任 |
| --- | --- |
| `apps/web-app` | Space 路由与列表、固定 Kernel Bar、可信 App/Chat capability bridge、Matrix 浏览器同步和市场 UI；不在 App 之外渲染固定 Chat 面板 |
| `apps/backend` | Better Auth、Space/Template ACL、市场 API、数据库事务、积分、Matrix appservice 和 outbox |
| `apps/space-runtime` | 与 `chat-app-server` 同构的 Node 22 + TypeScript + Hono runtime；Space Instance Server、SSE、Turn scheduler、Agent Adapter、Project Store、agentOS Apps Dev/Release |
| `apps/admin-app` | Space/Template/Agent/Release 治理、审核、撤销和审计 |
| `packages/space-app-contracts` | Space SDK、Chat/Mention/Agent capability、runtime session、事件、错误码和 schema |
| `packages/space-app-sdk` | App 使用的浏览器能力 SDK，封装完整 Chat Core 调用，不依赖 React、Matrix token 或宿主路由 |
| `packages/space-app-client` | Web/Desktop Kernel 可复用 bridge 与 runtime client |
| `libs/space-apps` | Backend 单宿主 Project、Revision、Release、State、ACL 和 repository |
| `libs/space-agents` | Agent Registry、计费/outbox 领域规则，不承载 provider SDK 或 VM |
| 现有 `libs/rooms` | Matrix Room 生命周期和兼容 API；不定义用户可见产品术语 |

`apps/space-runtime` 独立部署，因为现有 Cloudflare Backend 不应启动 Agent 子进程、长期 VM 或 Release build。Runtime 只接受 Backend 签发的短期任务和成员作用域 session，不直接信任浏览器 Cookie。

### 5.4 技术方案定案：生产化 `chat-app-server`

Space 技术方案不再保持 Runtime 实现中立。第一版必须沿用 demo 的对象分解与执行链，并在本仓库中使用 Space 命名：

| `chat-app-server` | VibeChat 正式组件 | 保持不变的语义 | 生产化替换 |
| --- | --- | --- | --- |
| `src/server.ts` Hono server | `apps/space-runtime` Hono Node 服务 | HTTP command、SSE event、调度、Dev、Publish 组合 | Backend 签名、ACL、credits、trace |
| `LocalRoomServer` | `SpaceInstanceServer` | 一实例一状态机、snapshot、presence、App State、queue、progress、broadcast、恢复 | `appId` 改为 `spaceInstanceId`；JSON 改为 Repository/lease |
| `rooms` Map | `SpaceInstanceRegistry` | 按实例 ID 惰性加载并复用活动实例 | 多副本以 DB lease 选主，不依赖进程内唯一性 |
| `scheduleRoom/drainTurnQueue` | `SpaceTurnScheduler` | 同实例单写、跨实例有限并行、短批次、Publish 屏障 | durable queue、attempt、heartbeat、reconciler |
| `processTurn` | `SpaceTurnProcessor` | Conversation/Revision、自动修复、Draft、失败保护 | Agent Adapter、credits、审计 |
| `project-store.ts` | `SpaceProjectStore` | 受限多文件项目树、Draft/Live 指针、原子保存 | Product DB 元数据 + Object Store source/artifact |
| `DevPreviewManager` | `SpaceDevPreviewManager` | candidate 同步、隔离 build、ready/error、版本复用 | agentOS Apps 正式环境与配额 |
| `deployApp/appsRouter` | `SpaceReleaseManager` | 不可变 build、release ID、正式 serving | SBOM、provenance、签名、撤销 |
| `room-app-sdk.js` | `space-app-sdk` | snapshot、members/messages/presence/state/event/chat/agent/theme | Better Auth/Matrix 身份和严格 bridge schema |
| Pi generator | `PiAgentAdapter` | 首个 Conversation/Revision 与文件工具实现 | 通过通用 Agent Adapter 接口，可替换其他 Agent |

实现技术栈确定为：

- Node.js 22、TypeScript ESM、Hono 与 `@hono/node-server`。
- `@rivet-dev/agentos` 与 `@rivet-dev/agentos-apps` 作为 App Dev/Release 技术底座；具体版本在实现 spike 后由 lockfile 固定。
- MVP Generated Project 采用 demo 已验证的 TypeScript build 约束与受限项目树：必需入口固定，但 `src/` 可按职责新增模块；路径、文件数、单文件/总大小、依赖与构建输出受平台校验。扩大文件类型、依赖或资源上限需独立评审。
- Kernel realtime 与 demo 一致采用 SSE 下行；写操作使用认证 HTTP command。断线通过事件 sequence + snapshot 恢复。
- App iframe 与 Kernel 之间继续采用版本化 `postMessage` bridge；App 不直接连接 Matrix、Backend privileged API 或 Agent provider。

Agent 仍保持 provider-neutral：确定的是 Space Instance/Project/Dev/Release 技术链，不是把 Pi 固定为唯一 Agent。Agent Adapter 与 agentOS Apps Runtime 是两个接口层。

### 5.5 现有房间与多人 Space 的统一实例模型

不新增第二套 `MultiplayerSpaceInstance`、`RoomInstance` 或平行 Runtime。统一关系为：

```text
SpaceInstance
  1 ── 1 room_index row（当前物理表，逐步扩展）
  1 ── 1 Matrix Room（成员与 Chat 权威）
  1 ── 1 SpaceInstanceServer（逻辑 actor，可重建）
  1 ── 1 App Project（首次迁移时幂等 bootstrap）
  1 ── 0..1 Space Template lineage
  1 ── N members / Agent sessions / Revisions / Releases
```

- 当前私聊或群聊只要已经出现在 `room_index`，它就已经是一个 SpaceInstance，不克隆 Matrix Room，不迁移消息，不重新邀请成员。
- “多人 Space”不是新实体，只是同一 SpaceInstance 中存在多个 Matrix member 和多个 Runtime connection。
- `spaceInstanceId` 是新增长期稳定产品 ID；`matrixRoomId` 保持唯一映射和底层路由 ID。Runtime、Project 和 App State 统一以 `spaceInstanceId` 分区。
- 当前 `spaceId/spaceVersionId` 表示 Space Template lineage，不作为运行实例 ID；空白 Space 允许二者为空。
- Matrix membership 是成员权威；`participant_user_ids_json` 只作创建/ACL 投影缓存，必须由 Matrix event 修复，不能形成第二份成员事实。
- Chat timeline 继续只以 Matrix 为权威。demo `LocalRoomServer.messages` 在正式实现中映射为最近消息投影/Agent 上下文引用，不建立第二套消息数据库。
- 可信 Host 同时组合 Matrix Chat stream 与 Space Runtime SSE，并通过 Space SDK 投影给当前 App；对用户仍是一个 Space，不暴露两个后端实例或固定 Chat 面板。

### 5.6 统一实例生命周期

#### 打开现有聊天实例

1. Kernel 从兼容 `matrixRoomId` 查询 `SpaceInstanceRepository`。
2. 如果历史行没有 `spaceInstanceId`，Backend 在事务中生成并持久化一次；重复请求读取同一值。
3. 如果没有 `projectId`，以现有 `spaceId/spaceVersionId` 模板 lineage 幂等 bootstrap Project；模板已失效则使用 Default Chat App seed。
4. Backend 签发绑定 user、Matrix membership、`spaceInstanceId` 和 Project 的短期 Runtime session。
5. `SpaceInstanceRegistry.get(spaceInstanceId)` 惰性加载与 demo `#getReadyRoom()` 同构的 Instance Server，并从 Repository 恢复 App State、queued/active Turns 和 sequence。
6. Host 从 Matrix SDK 恢复 Chat Core 投影、从 Runtime SSE 恢复 App/Agent snapshot，并通过 Space SDK 交给同一个当前 App；Kernel Bar 只显示可信状态和恢复操作。

#### 创建空白或模板 Space

1. Backend 先生成 `spaceInstanceId` 和 `clientRequestId` 幂等键，校验成员和可选 Template Version。
2. 创建唯一 Matrix Room；成功后在同一 Saga 中写一条 `room_index` 记录，而不是分别写 Room 与 Space。
3. 空白模式 bootstrap Default Chat App Project；模板模式复制固定 Template Version 为初始 Revision。两者都必须产生可立即运行的 ready Revision。
4. outbox 写入 v2 Matrix state，并允许现有客户端继续读取 v1 模板字段。
5. Instance Server 在首次进入 Space 时惰性启动，以提供 Default Chat App、Space SDK 与实时更新；Chat Core 的 Matrix 消息链路不依赖 Agent/Build lease。

#### 从一对一变为多人

- 增加成员只产生标准 Matrix membership 事件和 ACL 投影更新。
- `spaceInstanceId`、Matrix Room、Project、Instance Server、ready/Published 指针、App State 和队列全部保持不变。
- Instance Server 更新 members/presence snapshot 并广播，不运行“转换为多人 Space”的迁移任务。

#### 多副本接管

- 每个 `spaceInstanceId` 同时只有一个写 lease owner；非 owner 可以代理/重定向 SSE 和 command，但不能 claim Turn。
- lease、active attempt、queued request 和 snapshot 均持久化。owner 失联后，新副本恢复 interrupted Turns 到队首，与 demo 把 `activeTurns` 放回 `queuedTurns` 的规则一致。
- Chat 不经过该 lease，Space Runtime 接管期间 Matrix 消息仍正常工作。

## 6. Space Kernel 与 Agent 编排

### 6.1 Kernel 职责

Space Kernel 负责：

- 校验 Better Auth 用户、Matrix membership 和 Space 权限。
- 将 Chat Core 的消息、Mention、成员、关系事件、已读、typing、媒体和连接状态通过版本化 SDK 投影给 App。
- 管理 Space Template 应用、lineage 和市场来源展示。
- 保存并广播持久 App State、presence 和瞬时事件。
- 维护 Agent 请求队列、批次、心跳、取消、失败、重试和恢复。
- 维护 App Project、Candidate、当前 ready Revision 和 Published Release 指针。
- 执行积分预留/结算、发布权限、审计和配额。
- 向 App 暴露经过 ACL 校验的 Space SDK snapshot、完整 Chat capability 与实时事件。

Kernel Bar 与 Host capability adapter 是浏览器中的可信层；`SpaceInstanceServer` 是它在 Runtime 中的同实例状态机。三者通过 `spaceInstanceId` 和短期 Runtime session 绑定。Backend 负责身份、Matrix、Chat Core、ACL、账务和持久事务，Instance Server 负责与 demo `LocalRoomServer` 一致的活动连接、sequence、snapshot、App realtime、Turn 状态和广播；不能把它们实现成不同产品实例。

### 6.2 消息到实时 Revision 的执行流

```mermaid
sequenceDiagram
    participant U as Member through Space App
    participant M as Matrix/Synapse
    participant B as Backend
    participant S as SpaceInstanceServer
    participant A as Agent Adapter
    participant D as Space Dev
    participant H as Host SDK / Kernel Bar

    U->>M: message(txnId, optional agent mention)
    M-->>U: eventId / local echo confirmed
    M->>B: appservice event
    alt human-only chat
        B-->>H: Chat Core event projection
    else explicit Agent request
        B->>B: membership + ACL + credits + dedupe
        B->>S: beginTurn(eventId, agentId)
        S->>S: persist + enqueue + broadcast
        S-->>H: queue_updated over SSE
        S->>A: claim serial batch + bounded context
        alt Conversation
            A-->>B: Agent reply only
            B->>M: Agent message
        else Revision
            A-->>D: bounded project files
            D->>D: validate / transpile / health check
            alt ready
                D-->>B: immutable ready revision
                B-->>H: ready_revision_changed
            else failed
                D-->>B: stable diagnostics
                B-->>H: turn_failed; current App unchanged
            end
        end
    end
```

Matrix appservice 事件以 `eventId` 幂等投影。App 提交的 Agent Mention 必须是结构化 mention metadata；服务端不信任 App 对纯文本 `@name` 的自行判断。`beginTurn → persist → broadcast → schedule → claim → process → complete/fail` 的顺序与 demo 保持一致，只把本地 JSON 保存替换为持久 Repository。浏览器重复同步、Backend 重试或 Runtime 重连不能产生第二个 Agent 请求。Chat 接受成功与 Agent 请求成功是两个独立结果：Agent 拒绝不能撤回已经确认的人类消息。

### 6.3 排队、批次与屏障

- 队列键为 `spaceInstanceId`；同一键最多一个 active write batch。
- 不同 Space 由全局、租户、用户、Agent provider 和 Runtime provider 配额限制后并行。
- 短窗口只合并相邻的 Agent 定制请求，不合并普通人类聊天。
- 批次保留每条请求的作者、Matrix event ID、Agent ID、时间和积分 reservation。
- `publish` 每次只处理固定 ready Revision，并作为顺序屏障。
- Agent/Runtime 定期发送心跳；lease 超时回到可恢复状态，不能直接重复扣费或发消息。

### 6.4 Agent 上下文与工具

- 每个 Space/Agent 组合有隔离 session；不得读取其他 Space 或其他 Agent 的隐藏上下文。
- Agent 只接收完成请求所需的成员显示名、显式授权消息窗口、Project snapshot、模板 lineage 和预算。
- 不发送邮箱、token、账单详情、完整账号资料或未授权私聊历史。
- 工具限定在项目文件 allowlist、单文件/总大小、依赖 allowlist 和受限读写动作。
- 安装依赖、任意 shell、宿主文件、凭据、网络和发布动作默认不可用。
- 平台校验 Agent 输出；Agent 不能自行扩大 SDK、Runtime 或网络权限。

### 6.5 Provider Adapter 合约

每个 Agent Adapter 至少实现：

```ts
interface SpaceAgentAdapter {
  beginSession(input: BeginSessionInput): Promise<AgentSessionRef>
  runTurn(input: AgentTurnInput, signal: AbortSignal): AsyncIterable<AgentEvent>
  summarize(input: AgentSummaryInput): Promise<AgentSummary>
  cancel(input: CancelAgentTurnInput): Promise<void>
  restore(input: RestoreAgentSessionInput): Promise<AgentSessionRef>
}
```

统一 `AgentEvent` 只允许标准化的 `status`、`text_delta`、`tool_activity`、`project_patch`、`usage`、`completed` 和 `failed`。Provider 原始事件留在受限诊断中，不直接暴露给浏览器。

Pi Adapter 可以将 demo 的 conversation/revision 分类、文件工具和 session 恢复映射到该合约；其他 Agent 使用相同入口。

### 6.6 重启恢复

- 接收 Agent 请求时先持久化请求、reservation 和顺序，再确认入队。
- active batch 使用 lease/attempt；Runtime 重启后过期任务回到队首或进入人工恢复。
- Project snapshot、Agent session ref、ready/Published 指针、模板 lineage 和 App State 持久化。
- 重试必须复用 Matrix event ID、request ID 和 reservation，不重复回复、Revision、Release 或扣费。
- Agent session 无法恢复时允许从平台摘要重建，但必须记录上下文截断和 provenance。

### 6.7 权限模型

| 权限 | 说明 |
| --- | --- |
| `space.chat` | 使用完整 Chat |
| `space.invite` | 邀请成员 |
| `template.apply` | 将模板应用为 Candidate，并在验证成功后更新 ready Revision |
| `agent.invoke` | 调用已允许 Agent |
| `agent.manage` | 选择默认 Agent、允许列表和策略 |
| `app.interact` | 使用 App SDK 互动 |
| `app.edit` | 查看当前 Revision、源码摘要和生成诊断 |
| `app.publish` | 发布固定 Revision |
| `space.manage` | 管理成员、权限和 Space 生命周期 |

权限变化由 Kernel/Backend 校验，不由 App、模板或 Agent 决定。被移出 Matrix Room 的用户立即失去 Runtime session。

### 6.8 积分与结算

- 普通人类 Chat 不产生 Agent 费用。
- 每个显式 Agent 请求单独预留积分，批次执行后按可审计规则分摊 usage。
- Provider 返回模型、token、工具和构建 usage；平台映射到规范交易代码。
- 无权限或余额不足时消息仍可进入 Chat，但该 Agent 请求不入队，并给作者明确反馈。
- 超时、取消、失败、重试和恢复必须执行恰好一次结算或退款。
- Template 应用本身默认不产生 Agent 费用；需要 Agent 迁移/修复时先再次确认预算。

## 7. Space Template、Project、Dev 与 Release

### 7.1 Space 市场

市场保留并继续承担：

- 浏览官方和用户发布并通过当前治理策略的 Space Template。
- 分类、搜索、详情、预览、收藏、版本、作者、权限和兼容性说明。
- 从模板详情创建 Space，或向空白/已有 Space 应用模板。
- 展示模板版本更新，但不自动覆盖 Space 的定制 Project。

当前 `/v1/spaces` 与 `spaceId/spaceVersionId` 是已实现目录契约。迁移期将其解释为模板引用并保持兼容；新契约可逐步增加 `spaceTemplateId/spaceTemplateVersionId`，不能先删除现有消费者。

官方 Template 与用户 Template 必须遵循同一发布协议和市场数据结构，不建立 `BuiltInTemplate`、`OfficialTemplateVersion` 或用户专用平行模型：

| 契约 | 统一职责 |
| --- | --- |
| `SpaceTemplate` | identity、slug、Publisher、展示元数据和当前版本指针 |
| `SpaceTemplateVersion` | 不可变 artifact 引用、格式、capabilities、SDK/Runtime compatibility、hash、integrity 和 provenance；不内联工作源码 |
| `SpaceTemplateArtifact` | 按 source hash 寻址的不可变 App Project source/build artifact；由 Registry/Object Store 保存和解析 |
| `SpaceTemplateMarketEntry` | 市场目录读取快照；官方与用户条目的字段完全相同 |
| `publisher.verification` | `official / verified / unverified`；官方只是 Publisher 的验证状态，不是 Template 类型 |
| `provenance.origin` | `repository / app`；表示创作入口，不改变版本或市场协议 |

每个官方 Template 在仓库只维护一个持续演进的普通多文件 `app/` 工作项目和一份扁平 release 索引，历史版本不得复制成多套源码目录。`src/index.ts` 只负责 Runtime 启动和 handler 装配；页面、样式、浏览器行为、Template 业务与默认 Chat UI 按职责拆分。Artifact 对完整项目树按规范化相对路径寻址，Runtime、Dev Preview、Agent Revision 和发布器都不得退化成只识别固定入口文件。官方发布从固定 Git revision 构建按 hash 寻址的不可变 artifact；用户 Template 从某个 Space 的固定 ready Revision 通过 App 内发布入口提交，经隐私清理、能力/兼容性校验和审核后生成同一种 artifact 并写入 Product DB/Object Store。Template Version 只引用 artifact，不把工作源码内联到市场目录。两者进入市场后使用同一收藏、搜索、版本、应用、撤销和 Runtime bootstrap 链路。任何消费者都不得用目录位置或 `builtin` 字段分支，只能按 Publisher verification 展示认证标记，按 provenance 执行供应链审计。

Template Version 使用独立的 SemVer 序列，不能跟随实现阶段、协议 schema、SDK/Runtime、Space Revision 或 Release 数量随意增长。新 Template 从 `0.1.0` 开始；每次发布只能依据不可变 Template 内容的兼容性变化单步提升 patch、minor 或 major，不能跳号，也不能为无内容变化的重建、文档、排序或运行时修复升版。正式规则与判定表以 [Space Template 版本规则](../references/space-template-versioning.md) 为准。

### 7.2 模板应用规则

- 创建时选择模板：复制固定 Template Version 为 Project 初始 Revision。
- 创建空白：复制 Default Chat App Project 并生成第一个 ready Revision，Space 立即可用。
- 仍使用 Default Chat App：可直接选择模板，模板 Candidate 验证成功后实时切换为新 ready Revision。
- 已定制：应用模板必须创建 Candidate、展示差异/风险并保留当前 ready Revision 与 Published Release；验证成功后才实时切换。
- 模板升级：只提示新版本；成员明确选择后才创建合并或替换 Candidate。
- 模板卸载不是删除 Space；可以恢复为空白 App，但 Chat、成员和版本历史继续存在。

### 7.3 Project 与 Revision

Project 只允许平台支持的文件类型、入口和依赖。它保存：

- `spaceInstanceId`
- 模板与版本 lineage
- 当前 source manifest/hash
- 当前 ready Revision 指针（迁移期可映射现有 Draft 字段）
- Published Release 指针（迁移期可映射现有 Live 字段）
- Agent session refs 与摘要
- Runtime provider 和兼容版本

每个 Revision 保存 source hash/object key、父 Revision、来源类型（blank/template/agent/restore）、作者、Agent/Template 引用、摘要、校验状态和 provenance。

### 7.4 持续更新通道

- Candidate source 在隔离、短生命周期环境验证。
- 校验入口、依赖、类型、构建、启动、health、SDK 版本和基本资源上限。
- 验证成功才写不可变 Revision、更新当前 ready 指针并向在线成员广播；成员无需进入单独 Workspace 或试验模式。
- 验证失败返回截断诊断；不会覆盖最后 ready Revision 或 Published Release。
- Candidate 与每个已 ready Revision 使用彼此隔离、可按固定 Revision ID 寻址的运行实例。启动 Candidate 不得停止当前 ready 实例；页面刷新、iframe 重载和短暂 Runtime 重连都必须继续请求同一个最后 ready Revision，直到新的 ready 指针原子切换。
- App 文档代理必须保留 Runtime 的真实非 2xx 状态，不得在 Template Project 之外合成 Default Chat UI。恢复 Default Chat 是 Kernel 的显式受管操作，会产生新的已验证 Revision，而不是网络错误兜底。
- 自动修复由当前 Agent Adapter 在预算与次数上限内完成，不绑定 Pi。

内部仍可以使用 `dev` channel、Dev Preview Manager 或 Draft 字段承载这条链路，但它们属于实现术语。产品语义始终是“当前 Space 实时更新”，而不是让成员在开发环境和真实 Space 之间来回切换。

### 7.5 发布

发布输入固定 `revisionId`、`clientRequestId` 和发布者身份：

1. 校验 membership、`app.publish`、Revision/Space 归属、ready 状态和 Chat capability smoke 结果。
2. 对相同 source/runtime 输入复用已有安全 artifact。
3. 在隔离 build 环境生成不可变 artifact、SBOM 和 provenance。
4. 通过 health/SDK compatibility/security checks。
5. 创建 Release 并原子更新 Published Release 指针；当前 Space 的 ready Revision 在发布前已经可用。
6. 用 outbox 同步 Matrix state 和在线成员。

任何失败都保留当前 ready Revision 和旧 Published Release。Release 撤销或回滚只移动 Published 指针，不改写历史；恢复当前 Space App 则移动 ready 指针到一个已验证 Revision。

## 8. Space SDK 与 App Runtime

### 8.1 信任边界

App 按不可信代码处理。它只能获得短期、Space/成员/Release 绑定的 Runtime session，以及最小 SDK snapshot。

| 能力 | App 可用 | Kernel/服务端专属 |
| --- | --- | --- |
| 读取最小成员资料 | 是 | 完整账号、邮箱、权限变更 |
| 读取授权 Chat timeline 与实时事件 | 是，通过 SDK 分页/订阅 | Matrix token、绕过 retention 的完整导出 |
| Presence | 是 | 成员身份伪造 |
| 持久 App State | 是，受 CAS/配额限制 | DB 直写、跨 Space 访问 |
| 瞬时事件 | 是，受限流限制 | 任意广播或跨 Space topic |
| Chat 完整操作 | 是，由当前成员身份代理，覆盖发送、回复、编辑、删除、Reaction、已读、typing 和媒体 | 指定他人/Agent/系统身份或绕过 ACL |
| Mention | 是，使用平台返回的结构化 member/agent target | 自行伪造 target、改变解析或调度语义 |
| 调用 Agent | 是，通过带结构化 Agent Mention 的 Chat command 发起受权限/计费控制的请求 | 直接调用 provider、选择隐藏工具、注入 provider key |
| Theme token | 是，受 allowlist 限制 | 替换或伪造 Kernel Bar |
| Source/build/publish | 否 | Kernel、Backend、Runtime |

### 8.2 SDK API

```ts
interface VibeChatSpaceSDK {
  ready(): Promise<SpaceSnapshot>
  members: {
    list(): readonly SpaceMember[]
    subscribe(handler: (members: readonly SpaceMember[]) => void): Unsubscribe
  }
  chat: {
    recent(options?: { limit?: number; before?: string }): Promise<MessagePage>
    subscribe(handler: (event: MessageEvent) => void): Unsubscribe
    send(input: {
      body: string
      mentions?: readonly MentionTarget[]
      replyToEventId?: string
      clientRequestId: string
    }): Promise<{ eventId: string; agentRequestIds: readonly string[] }>
    edit(input: { eventId: string; body: string; mentions?: readonly MentionTarget[]; clientRequestId: string }): Promise<void>
    redact(input: { eventId: string; clientRequestId: string }): Promise<void>
    react(input: { eventId: string; key: string; clientRequestId: string }): Promise<void>
    markRead(eventId: string): Promise<void>
    setTyping(value: boolean): Promise<void>
    upload(input: ChatUploadInput): Promise<ChatAttachment>
  }
  mentions: {
    search(input: { query: string; kinds?: readonly ('member' | 'agent')[] }): Promise<readonly MentionTarget[]>
    resolve(targetId: string): Promise<MentionTarget | null>
  }
  agents: {
    list(): readonly SpaceAgentSummary[]
    status(): ReadonlyAgentStatus
    subscribe(handler: (status: ReadonlyAgentStatus) => void): Unsubscribe
  }
  presence: {
    get(): PresenceSnapshot
    set(value: JsonValue): Promise<void>
    subscribe(handler: (event: PresenceEvent) => void): Unsubscribe
  }
  state: {
    get<T extends JsonValue>(key: string): Promise<StateValue<T> | null>
    set<T extends JsonValue>(key: string, value: T, expectedRevision?: number): Promise<StateValue<T>>
    subscribe(handler: (event: StateEvent) => void): Unsubscribe
  }
  events: {
    emit(name: string, payload: JsonValue): Promise<void>
    subscribe(name: string, handler: (event: AppEvent) => void): Unsubscribe
  }
  theme: {
    request(tokens: Partial<ThemeTokens>): Promise<AppliedThemeTokens>
  }
}
```

Agent 调度没有可由 App 绕过聊天语义的 provider 直连入口。App 先通过 `mentions.search()` 获得平台签发的 Agent target，再把它放入 `chat.send()`；Chat Core 在 Matrix event 确认后执行 Agent allowlist、权限、预算、计费、`eventId` 去重和排队。即使 App 把这一动作表现为按钮、游戏动作或表单，它仍与用户在默认 Chat UI 中输入 `@agent` 使用同一平台命令。App 不能指定工具、隐藏 session、模型密钥或发布意图。

上述接口是目标能力面，具体 TypeScript 类型在 `packages/space-app-contracts` 中版本化。现有简化的 `messages`、`chat.send({ text })` 与 `agent.request()` 只能作为迁移适配器，不能成为两套消息或 Agent 调度语义。

### 8.3 Bridge 与 iframe

- App 与 Host 使用不同 origin；Host 校验准确 `contentWindow`、session nonce、schema、sequence、action 和 payload。
- iframe 默认只允许 scripts/forms/modals/downloads，不授予顶层导航、摄像头、麦克风、宿主 Cookie 或存储。
- Generated Runtime 不注入平台 secret，出站网络默认拒绝。
- 未知 action、旧 iframe、错误 nonce、超配额、原型污染 key 和伪造身份全部拒绝。
- App 身份由 Host 注入；payload 中的 user/space/release 声明不可信。
- 未来外部网络 capability 需要独立的域名 allowlist、用户同意、egress proxy 和审计设计。

### 8.4 数据限制

初始上限：

- Presence：单成员 8 KiB，客户端合并到约 10 次/秒。
- 瞬时事件：16 KiB，按 Space/成员限流。
- 持久 App State：总计 128 KiB、最多 128 个 key、最大 12 层 JSON。
- key/事件名：1–64 位安全字符，拒绝原型污染键。
- 有限消息 snapshot：默认最近 50 条，受 membership、隐私和 retention 控制。
- App 发起 Chat/Agent 写入必须有幂等 request ID。

服务端必须再次校验，不能信任 SDK 客户端节流。

## 9. Matrix、数据模型与迁移

### 9.1 数据权威

| 数据 | 权威来源 |
| --- | --- |
| 用户、Cookie session | Better Auth |
| 资料、联系人、屏蔽 | Product DB |
| Matrix identity/device | Product DB 映射 + Synapse |
| Space membership、邀请、Chat、媒体、已读、typing | Matrix/Synapse |
| Space 实例索引、ACL、模板 lineage | Product DB，membership 以 Matrix 复核 |
| 市场目录、收藏、模板版本与审核 | Product DB/Object Store |
| Project、Revision、Draft、Release | Product DB/Object Store |
| Agent Registry、请求、lease、reservation、审计 | Product DB/Durable Queue |
| 持久 App State | Product DB |
| Presence、瞬时事件、构建进度 | Realtime/Runtime，可由 snapshot 重建 |

### 9.2 Matrix 映射

继续使用标准事件：

- `m.room.member`：成员与邀请。
- `m.room.message`：人类和 Agent 的文字/媒体消息。
- `m.reaction`、reply、replace、redaction：回应、回复、编辑和删除。
- receipt、typing：已读和正在输入。

新增 `io.vibechat.space.instance.v2` 只保存公开、可恢复指针：

```json
{
  "schemaVersion": 2,
  "spaceInstanceId": "01J...",
  "spaceTemplateId": "space-garden",
  "spaceTemplateVersionId": "tplv-space-garden-1-0-0",
  "projectId": "01J...",
  "liveReleaseId": "01J...",
  "runtimeVersion": "1",
  "updatedAt": "2026-08-22T00:00:00Z"
}
```

Matrix state 不保存源码、Agent session、token 或私有构建日志。Product DB 是指针业务权威；跨系统不一致由 outbox 幂等修复。

### 9.3 核心数据模型

`room_index`（统一 SpaceInstance 的现有物理表，不再新建 `space_instances` 平行表）

- `matrix_room_id`：现有主键，继续唯一。
- `space_instance_id`：新增稳定 ULID，唯一、非空；历史行回填，新逻辑 actor/Project/SDK 统一使用。
- `creator_user_id` / `participant_user_ids_json`：保留；后者降级为 Matrix membership 投影缓存。
- `space_id` / `space_version_id`：保留兼容，语义明确为 Template lineage；空白 Space 改为 nullable。
- `project_id`：新增唯一外键；迁移期间允许 nullable 并幂等 bootstrap。
- `default_agent_id`：nullable，指向 Agent Registry。
- `client_request_id`、`instance_config_json`、`status`、`created_at`、`updated_at`。

领域层立即改名为 `SpaceInstanceRecord`、`SpaceInstanceRepository` 和 `SpaceInstanceService`。物理表暂时保留 `room_index` 名称是为了 PostgreSQL/SQLite/D1 安全迁移，不代表存在 Room 产品实体；禁止再创建一张承载同一 Matrix Room 的 Space 表。

`space_instance_runtime_state` / `space_instance_leases`

- `space_instance_id`（主键/外键）、`sequence`、`snapshot_version`、`lease_owner`、`lease_expires_at`、`updated_at`。
- Instance Server 可以丢弃并重建；持久状态、Turn 和 lease 不能只存在 Node 进程内。
- lease 只约束 Space App/Agent 写状态机，不阻塞 Matrix Chat。

`space_templates` / `space_template_versions`

- 官方与用户共用的市场 identity、Publisher、作者、分类、状态、收藏/展示元数据；不按来源拆表。
- 版本 source/artifact hash、SDK/runtime compatibility、capabilities、provenance 和审核状态；`publisher_id` 与所有者/组织关联。
- `provenance.origin=repository` 记录官方仓库路径/提交/build，`origin=app` 记录源 Space ready Revision/build；两种来源签发同一种不可变版本。
- 官方仓库目录是创作源，不是第二个运行时市场；部署时由发布器同步为相同 Product DB/Object Store 记录。

`space_app_projects`

- `id`、`space_instance_id`、`draft_revision_id`、`live_release_id`
- `runtime_provider`、`created_at`、`updated_at`

`space_app_revisions`

- `id`、`project_id`、`parent_revision_id`
- `source_hash`、`source_object_key`、`summary`
- `source_kind`、`source_template_version_id`、`source_agent_id`、`source_turn_id`
- `created_by`、`validation_status`、`created_at`

`space_app_releases`

- `id`、`project_id`、`revision_id`、`runtime_release_id`
- `artifact_hash`、`provenance_json`、`published_by`、`published_at`、`revoked_at`

`space_agents` / `space_agent_sessions`

- Registry 配置与 Space/Agent 隔离 session ref、版本、摘要和恢复信息。

`space_agent_requests` / `space_agent_batches`

- Space、Matrix event、作者、Agent、顺序、kind、状态、lease、attempt、reservation 和结果。
- 唯一约束覆盖 Matrix `event_id` 与业务幂等键。

`space_app_state`

- `space_instance_id`、`revision`、`values_json`、`updated_at`。
- 写入使用 `expectedRevision` CAS；冲突返回最新 revision。

### 9.4 兼容迁移

- 现有每条 `room_index` 记录原地升级为唯一 SpaceInstance；新增并回填 `space_instance_id`，不复制记录、不创建新 Matrix Room、不移动 timeline。
- `SpaceInstanceRepository` 是唯一实例 Repository；旧 `RoomRepository/RoomService` 在迁移期只作为同一服务的命名适配器，不能拥有独立表、缓存或创建事务。
- 现有 `/v1/rooms` 和 `matrixRoomId` 兼容 transport 继续服务，通过唯一映射解析同一 `spaceInstanceId`；前端 `/rooms/:roomId` 只重定向到 `/spaces/:spaceId`，迁移不能中断 Chat。
- 现有 `spaceId`、`spaceVersionId` 继续表示创建时选择的模板/版本，逐步别名为 `spaceTemplateId`、`spaceTemplateVersionId`。
- 现有 `/v1/spaces`、Discover、分类、详情和收藏继续保留；不得按上一版方案删除。
- `io.vibechat.space.instance.v1` 继续双读；新能力写 v2，并保留回滚读取。
- 历史 Space 在 backfill job 或首次进入新 Kernel 时幂等创建同一实例的 Project，模板 lineage 来自当前行/v1 state；找不到模板时创建空白 Project，但 Chat 不受影响。
- `SpaceInstanceRegistry` 首次收到 Runtime session、App command 或 Agent Turn 时按 `spaceInstanceId` 惰性恢复一个逻辑 Instance Server；多副本同时恢复时只允许持有 lease 的副本消费写队列。
- 一对一与多人实例执行完全相同的 bootstrap、subscribe、state、queue、Dev 和 Release 路径；测试不得用参与人数选择另一套 service/runtime。
- 不把现有市场收藏迁移为运行实例收藏；它继续关联 Space Template。

## 10. API 与实时契约

### 10.1 市场与创建兼容

现有市场 API 保持可用。目标契约可增加更清晰的 Template 路径，但不能删除旧路径后再迁移客户端。

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/v1/spaces` | 现有 Space Template 市场目录兼容入口 |
| `GET` | `/v1/spaces/:templateId` | 模板详情与当前可用版本 |
| `PUT` | `/v1/preferences/favorite-spaces/:templateId` | 收藏模板 |
| `GET` | `/v1/space-templates` | 目标别名，可在客户端迁移后启用 |
| `POST` | `/v1/space-templates` | 目标用户发布入口；从调用者有权发布的固定 Space ready Revision 创建待审核 Template Version |
| `POST` | `/v1/rooms` | 现有创建入口；内部创建 Matrix Room 与 Space 实例 |

兼容创建请求：

```json
{
  "participantUserIds": ["01J..."],
  "spaceId": "space-garden",
  "spaceVersionId": "tplv-space-garden-1-0-0",
  "clientRequestId": "01J..."
}
```

空白创建允许模板字段为空。新客户端可同时发送命名更明确的 `spaceTemplateId/spaceTemplateVersionId`，服务端拒绝两组字段互相冲突。

### 10.2 Space App API

| Method | Path | 用途 |
| --- | --- | --- |
| `POST` | `/v1/rooms/metadata` | 兼容批量读取可访问 Space 摘要 |
| `GET` | `/v1/rooms/:roomId/app` | 通过 Matrix Room 兼容 ID 读取 Project/Draft/Live |
| `POST` | `/v1/rooms/:roomId/apply-template` | 将固定模板版本应用为 Draft |
| `POST` | `/v1/rooms/:roomId/runtime-session` | 签发短期成员作用域 Runtime session |
| `GET` | `/v1/rooms/:roomId/revisions` | 读取 Revision 摘要 |
| `POST` | `/v1/rooms/:roomId/agent-requests` | 显式调用允许的 Agent |
| `POST` | `/v1/rooms/:roomId/publish` | 发布固定 Revision |
| `GET` | `/v1/rooms/:roomId/releases` | Release 历史和撤销状态 |
| `PUT` | `/v1/rooms/:roomId/permissions/:userId` | 管理协作权限 |

目标 `/v1/space-instances/:spaceInstanceId/*` 可以在拥有稳定 Space 实例 ID 后作为新别名提供；迁移期间两组 API 共享同一领域服务，不能复制业务逻辑。

Chat 继续由 Matrix SDK 发送，不另造聊天 API。

`POST /v1/rooms` 与未来 `POST /v1/space-instances` 都只能调用 `SpaceInstanceService.create()`；前者是兼容 transport adapter。`GET /v1/rooms/metadata` 同样读取 `SpaceInstanceRepository`，不存在另一份 Room 元数据模型。

### 10.3 Backend、Runtime 与 Agent Adapter

- Backend 通过签名任务投递 Agent batch、Project snapshot、预算和权限快照。
- Runtime 选择 Agent Adapter，并标准化 progress、candidate Revision、diagnostics、usage 和 completion。
- Runtime 不能直接改积分账本、ACL、市场或 Matrix membership。
- 内部调用包含短期 audience、task/attempt/trace ID 和幂等键，不复用用户 Cookie。
- Runtime transport 与 demo 保持同构：Kernel 用短期 session 建立 `GET /runtime/spaces/:spaceInstanceId/events` SSE；写命令进入 `POST /runtime/spaces/:spaceInstanceId/commands`。Backend/网关校验后覆盖 user、Space、Agent 和 Release identity。
- SSE snapshot 包含 Instance Server 的 `sequence`、members projection、App State、presence、Agent build/queue 与 Project 指针；Chat 消息正文仍由 Matrix timeline 提供，snapshot 只包含授权的有限投影。
- `SpaceInstanceRegistry` 对相同 `spaceInstanceId` 返回同一逻辑实例；HTTP、Matrix appservice、SDK bridge 和恢复 worker 不能各自创建状态机。

### 10.4 实时事件

至少定义：

- `snapshot`
- `members_changed`
- `message_appended`
- `presence_changed`
- `app_state_changed`
- `app_event`
- `agent_queue_updated`
- `agent_turn_started`
- `agent_delta`
- `agent_activity`
- `heartbeat`
- `draft_ready`
- `dev_failed`
- `deployed`
- `agent_completed`
- `agent_failed`

断线后重新获取 snapshot 并按 cursor 接续；业务正确性不能依赖浏览器收齐全部 progress event。

### 10.5 错误与幂等

新增稳定错误码至少区分：

- `SPACE_NOT_FOUND`
- `SPACE_PERMISSION_DENIED`
- `SPACE_TEMPLATE_NOT_FOUND`
- `SPACE_TEMPLATE_VERSION_UNAVAILABLE`
- `SPACE_AGENT_NOT_AVAILABLE`
- `SPACE_AGENT_CREDITS_REQUIRED`
- `SPACE_AGENT_QUEUE_FULL`
- `SPACE_DEV_PREVIEW_FAILED`
- `SPACE_REVISION_STALE`
- `SPACE_RELEASE_BUILD_FAILED`
- `SPACE_RUNTIME_UNAVAILABLE`
- `SPACE_APP_STATE_CONFLICT`

创建 Space、应用模板、Agent 入队、state mutation、publish 和 Release activation 都使用业务幂等键；HTTP/队列重试不得重复扣费、发消息、生成 Revision 或发布。

## 11. 安全、隐私与治理

### 11.1 主要威胁

- 模板或 Generated App 读取、伪造或外传 Chat/成员/状态数据。
- App 伪造 Kernel Bar、平台确认状态、Agent/系统身份、登录、支付、发布或权限结果；App 自己实现 Chat UI 不视为伪造。
- iframe 逃逸、旧 session 重放或伪造成员身份。
- prompt injection 让 Agent 读取宿主文件、凭据或其他 Space。
- 恶意源码导致构建逃逸、资源耗尽、供应链替换或 SSRF。
- 成员滥用他人积分、覆盖当前 ready Revision 或未经授权发布。
- Matrix、Agent queue、账务和 ready/Published 指针跨系统不一致。

### 11.2 强制控制

- Kernel Bar、Chat Core 与 Space App 使用明确不同的信任边界；Generated Runtime 使用隔离 origin，Chat UI 虽在 App 内但所有能力调用仍越过受校验 bridge。
- SDK bridge 校验 `contentWindow`、nonce、schema、action、payload、sequence 和速率。
- App 身份由 Kernel 注入；user/space/release/agent 声明由服务端覆盖。
- Agent session 与项目执行目录按 Space/Agent 隔离，仅开放 allowlist 工具和路径；该技术目录不构成用户可见 Workspace。
- 构建无平台 secret，并限制 CPU、内存、时间、磁盘和网络。
- Template Version、source、artifact、SBOM 和 provenance 与 hash 绑定。
- 市场发布需要审核、兼容性与权限说明；收藏和安装量不能赋予模板额外能力。
- 积分 reservation、结算、退款和 publish 幂等且可审计。
- 日志不记录消息正文、完整 prompt、源码全文、OTP、token、Cookie 或 App State 私有值。

### 11.3 隐私与治理

- Space 创建/邀请说明 Agent 是否启用、消息何时会提交给 Agent、费用由谁承担。
- 默认只有显式 Agent 请求进入 provider；普通人类 Chat 不自动发送给 Agent。
- App 只能获得当前成员获准访问的成员资料、分页 Chat timeline、实时事件和 App State，默认不能联网；授权范围不因 UI 可定制而扩大。
- Admin 可以审核 Template、撤销 Release、冻结 Agent、限制权限和查看 provenance，不能绕过审计改源码。
- 被撤销 Release 不再加载；Kernel Bar 回退到最后 ready Revision 或 Default Chat App，Chat Core 不受影响。
- 支持举报 Space、消息、Template、App、Agent 回复和 Release。

## 12. 部署、容量与可观测性

### 12.1 部署单元

- `web-app`、`backend`、`admin-app` 延续现有独立构建和同源产品 API。
- `space-runtime` 部署在支持 Node、长连接、Agent Adapter、VM/client 和构建任务的环境。
- Synapse、Product DB、对象存储、Agent provider 和 Runtime provider 使用独立凭据与最小网络权限。
- Dev VM、build VM 和 serving replica 隔离；Live Release 可按并发扩缩容。
- Runtime session、内部任务签名和 Agent provider credential 使用不同 audience/key。

### 12.2 容量基线

- 10,000 DAU、1,000 峰值 Matrix 同步连接。
- 100 条 Matrix 消息/秒短时突发；Chat 容量不与 Agent 并发绑定。
- 初始最多 2 个不同 Space 并行 Agent write batch，配置范围 1–8。
- 同一 Space App 始终单写；默认批次窗口约 350ms，配置范围 0–2s。
- 每个 Release 初始 `minReplicas=0`，按 provider 能力设置上限。
- Template source、Project、Revision、Release 和日志具有用户/Space 配额和生命周期策略。

### 12.3 指标与告警

至少记录：

- Space/Matrix Room 创建、模板复制、补偿和 state 修复。
- Chat 消息延迟、失败和 Agent 不可用时的独立可用率。
- 市场目录、详情、收藏、模板应用和版本失败率。
- Agent queue depth、Agent/provider 分布、wait、batch、lease、turn 和失败码。
- Conversation/Revision 分类和自动修复次数。
- Space Dev 冷启动、编译、health 和失败率。
- Release build、activation、rollback/revoke 和 ready 时间。
- SDK action 量、延迟、拒绝、冲突和限流。
- 积分 reservation、settlement、refund 和 reconciliation。

告警覆盖 Space lease 过期、Dev/Release 失败率、无效 Live 指针、Matrix event 投影积压、Agent provider 故障、账务不一致和 artifact hash 校验失败。恢复演练必须证明 Chat、Space/Template、Project、Live、App State、队列和账务一致恢复。

## 13. 测试与发布验收

### 13.1 单元与合约

- `room_index` 历史行映射唯一 `spaceInstanceId`，不创建第二条实例记录或 Matrix Room。
- 一对一与多人参与者调用同一 `SpaceInstanceService/Repository/Server`，不存在人数分支的替代实现。
- 空白与模板两种 Space 创建模式保持 Matrix/Space/Project/outbox 幂等。
- 现有 Space 市场、收藏、详情和模板版本兼容。
- Agent Adapter 的通用事件、usage、取消、超时、恢复和 provider 切换。
- 同 Space 单写、跨 Space 并发、批次和 publish barrier。
- Conversation/Revision、Revision hash、ready/Published 指针和发布幂等。
- SDK snapshot、presence、state CAS、event、完整 Chat 操作、Mention、Agent target 和 theme schema。
- App 只能用平台返回的结构化 member/agent Mention；同一 `eventId` 最多创建一个 Agent Turn，普通消息不触发 Agent。
- Default Chat App 与定制 App 都通过同一 Chat Core contract suite，覆盖发送、接收、回复、编辑、删除、Reaction、媒体、已读、typing、Mention 和 `@agent`。
- bridge source/nonce/action/size/rate limit。
- ACL、积分预留/结算/退款和失败补偿。

### 13.2 集成

- 对同一历史 Matrix Room 分别从兼容 `/v1/rooms`、Space Kernel、App SDK 和 Matrix appservice 进入，全部解析为同一 SpaceInstanceServer、Project、queue 和 App State。
- 两个 Runtime replica 并发恢复同一实例时，只有 lease owner 执行 Turn；断开后新 owner 从 snapshot/queue 恢复。
- Better Auth + Matrix + Product DB 创建空白/模板 Space，均得到 ready App；Default Chat App 与模板 App 都能通过 SDK 使用完整 Chat Core。
- 普通人类消息不入 Agent 队列；显式 Agent 请求仅投影一次。
- Pi Adapter 与至少一个 fake Agent Adapter 通过同一合约测试，证明公共契约不绑定 Pi。
- 隔离 Runtime 验证 Candidate；成功实时切换 ready Revision，失败保留最后 ready Revision 和 Published Release。
- Template 应用创建独立 Revision，不修改市场版本或 Chat 历史。
- 两个浏览器通过 SDK 同步成员、presence、state 和瞬时事件。
- Runtime/Backend 重启与重复回调不重复扣费、回复或发布。

### 13.3 E2E 核心场景

正式实现以 [TEST-CATALOG #40](../../../tests/e2e/TEST-CATALOG.md) 为验收主目录，至少覆盖：

1. 空白 Space 与模板 Space 都能创建并立即聊天。
2. 现有私聊和新增多人 Space 都解析为唯一 SpaceInstance，使用同一 Instance Server/Project/SDK/queue。
3. Discover、分类、详情、收藏和模板创建入口保持工作。
4. Kernel Bar 是唯一固定宿主界面；其下所有像素来自 Space App，Default Chat UI 也能被模板或 Agent 完全改写。
5. Default Chat App 与至少一个完全不同布局的定制 App 均能通过同一 Chat Core 完成人类聊天、Mention 和 `@agent`；App 不能伪造 Kernel Bar 或平台身份。
6. 人类普通聊天不调用 Agent；带平台结构化 Agent Mention 的消息才按 Matrix `eventId` 幂等进入 Agent 队列。
7. 切换 Agent Adapter 不改变 Project、权限、计费和发布契约。
8. 空白 Space 应用模板、已有 App 再应用模板都可恢复。
9. Candidate 失败保留最后 ready Revision 和 Published Release；Chat Core 始终可用，Kernel Bar 可以恢复 Default Chat App。
10. 显式发布、SDK、iframe、ACL、积分、重启和迁移符合安全与幂等语义。

### 13.4 发布门槛

- 现有认证、联系人、邀请、Chat 和 Space 市场回归全绿。
- 新增 unit、contract、integration 和 TanStack E2E 全绿。
- 无 P0/P1 权限、凭据、计费、市场供应链、发布一致性或 sandbox 缺陷。
- 通过真实 Synapse、真实 Runtime provider、至少一个 Agent Adapter 和双 Chromium 走查。
- docs、packages、Web、Backend、Admin 和 Space Runtime 构建通过。
- 备份恢复、lease 恢复、Release 撤销和积分 reconciliation 有证据。

## 14. 实施阶段

### 阶段 0：设计校正与兼容护栏

- 将用户语义统一为 Space，Matrix Room 保持底层实现术语。
- 保留 `/v1/spaces`、Discover、收藏、模板选择、`spaceId/spaceVersionId` 和现有 Chat。
- 确定采用与 `chat-app-server` 同构的 Node/Hono、Instance Server、SSE、Turn scheduler、ProjectStore、agentOS Apps 和 SDK 技术链。
- 定义 `room_index` 原地升级的唯一 SpaceInstance、Template、Project、Agent Adapter 和 v1/v2 state 双读。

交付标准：不存在删除市场或降低聊天能力的迁移任务；旧客户端与旧 Space 继续工作。

### 阶段 1：Space Kernel 与 Project 基础

- 在现有 `room_index` 原地增加 `space_instance_id/project_id/default_agent_id`，历史行幂等回填，不创建平行实例表。
- 将 `RoomService/Repository` 迁移为统一 `SpaceInstanceService/Repository`，`/v1/rooms` 只保留同服务适配器。
- 在现有创建链路中补充空白/模板模式；一对一与多人 Space 走同一事务。
- 新增 Space App contracts、ACL、Project/Revision/Release/State schema。
- 建立 Matrix event projection、durable queue、lease、outbox 和 credits reservation。
- 保持现有 Chat、社交、资料、市场和 session 回归全绿。

交付标准：空白和模板 Space 都能创建，Chat Core 不依赖 App Project/Agent，历史 Space 可读。

### 阶段 2：Kernel Bar、Chat Core、Space App 与 SDK

- 新增 Node 22 + TypeScript + Hono 的 `apps/space-runtime`，实现 `SpaceInstanceRegistry/Server`、SSE、认证 command 和 lease 恢复。
- 接入 `@rivet-dev/agentos`、`@rivet-dev/agentos-apps`、`SpaceProjectStore` 与 `SpaceDevPreviewManager`。
- 实现 Space SDK members/chat/mentions/agents/presence/state/event/theme，完整 Chat 操作不能由 Project 代码重写。
- 只固定顶部 Kernel Bar；将其下全部界面迁入 Space App Project，Default Chat UI 也作为模板代码交付。
- 实现 Candidate 校验、ready Revision 实时切换、错误恢复和双浏览器实时链路。
- 支持空白 Space 应用市场模板并保留历史。

交付标准：Default Chat App 与完全不同布局的模板 App 都通过同一 Chat Core contract；成员始终进入可用 Space，App 故障可从 Kernel Bar 恢复最后 ready Revision。

### 阶段 3：Agent Adapter、持续更新与 ready Revision

- 建立 Agent Registry 与 provider-neutral Adapter；先接 Pi Adapter 和 fake Adapter。
- 实现结构化 Agent Mention、串行批次、Conversation/Revision 和受限项目执行目录。
- 实现 Candidate 验证、诊断修复、ready Revision 实时更新、积分和恢复。

交付标准：成员可选择 Agent 进行问答和 App 定制，替换 Agent 不改变平台契约。

### 阶段 4：不可变发布与治理

- 实现 publish barrier、不可变 Release、原子激活、恢复和撤销。
- 接入 Template/Agent/Release Admin 治理、审计、SBOM 和 provenance。
- 完成历史 Space 的 v1/v2 state 双读和 Project bootstrap。

交付标准：模板与 Agent 修改可安全发布，任何失败都保留 Chat 和旧 Live。

### 阶段 5：生产就绪与市场演进

- 完成压测、可观测性、备份恢复、安全审计和灰度。
- 完成从 Space ready Revision 发起的用户 Template 发布、审核、签名、更新和撤销；它与仓库官方 Template 使用同一协议、表和市场查询，分成策略单独评审。
- 只有在兼容消费者迁移完成后，才考虑新增清晰的 Template API 别名；不删除市场能力。

交付标准：核心回归与 #40 全绿，Space 市场、Chat、Agent 和 App 达到生产门槛。

## 15. 风险、确定决策与后续范围

### 15.1 主要风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Space/Template 语义混淆 | API 和 UI 概念冲突 | 明确实例与模板，兼容字段记录 lineage |
| 现有房间与多人 Space 双实例化 | 消息、成员、App State 和权限分裂 | `room_index` 原地升级、Matrix Room 唯一映射、单一 SpaceInstanceRepository/Server |
| 单机 `LocalRoomServer` 水平扩展 | 同一 Space 被多副本同时消费 | Space lease、sticky SSE、durable queue、snapshot 和接管测试 |
| 可定制 UI 侵蚀 Chat Core | 定制 App 无法正常聊天或错误调度 Agent | 版本化 SDK、结构化 Mention、Default/Custom App contract suite、Kernel 恢复 |
| 自然语言误触发修改 | 意外扣费或改 App | 结构化 Agent Mention、Conversation/Revision、Candidate 校验 |
| Agent provider 锁定 | 难以替换或多 Agent | Registry + Adapter + 标准事件/usage/恢复合约 |
| 多成员连续修改冲突 | 后请求覆盖前请求 | 同 Space 单写、顺序批次、澄清、Revision 历史 |
| 模板覆盖定制 | 丢失成员作品 | 模板先生成 Candidate，保留 lineage/ready/Published 恢复点 |
| Generated code 不可信 | 泄漏、伪造、资源耗尽 | 隔离 origin/VM、无 secret、SDK allowlist、配额 |
| 实时版本与发布版本混淆 | 把 Space 误认为试验环境，或误认为已经发布 | Kernel Bar 明示 ready/Published 双指针，Dev 只作内部通道名 |
| Matrix/队列/账务不一致 | 丢请求、重复扣费 | eventId、outbox、lease、reservation、reconciler |
| 市场供应链风险 | 恶意或失效模板 | 版本不可变、审核、签名、SBOM、撤销 |

### 15.2 已确定决策

- 产品实体和用户语义为 Space；Matrix Room 仅是底层聊天容器。
- 现有聊天房间与多人 Space 是同一个 SpaceInstance 模型；每个 Matrix Room 只能映射一个 `spaceInstanceId`、Instance Server 和 Project。
- 物理 `room_index` 原地升级为统一实例记录，不新建承载相同对象的 `space_instances` 表；`/v1/rooms` 只作为兼容 API。
- Space 不是 Workspace 或试验场；它始终运行最后一个 ready Revision，并在新 Revision ready 后实时更新。
- 每个 Space 保留不可修改的完整 Chat Core；Chat UI 是 Default Chat App 代码，可以由模板或 Agent 任意定制。
- Space 市场、发现、分类、详情、收藏、版本和模板创建继续存在。
- 官方和用户 Template 使用同一 `SpaceTemplate` / `SpaceTemplateVersion` / `SpaceTemplateArtifact` / `SpaceTemplateMarketEntry` 协议；官方身份只通过 Publisher verification 标记。每个官方 Template 在仓库只维护一份 `app/` 工作源码，用户从 Space App 的固定 ready Revision 发布；两者的 Version 都引用统一 Registry/Object Store 中按 hash 寻址的不可变 artifact。
- Space 可以空白创建，也可以选择模板创建；空白 Space 可以后续应用模板。
- Kernel Bar、Chat Core、Space App 是仅有的三个逻辑边界；只有顶部 Kernel Bar 是固定宿主 UI，创作和发布能力属于 Kernel。
- Kernel Bar 以下全部由 App Project 渲染；App 可以替换 Chat UI，但不能替换 Chat Core、Mention/Agent 调度、成员权威或 Matrix timeline。
- Agent 使用可插拔 Adapter；Pi 是首个候选示例，不是平台固定 Agent。
- 普通人类 Chat 不自动调用 Agent；显式 Agent 请求才进入权限与计费链路。
- Candidate 验证成功后实时更新当前 ready Revision；显式发布将固定 Revision 固化为不可变 Release。
- Matrix 继续作为成员与 Chat 权威；Product DB 管理市场、Space、Project、Agent、Release 和 App State。
- Space Runtime 明确采用 `chat-app-server` 同构的 Node/Hono + SpaceInstanceServer + SSE/command + 串行 Turn + ProjectStore + agentOS Apps Dev/Release + Space SDK 技术方案。
- Agent 仍通过通用 Adapter 接入，Pi 不因 Runtime 技术定案而成为固定 Agent。
- MVP 仍是 Web/PWA、熟人私聊/小群、无 E2EE、音视频和联邦。

### 15.3 后续独立设计

- 用户 Template 的审核队列、签名、排名、评论、举报、作者分成和组织 Publisher 治理；这些策略不得改变已经确定的统一协议。
- Agent 市场、用户选择模型、组织 Agent、多 Agent 协作和自带 provider key。
- 公共 Space、分享可见性和社区治理。
- 从已有 Space 创建模板、分叉 lineage 与隐私清理。
- 外部网络 capability、用户同意和 egress 审计。
- E2EE 下 Agent 与 App State 授权。
- 原生端 Runtime、音视频和大型多人状态。

### 15.4 当前仓库前提

当前活动实现位于 `apps/web-app`、`apps/backend`、`apps/admin-app`、`apps/space-runtime` 和 workspace packages；A1/A2 已有真实 Matrix、完整 Chat、Space 目录和产品状态证据。Space App contracts/SDK、通用 Agent Adapter、ready Revision/Release、固定 Kernel Bar 与全尺寸 App Surface 已形成首版纵向切片；Default Chat UI 和四个差异化模板均由 App Project 渲染，Host 只通过受信 bridge 提供 Chat Core。结构化 Agent Mention 已随人类消息写入 Matrix，Backend 会复读精确 event 完成 ACL、积分和幂等入队；新账号欢迎积分、Host Pi 真实回复和 token usage 结算已有单浏览器真实服务证据。五个官方 Template 已拆为独立、逐版本锁定的仓库项目并生成统一 Market entry；同一协议已验证 App 来源的用户 Template，但用户发布 API、审核队列和生产 Product DB/Object Store 尚未实现。完整双浏览器 Chat/Agent contract、rollback/恢复、生产存储、多副本 lease 和 Matrix Agent 回写仍在 Active 实施。任何实现说明必须引用 Active 文档和实际测试，不得把首版切片写成完整交付。
