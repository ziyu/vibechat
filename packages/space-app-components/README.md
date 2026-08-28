# `@vibechat/space-app-components`

Framework-neutral UI building blocks for code running inside a VibeChat Space App iframe.

The package sits above `@vibechat/space-app-sdk` and below Space Templates. It provides injected SDK context, headless controllers, `vc-space-*` Web Components, SSR-safe render helpers, an offline component catalog, and immutable bundle metadata. It does not own identity, Matrix messages, permissions, Agent dispatch, billing, publishing or recovery.

## Runtime boundary

- `.` and `/core`: browser-safe APIs with no top-level browser-global access.
- `/foundation`: Avatar、StatusDot、IconButton 与基础样式。
- `/user`: member view model、UserAvatar、UserName 与 UserInfoCard。
- `/agent`: provider-neutral Agent identity/activity view model、只读 controller、AgentAvatar、Badge、Status、QueueStatus、Card 与 Activity。
- `/chat`: Matrix timeline view、只读/可写 controller、Composer/Mention/Attachment/Reaction/Actions/Error/Timeline elements。
- `/chat/inline`: 仅供返回自包含 HTML 的 `agentos-app-v1` Project 使用的预构建 Chat 浏览器模块；普通浏览器构建使用 `/chat`。
- `/recipes`: `DefaultChatRecipe` / `ChatDrawerRecipe` / `AgentActivityPanelRecipe` 的装配与 lifecycle；只连接注入 context、标准 elements 和 Template copy，不拥有主题、launcher markup 或场景状态。
- `/recipes/inline`: 供自包含 HTML Project 使用的预构建 Recipe 浏览器模块；与 `/recipes` 共享同一公开 API、package version 和 artifact integrity。
- `/register` 与 `/register/foundation|user|agent|chat`: 显式的 Custom Element 自动注册入口，也是 package 中仅有的 side-effect exports。
- `/styles`: 可由 Template 覆盖的 semantic component token 与示例主题。
- `/manifest`: bundle manifest types and validation.
- `/node`: 仅供 VibeChat workspace/Runtime 使用的 Node package 构建、hash 与本地 Registry helper；不进入发布给 Space 的 package。
- `/testing`: Node-side deterministic catalog/harness generation.

## Space 中的稳定依赖方式

Space 源码使用普通、语义化的 package import，不读取仓库路径，也不直接 vendor 组件源码。具备浏览器 bundler 的 App 直接使用领域入口：

```ts
import {
  createSpaceChatController,
  defineSpaceChatElements,
} from "@vibechat/space-app-components/chat"
```

当前由 fetch handler 返回自包含 HTML 的官方 `agentos-app-v1` Template 使用专用 inline delivery entry；它仍然是同一个发布包的语义化 subpath，不是 Registry artifact 路径：

```ts
import {
  spaceChatInlineModule,
} from "@vibechat/space-app-components/chat/inline"
```

使用完整装配 recipe 的同类 Project 改用 `/recipes/inline`；普通 bundler 仍从 `/recipes` tree-shake：

```ts
import {
  spaceRecipesInlineModule,
} from "@vibechat/space-app-components/recipes/inline"
```

同时在 `package.json` 使用精确版本，并在 `space-app-dependencies.json` 固定 managed package integrity。Runtime 通过 `@vibechat/space-app-dependencies` 和注入的 Registry 校验 name/version/integrity，把已发布 package 复制到隔离的 prepared build，且只在该 build 的 `package.json` 中改写为 revision-local `file:` 依赖。可编辑 Project 源码始终保持普通 package specifier；生产浏览器、Dev Preview 和 Release 都不会访问 npm 或 CDN。

## 构建与发布

仓库只提交 `src/`、构建脚本、package metadata 和当前 `managed-release.json` integrity lock；`dist/`、package tarball 和逐版本编译产物全部 gitignored。不存在 `releases/<version>/package` 源码目录。`managed-release.json` 是仓库端发布锁，不是发布 package 内的公共文件。

```bash
pnpm --filter @vibechat/space-app-components release:prepare
pnpm --filter @vibechat/space-app-components check:bundle
pnpm --filter @vibechat/space-app-components registry:publish 0.9.3
# Optional npm-compatible mirror only:
pnpm --filter @vibechat/space-app-components release:pack
```

`release:prepare` 生成 `dist/package` 的标准 ESM package 并签锁当前 metadata。`registry:publish` 从该 package 生成版本化、规范化 JSON envelope，经专用 `SPACE_APP_PACKAGE_PUBLISHING_TOKEN` 上传 VibeChat managed Registry；Backend 把对象写入私有内容寻址 Object Store，并在 Product DB 登记不可变的 `name + version + integrity + projectFormats + objectKey/objectHash`。重复发布相同内容幂等验证，任何同版本内容漂移都返回冲突且不会覆盖记录。`SPACE_APP_PACKAGE_REGISTRY_ORIGIN` 指向 Backend；Space Runtime 不持有发布 token。

