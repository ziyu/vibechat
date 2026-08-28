# Space Kernel Lamplit 视觉刷新实施记录

> 生命周期：开发中
> 文档类型：计划
> 状态：实现完成，回归有未通过项
> 更新日期：2026-08-28
> 维护范围：`/spaces/:spaceId` 可信 Kernel Bar 的信息层级、Lamplit Light/Dark、桌面与移动端布局、可访问性和视觉回归
> 对应稳定设计：[VibeChat MVP 产品与技术设计](../../stable/designs/vibechat-mvp-product-and-technical-design.md)
> 相关实施记录：[Space App 设计演进与实施记录](./space-app-design-transition.md)、[VibeChat 宿主设计系统与主题工作流实施方案](./host-design-system-and-theme-workflow.md)

## 1. 目的与授权边界

非 Space 宿主已经建立 Lamplit 设计语言与语义 Token，但运行中 Space 顶部 Kernel 仍是旧的 58px 黑色工具条：标题、状态与操作目标过小，Light 下仍保持暗色，390px 移动端把全部内容压入一行。用户于 2026-08-28 明确要求把 Kernel Header 同步到新的设计风格，因此本计划作为上一批冻结边界之外的独立实施记录。

本轮只更新可信 Kernel 的 DOM 分组、视觉、响应式、可访问性和回归断言。下列运行语义保持冻结：

- Space Runtime snapshot、ready Revision、build、publish、restore 与 reload 行为；
- Matrix membership、连接权威、权限、计费和 Agent 调度；
- iframe URL、sandbox、Bridge、SDK 和用户 Space App 的 HTML/CSS；
- Kernel 以下仍只有单一 App Surface，宿主不得为 iframe 添加滤镜、透明度、混合模式、遮罩或颜色覆盖。

## 2. 已确认设计

### 2.1 信息层级

Kernel 由三个职责明确的区域组成：

1. **Space 身份**：返回、Space glyph、名称和连接状态。
2. **运行上下文**：成员数量、Agent 与当前 ready/build Revision。
3. **可信操作**：重新加载、发布和 Space 菜单；恢复 Default Chat 继续位于菜单与确认 Dialog 中。

桌面不把这些内容做成编辑器工具栏。Header 使用一块安静、连续的宿主表面，通过细边界和环境阴影与 App Surface 建立可信边界；Space accent 只用于 glyph 或运行状态，不铺满 Header。

### 2.2 Light 与 Dark

- Light 使用明亮暖白矿物表面、清楚但克制的边界和低强度环境阴影，解决旧 Header 在 Light 下仍是黑条的问题。
- Dark 使用独立的炭灰层级与低眩光文字，不是 Light 的机械反相。
- 两种模式均消费 `--vc-color-*`、`--vc-shadow-*` 和共享状态 Token；组件不读取 `lamplit` 名称。
- iframe 继续使用 Space 自己的背景和设计，Kernel Token 不向 App 文档注入。

### 2.3 响应式与可访问性

- 桌面 Kernel 约 68px 高，身份在左、上下文与可信操作在右。
- 719px 及以下重组为两层：第一层显示 Space 身份与菜单，第二层显示成员/运行状态、重新加载和发布；不继续压缩成单行。
- 返回、重新加载、发布和菜单均至少 44×44px；可见产品文字不小于 11px。
- 390×844 不产生横向溢出；长 Space 名、Agent ID 和 Revision 必须截断或按优先级收敛，不能挤出关键操作。
- 保留键盘焦点、disabled、hover、active 与 reduced-motion 状态。

## 3. 实施清单

- [x] 在 `SpacePage` 中把身份、上下文和菜单重组为稳定区域，不修改数据来源或事件处理。
- [x] 在 `SpaceKernelControls` 中把运行状态与操作分组，不修改 `publish()` 或 reload 回调。
- [x] 使用宿主语义 Token 实现 Lamplit Light/Dark，并补齐桌面与移动两层布局。
- [x] 在 `DESIGN.md` 增加 Kernel recipe，明确主题只止于可信边界。
- [x] 更新 #40 场景 3，覆盖 DOM 边界、触控尺寸、Light/Dark、响应式与 iframe 隔离。
- [ ] 完成全部回归：Kernel 定向 typecheck/build、真实 Chromium E2E、桌面/390px Light/Dark 走查已通过；既有 Matrix Chat 长流程在 iframe 内打开 Chat drawer 时稳定超时，尚未进入后续 restore 验证。

## 4. 完成条件

只有同时满足以下条件，本文状态才能改为“已验证”：

- Host DOM 仍只有可信 Kernel 与单一 iframe App Surface，没有宿主 Chat timeline、composer 或并列面板。
- Kernel 在 Light/Dark 下使用对应 Lamplit 语义表面，且不读取大面积 Space canvas 色作为 Header 背景。
- 桌面和 390px 都无横向溢出，关键交互目标至少 44px。
- 返回、reload、publish、菜单和 restore 的既有行为保持通过。
- iframe 的 URL、sandbox 与计算样式没有被宿主主题改写。
- 相关 E2E、构建、文档检查和 GitNexus 变更检测记录真实结果。

## 5. 验证记录

2026-08-28 当前证据：

- `apps/web-app` TypeScript：使用仓库要求的 Node 24 直接执行 `tsc --noEmit -p apps/web-app/tsconfig.json`，通过。
- `apps/web-app` Vite production build：通过。
- 文档链接检查：通过；Application boundaries：344 个活动源码文件检查通过。
- `host-lamplit-ui.spec.ts`：真实 Chromium 2/2 通过。定向断言覆盖桌面与 390×844、Light/Dark、移动两层布局、四个 44px 关键目标、Host DOM 单一 Kernel + App Stage、iframe 单例、sandbox、URL、filter、opacity 与 blend mode 隔离。
- 真实浏览器走查：390×844 的 Light 与 Dark 均完成截图检查；Light 为明亮暖白矿物表面，Dark 为炭灰表面，Space App 原有紫色画布未被宿主改写。Matrix 长流程失败视频同时提供桌面 Light Kernel 与独立 Space App 的可见证据。
- Impeccable detector 已按规定执行一次。聚合 `chat.css` 报告包含大量本轮范围外的历史字体、颜色、半径和旧 Chat 选择器提示；本轮触及的 Kernel 已把 glyph 半径收敛到设计刻度、可见 Revision 提升到 11px，并在 `DESIGN.md` 登记 14px compact-title 角色。
- `chat-matrix-room.spec.ts`：未认证契约 1/1 通过；消息与恢复长流程在 iframe 内 Night Radio App 的 `Open Space Chat` 点击后 `#vcc-root[data-open]` 未切换，90 秒超时；单独重跑得到相同结果。失败发生于用户 Space App 文档内，Kernel 已正常渲染，但长流程未到达消息、reload 或 restore 后半段，因此不能声称完整 Matrix 回归通过，也不在本轮越界修改 Space App 来掩盖。

剩余完成条件：单独修复或确认 Space App Chat drawer 回归后，重跑 `chat-matrix-room.spec.ts` 并补录 restore 全链路结果；在此之前本文保持 Active。
