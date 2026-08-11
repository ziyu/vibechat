# 聊天宿主基础实现

> 生命周期：长期稳定
> 文档类型：参考资料
> 状态：生效
> 更新日期：2026-08-11
> 维护范围：TanStack Start Web 应用、`libs/chat` 与聊天宿主 E2E
> 不包含：Matrix、Better Auth、产品后端、iframe Runtime 与生产数据

## 目标

这轮实现把稳定设计中的产品信息架构变成可以直接运行和验收的前端宿主，同时保持后端选型暂缓这一既有决策。它用于验证响应式布局、页面关系、交互契约和未来服务接入点，不把浏览器 fixture 数据描述为正式消息服务。

目标范围与长期约束以 [VibeChat MVP 版本产品与技术设计](../designs/vibechat-mvp-product-and-technical-design.md) 为准。

## 已实现能力

- `/messages`：统一会话列表、置顶排序、未读筛选、搜索、静音和标记已读。
- `/rooms/:roomId`：fixture 氛围画布、宿主控制岛、消息本地回显、发送状态、回复、回应、附件降级文本和输入区。
- 新建聊天：先选择联系人，再选择氛围空间，最后确认参与人和能力权限。
- `/contacts`：联系人搜索、好友请求接受/拒绝、共同房间和从联系人发起聊天。
- `/discover` 与 `/discover/spaces/:spaceId`：氛围搜索、分类、详情、能力/联网摘要、收藏和使用该氛围发起聊天。
- `/me`：本地资料概览、通知、主题、语言和预览数据重置。
- 桌面三栏/双栏、移动单列与房间内隐藏底部导航。
- 中英文界面文案和 `localStorage` 本地持久化。

## 代码边界

### 共享领域层

`libs/chat/*` 定义前端当前使用的最小领域契约：

- `ChatRoom`、`ChatMessage`、`ChatPerson` 和 `AtmosphereSpace`。
- 会话排序、搜索、建房、消息追加和时间格式化。
- 确定性的演示数据，保证 SSR 与客户端 hydration 一致。

这些函数不依赖 React 或 TanStack Router。接入真实服务时，可以继续作为视图模型和纯规则层使用。

### 应用状态层

`apps/web-app/src/features/chat/chat-store.tsx` 负责：

- 将 fixture 初始化为可交互状态。
- 把用户操作持久化到浏览器。
- 模拟发送中的本地回显，并在短延迟后切换到已发送。
- 对页面暴露稳定 action，而不是让页面直接改写数组。

`data-ready="true"` 表示客户端已经完成 hydration 和本地状态恢复，E2E 必须等待该信号后再操作。

### 页面与宿主边界

`apps/web-app/src/features/chat/*-page.tsx` 只组合页面和调用 action。宿主一级导航、控制岛、权限摘要、恢复入口与预览状态始终位于氛围画布边界之外。

当前房间画布是官方 fixture React 实现，不是第三方 iframe。进入 Runtime 阶段后，画布区域将替换为经过 manifest、签名、hash、sandbox 和 capability 握手的 iframe；会话列表、路由、控制岛和恢复视图不需要因此重写。

## 真实服务接入顺序

1. 用产品 session bootstrap 替换 fixture 当前用户。
2. 用 Matrix adapter 的 room/timeline 投影替换 `ChatDemoState` 中的 rooms 和 messages。
3. 将 `sendMessage` 映射到带 transaction ID 的 Matrix local echo；保持现有 `sending/sent/failed` 视图契约。
4. 把联系人、好友请求、氛围目录和收藏迁移到产品 API 查询缓存。
5. 用受控 iframe Runtime 替换 fixture 画布，并通过 capability API 投影相同的消息和成员模型。
6. 本地存储只保留草稿、UI 偏好和 Matrix SDK 明确允许的缓存，不再作为权威数据源。

## 验收

验收场景记录在 [`tests/e2e/TEST-CATALOG.md`](../../../tests/e2e/TEST-CATALOG.md) 的“聊天宿主基础功能”，自动化实现位于 [`tests/e2e/specs/chat-foundation.spec.ts`](../../../tests/e2e/specs/chat-foundation.spec.ts)。