`release:pack` 只生成可选 npm-compatible mirror tarball。公共 npm 不是线上 Runtime 的必要条件，但每个供 Space 使用的版本都必须经过 managed publish；Registry 中的规范化 package object 才是 Runtime 的主分发对象。

本地开发 Registry 使用 gitignored `dist/managed-registry/<version>/package` 保存多个已验证版本，Runtime 始终按 Project lock 中的 exact version 与 integrity 解析；构建当前版本不会覆盖旧版本。历史版本没有本地缓存时，可以从已经持久化且通过校验的 prepared Project 恢复：

```bash
pnpm --filter @vibechat/space-app-components \
  registry:import-prepared -- /absolute/path/to/prepared-project-object.json
```

导入脚本只接受 `vibechat.prepared-space-app-project/v1`，重新计算 package artifact integrity，并在与 Project lock 一致后写入对应版本缓存。该缓存仅用于本地开发和冷启动恢复，不提交 Git，也不替代生产 managed Registry/Object Store publish。

Space Projects must inject the existing SDK client:

```ts
import { space } from "/v1/space-app-sdk"
import {
  createSpaceComponentContext,
  createSpaceSnapshotController,
} from "@vibechat/space-app-components/core"

await space.ready
const context = createSpaceComponentContext({ sdk: space })
const controller = createSpaceSnapshotController(context)

window.addEventListener("pagehide", () => {
  controller.dispose()
  context.dispose()
}, { once: true })
```

Identity element 通过安全 attribute 支持 SSR/declarative document，通过 typed property 接收完整对象：

```ts
import { defineSpaceElements } from "@vibechat/space-app-components"
import {
  createSpaceUserIdentityView,
  type SpaceUserInfoCardElement,
} from "@vibechat/space-app-components/user"

defineSpaceElements()

const card = document.querySelector<SpaceUserInfoCardElement>(
  "vc-space-user-info-card",
)
const member = space.members[0]

if (card && member) {
  card.user = createSpaceUserIdentityView(member)
}
```

Chat 只接收注入的 SDK。完整 controller 分别订阅 message、typing 与身份相关事件，typing/presence-only 更新不会重建 messages view；所有命令仍委托给同一个 `SpaceAppClient`：

```ts
import {
  createSpaceChatController,
  spaceChatEventNames,
  type SpaceChatComposerElement,
  type SpaceChatTimelineElement,
  type SpaceMentionMenuElement,
} from "@vibechat/space-app-components/chat"
import type { SpaceMentionTarget } from "@vibechat/space-app-sdk"

const chat = createSpaceChatController(context)
await chat.ready

const timeline = document.querySelector<SpaceChatTimelineElement>(
  "vc-space-chat-timeline",
)
const composer = document.querySelector<SpaceChatComposerElement>(
  "vc-space-chat-composer",
)
const mentions = document.querySelector<SpaceMentionMenuElement>(
  "vc-space-mention-menu",
)

function renderChat() {
  const state = chat.getSnapshot()
  if (timeline) {
    timeline.state = state.ready ? "ready" : "loading"
    timeline.messages = state.messages
    timeline.typingUsers = state.typingUsers
    timeline.interactive = true
    timeline.interactionDisabled = state.pending !== null
    timeline.reactionChoices = ["♥", "✨", "🌙"]
  }
  if (composer) {
    composer.draft = state.draft
    composer.pending = state.pending !== null
    composer.sendDisabled = !space.chat.permissions.send
    composer.attachmentDisabled = !space.chat.permissions.attach
    composer.context = state.context && {
      kind: state.context.kind,
      messageId: state.context.message.id,
      author: state.context.message.author.name,
      text: state.context.message.text,
    }
  }
  if (mentions) mentions.targets = state.mentionTargets
}

const unsubscribe = chat.subscribe(renderChat)
renderChat()

composer?.addEventListener(spaceChatEventNames.submit, (event) => {
  const { text, mentionIds } = (event as CustomEvent<{
    text: string
    mentionIds: readonly string[]
  }>).detail
  chat.setDraft(text, mentionIds)
  void chat.send()
})
composer?.addEventListener(spaceChatEventNames.typing, (event) => {
  void chat.setTyping((event as CustomEvent<{ isTyping: boolean }>).detail.isTyping)
})
composer?.addEventListener(spaceChatEventNames.mentionQuery, (event) => {
  const query = (event as CustomEvent<{ query: string | null }>).detail.query
  if (query !== null) chat.searchMentions(query)
})
mentions?.addEventListener(spaceChatEventNames.mentionSelect, (event) => {
  const target = (event as CustomEvent<{ target: SpaceMentionTarget }>).detail.target
  chat.selectMention(target)
  composer?.insertMention(target)
})

window.addEventListener("pagehide", () => {
  unsubscribe()
  chat.dispose()
  context.dispose()
}, { once: true })
```

Composer 的 Enter/Shift+Enter/IME、附件 input 和结构化 Mention 均由组件统一处理；Template adapter 只连接 typed event 与 controller。Host 通过 `snapshot.chat.permissions` 明确下发 Chat 能力，message view 再结合 ownership/status 生成 `actions`；Timeline 在 `interactive` 模式内正式组合 `MessageActions` 和 `ReactionBar`，Template 不读取 Shadow DOM，也不自行猜测 ACL。Agent 请求只能随 `chat.send({ mentionIds })` 进入 Matrix，组件库不提供 `agent.invoke()`。

Recipe 在相同边界上进一步收敛重复装配。Template 仍显式创建 context、解析标准元素并提供自身 copy；全屏和抽屉只选择不同 mount 函数：

```ts
import { createSpaceComponentContext } from "@vibechat/space-app-components/core"
import {
  mountChatDrawerRecipe,
  resolveSpaceChatRecipeElements,
} from "@vibechat/space-app-components/recipes"

const context = createSpaceComponentContext({ sdk: space })
const recipe = mountChatDrawerRecipe({
  context,
  elements: resolveSpaceChatRecipeElements(document, "My Space Chat"),
  copy: () => getChatCopy(space.locale),
})

await recipe.ready
window.addEventListener("pagehide", () => context.dispose(), { once: true })
```

Recipe 统一 controller snapshot、typed events、增量 render、unread/read receipt 和幂等 dispose；主题、launcher DOM、场景 App State、文案来源与页面布局仍由 Template 维护。

Agent activity 使用同一个注入 SDK 的只读 snapshot，不提供绕过结构化 Chat Mention 的 Agent 调用入口。view model 只保留有限的 `stage`、queue count 和公开 activity label/detail，忽略 provider `input/output/arguments/payload`：

```ts
import {
  mountAgentActivityPanelRecipe,
  resolveSpaceAgentActivityPanelElement,
} from "@vibechat/space-app-components/recipes"

const activity = mountAgentActivityPanelRecipe({
  context,
  element: resolveSpaceAgentActivityPanelElement(document),
  maxActivities: 5,
})

await activity.ready
window.addEventListener("pagehide", () => activity.dispose(), { once: true })
```

Panel Recipe 默认只在 Agent 正在执行或队列中存在请求时显示，idle 时会给标准 element 设置 `hidden` 并退出辅助技术树；真实 activity 到达后自动恢复。需要常驻身份/状态面板的 Space 可以显式传入 `showWhenIdle: true`，无需在 Template 里复制可见性状态机。

对应 declarative markup 只需要标准元素；完整活动数组通过 typed `activity` property 注入，不序列化到 attribute：

```html
<vc-space-agent-activity density="compact"></vc-space-agent-activity>
```

`0.5.0` 保留 `0.4.1` 的 controller/element API，并建立 publishable ESM package、语义化 `/foundation|user|agent|chat` subpath、显式 `/register/*` side-effect entry、`/chat/inline` 自包含 HTML adapter 与 managed Registry provider。该版本把 Space 的正式消费方式从 Template 内相对 vendor 路径切换为普通 package specifier；组件交互语义、CSS token、Custom Element、typed event 和稳定 `data-testid` 不变。

`0.6.0` 增加 Host 显式 Chat permissions、message action availability、Composer 的 `sendDisabled` / `attachmentDisabled`、Timeline 的 `interactive` / `interactionDisabled` / `reactionChoices` 公共 property、`chat-message-entry` test id 与嵌套 action/reaction `::part`。`vc-space-chat-message.showReactions`（对应 `hide-reactions` attribute）允许交互 Timeline 隐藏重复的只读 Reaction；`markRead()` 是去重且不占全局 command pending 的非阻塞命令。以上均为新增 API；旧的只读 Timeline 默认行为保持不变。

`0.7.0` 收敛交互 Timeline 的消息操作密度：已有 Reaction 只由一套可交互 `ReactionBar` 呈现，候选 Reaction 与 reply/edit/delete/retry 进入 `MessageActions.compact` 的渐进式操作面；独立使用 `vc-space-message-actions` 时仍保持原有 inline 默认。compact 操作面使用原生 button、焦点循环、Escape/外部点击关闭、危险删除二次确认、桌面浮层和窄屏 action sheet，并通过 `reactionChoices` 与既有 bubbling/composed typed events 保持 controller 解耦。Timeline 还通过 `getSpaceChatMessageGroupPositions()` 按相邻作者和五分钟窗口生成 `single/first/middle/last`，压缩重复 identity/time/delivery，组尾保留非本人头像；交互 Timeline 始终关闭 Message 内的只读 Reaction，避免两套 UI 重复。

`0.7.4` 将 compact MessageActions 菜单提升到原生 Popover top layer，避免 Space Template 的 `transform`、`filter`、`backdrop-filter` 或 `overflow` 创建 containing block 后裁切、错位或触发渲染器异常。支持 Popover API 的浏览器只使用原生 light dismiss、`toggle` 与 `::backdrop`；不支持时才安装 document pointer fallback，并继续使用 viewport fixed 菜单和显式 backdrop。两条路径都保留 Escape、外部点击、关闭后焦点恢复、窄屏全宽 action sheet 与二次删除确认；指针关闭会在点击默认动作完成后的下一帧恢复 trigger 焦点，因此 Template 无需为了菜单修改自身布局或视觉效果。

`0.8.1` 新增 side-effect-free `/recipes` 与 `/recipes/inline`，公开 `mountDefaultChatRecipe`、`mountChatDrawerRecipe` 和 `resolveSpaceChatRecipeElements`。Recipe 只把五个官方 Template 已验证的 Chat 装配与 lifecycle 收敛到 package；既有 `/chat`、`/chat/inline`、Custom Element、typed event、token、part 和默认交互保持兼容。App 必须显式升级 exact version 并生成新 Revision，既有 Template/Space/Release 不自动切换。

`0.8.2` 增加 managed Registry 发布脚本和对应发行说明：规范化 JSON package object 是 Runtime 主分发对象，npm tarball 只作为可选 mirror。浏览器 bundle、公开 export、Custom Element、Recipe 与交互行为均未改变；Default/Focus 继续固定 `0.8.1`，不会因发布工具 patch 自动升级。

`0.9.0` 以向后兼容 minor 增加 provider-neutral `createSpaceAgentActivityView`、`createSpaceAgentController`、`vc-space-agent-queue-status`、`vc-space-agent-activity` 和 `mountAgentActivityPanelRecipe`。Activity 使用 polite live region、文本状态、forced-colors/reduced-motion fallback，并限制最多 12 条公开 activity；provider payload、Agent 调用、模型、积分和 Kernel 操作不进入组件 API。既有 Template 和 Space 仍固定原 exact version，不会自动升级。

`0.9.1` 为 Chat Recipe 增加迁移兼容桥接：`SpaceChatRecipeElements.build/buildTitle/buildStage` 保留但标记 deprecated；`resolveSpaceChatRecipeElements()` 在三个旧 `#vcc-build*` 节点全部不存在时使用脱离文档、不可见的占位，允许 `AgentActivityPanelRecipe` 成为唯一可见 Agent 状态投影。只删除部分旧节点仍会 fail closed，已有固定 `0.8.1`/`0.9.0` 的 Template、Revision 与 Release 不会自动升级。

主题只能通过 `--vc-space-*` semantic token、公开 property/attribute、slot 与 `::part` 扩展。交互 Timeline 对外提供 `controls`、`message-actions`、`message-action-more|menu|menu-title|menu-close|reply|edit|delete|retry`、`message-reaction-choices|choice`、`reaction-bar` 和 `reaction` parts；消费方不得查询或修改组件 Shadow DOM。组件不读取全局 `space`，Agent identity 也不会触发 Agent、指定 provider/model 或伪造 Kernel 操作。Chat timeline 只投影 `snapshot.chat.messages`，不会把 Agent build/progress 或 `snapshot.agent.messages` 合并成 Matrix 消息。

Browser bundles are built without network imports. 聚合、Foundation、User、Agent 与 Chat bundle 分别接受 gzip 预算检查；发布 package 自身保留未合并 ESM module boundary 和 `sideEffects` metadata，使普通 `/chat` 等领域入口可以继续由消费方 tree-shake。`dist/manifest.json` 将浏览器 bundle 绑定到同一个 package version、source/bundle hash、SDK range、Project format 与 CSS token version；`managed-release.json` 再把这些字段绑定到发布 package integrity，但不保存或引用 Git 内版本化编译目录。

See the [development design](../../docs/development/space-app-component-library-design.md) and [Active implementation record](../../docs/development/active/space-app-component-library-implementation.md).
