# E2E 测试流程目录

本文档记录当前产品 E2E 与历史验收记录。`specs/` 是默认执行的 VibeChat 活动产品回归；AI、支付、Affiliate 与 Admin 的有效场景已经重写进活动套件，旧脚手架测试不再保留为可执行源码。

> 编写规范和架构约定请查看 [`AGENTS.md`](./AGENTS.md)。

---

## 目录

### 已实现

- [1. 公共页面冒烟测试](#1-公共页面冒烟测试)
- [2. 认证流程测试](#2-认证流程测试)
- [3. 权限控制测试](#3-权限控制测试)
- [4. 仪表盘测试](#4-仪表盘测试)
- [5. 定价页测试](#5-定价页测试)
- [6. AI 功能页测试](#6-ai-功能页测试)
- [7. Stripe 支付流程测试](#7-stripe-支付流程测试)
- [8. 个人资料更新测试](#8-个人资料更新测试)
- [9. 修改密码测试](#9-修改密码测试)
- [10. 语言切换测试](#10-语言切换测试)
- [11. 上传页测试](#11-上传页测试)
- [12. 管理员面板测试](#12-管理员面板测试)
- [13. AI 对话（真实交互）](#13-ai-对话真实交互)
- [15. AI 图片生成（真实生成）](#15-ai-图片生成真实生成)
- [17. Creem 支付流程测试](#17-creem-支付流程测试)
- [18. PayPal 支付流程测试](#18-paypal-支付流程测试)
- [16. 管理员子页面筛选功能测试](#16-管理员子页面筛选功能测试)

- [21. 推荐返利系统测试](#21-推荐返利系统测试)
- [22. 管理员返利管理测试](#22-管理员返利管理测试)
- [23. 推荐佣金支付全流程测试](#23-推荐佣金支付全流程测试)
- [24. 管理员动态定价管理测试](#24-管理员动态定价管理测试)
- [25. 聊天宿主基础功能](#25-聊天宿主基础功能)
- [26. Email OTP 与产品 Session Bootstrap](#26-email-otp-与产品-session-bootstrap)
- [27. Matrix Identity 生命周期](#27-matrix-identity-生命周期)
- [28. Synapse Appservice Adapter](#28-synapse-appservice-adapter)
- [29. Session 撤销与 Matrix Device 回收](#29-session-撤销与-matrix-device-回收)
- [30. 真实 Matrix 房间与消息 Timeline](#30-真实-matrix-房间与消息-timeline)
- [31. 好友关系与双用户 Matrix 邀请](#31-好友关系与双用户-matrix-邀请)
- [32. 浏览器会话与本地 Matrix 数据管理](#32-浏览器会话与本地-matrix-数据管理)
- [33. Matrix 完整消息操作](#33-matrix-完整消息操作)
- [34. 首次资料设置与联系人备注](#34-首次资料设置与联系人备注)
- [35. 登录后产品状态真实化](#35-登录后产品状态真实化)
- [36. Apps 拆分与同源 Backend 网关](#36-apps-拆分与同源-backend-网关)
- [39. Legacy 产品能力完整迁移](#39-legacy-产品能力完整迁移)

### 待实现 (Backlog)
- [19. 支付宝支付流程测试](#19-支付宝支付流程测试)
- [20. 博客功能测试](#20-博客功能测试)

### 追踪

- [Backlog 优先级汇总](#backlog-优先级汇总)
- [测试结果追踪](#测试结果追踪)

---

## 1. 公共页面冒烟测试

**文件：** `specs/public-pages.spec.ts` ｜ **优先级：** P0 ｜ **无需登录**

最基础的健全性检查，验证公共页面能正常打开、不报错。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 首页加载 | 打开 `/` → 验证页面标题不含 error/500/404 → 验证精简 Header、单一品牌介绍区和 Footer 可见 → 验证首页不再渲染功能矩阵、统计、评价或购买 CTA |
| 2 | 登录页加载 | 打开 `/signin` → 验证默认 Email OTP 表单 → 切换“Use password instead” → 验证密码输入框和提交按钮可见 |
| 3 | 注册页加载 | 打开 `/signup` → 验证姓名输入框（`#name`）、邮箱输入框、密码输入框、提交按钮均可见 |
| 4 | 忘记密码页加载 | 打开 `/forgot-password` → 验证邮箱输入框可见 → 验证表单内按钮可见 |
| 5 | 定价页加载 | 打开 `/pricing` → 验证标题不含错误 → 验证至少有一个含 ¥ 或 $ 价格的元素可见 |

---

## 2. 认证流程测试

**文件：** `specs/auth-flow.spec.ts` ｜ **优先级：** P0

完整的 注册 → 登录 → 登出 → 重定向 生命周期测试。

### 注册组

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | UI 表单注册 | 打开注册页 → 填写姓名/邮箱/密码 → 点击提交 → 等待 URL 离开 `/signup`（即注册成功后自动跳转） |
| 2 | API 注册 | 通过 `POST /api/auth/sign-up/email` 直接创建用户 → 验证返回 200 → 验证响应体包含 `user.email` |

### 登录 / 登出 / 重定向组

> 这组测试共用一个用户账号（在 `beforeAll` 中通过 API 注册一次），避免频繁注册触发限流。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 3 | UI 表单登录 | 打开登录页 → 填写邮箱/密码 → 点击提交 → 等待 URL 离开 `/signin` |
| 4 | API 登录 | 通过 `POST /api/auth/sign-in/email` 登录 → 验证返回 200 |
| 5 | 登出后无法访问产品 | 先 API 登录 → 访问 `/spaces` 确认可进入 onboarding 或产品 → 调用 API 登出 → 再次访问 `/spaces` → 验证被重定向到 `/signin` |
| 6 | 已登录用户访问 /signin 重定向到 /spaces | API 登录 → 访问 `/signin` → 验证被自动重定向到 `/spaces` |
| 7 | 已登录用户访问 /signup 重定向到 /spaces | API 登录 → 访问 `/signup` → 验证被自动重定向到 `/spaces` |

---

## 3. 权限控制测试

**文件：** `specs/access-control.spec.ts` ｜ **优先级：** P0

验证保护页面的访问控制：未登录 → 重定向，无权限 → 403。

### 未认证访问组

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | /dashboard 重定向 | 未登录访问 `/dashboard` → 验证 URL 包含 `/signin` |
| 2 | /upload 重定向 | 未登录访问 `/upload` → 验证 URL 包含 `/signin` |
| 3 | /admin 重定向 | 未登录访问 `/admin` → 验证 URL 包含 `/signin` |
| 4 | /premium-features 重定向 | 未登录访问 `/premium-features` → 验证 URL 包含 `/signin` |

### 已认证非管理员访问组

> 共用一个普通用户账号（`beforeAll` 注册）。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 5 | 普通用户访问 /admin 返回 403 | API 登录普通用户 → 访问 `/admin` → 验证返回 HTTP 403 或重定向到 signin |
| 6 | 普通用户可以访问 /dashboard | API 登录普通用户 → 访问 `/dashboard` → 验证停留在仪表盘页面 |

---

## 4. 仪表盘测试

**文件：** `specs/dashboard.spec.ts` ｜ **优先级：** P1

验证仪表盘页面功能，包括用户信息展示和标签页导航。

> 所有测试共用一个浏览器上下文（避免限流），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 仪表盘加载并显示用户信息 | API 注册并登录 → 访问 `/dashboard` → 验证 URL 正确 → 验证 `<h1>` 可见 → 验证用户名显示在页面上 |
| 2 | 个人资料标签页显示邮箱和姓名 | 访问 `/dashboard` → 等待加载完成 → 验证用户姓名和邮箱都显示在页面上 |
| 3 | 可以在标签页之间导航 | 访问 `/dashboard` → 获取所有标签按钮 → 验证数量 > 1 → 点击第二个标签 → 验证未离开 dashboard 页面 |

---

## 5. 定价页测试

**文件：** `specs/pricing.spec.ts` ｜ **优先级：** P1 ｜ **无需登录**

验证定价页的计划卡片渲染和标签切换。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 渲染计划卡片 | 打开定价页 → 验证页面标题可见 → 验证至少有一个含价格符号的元素 |
| 2 | 卡片显示名称、价格和功能 | 打开定价页 → 验证 `<h3>` 计划名称数量 ≥ 1 → 验证 CTA 按钮数量 ≥ 1 |
| 3 | 卡片包含功能列表和勾选图标 | 打开定价页 → 验证功能列表项数量 ≥ 1 |
| 4 | 订阅 / 积分标签切换 | 打开定价页 → 检查是否有标签切换器 → 如果有，点击「积分」标签 → 验证价格仍然可见 → 切回「订阅」标签 → 验证价格可见 |

---

## 6. AI 功能页测试

**文件：** `specs/ai-features.spec.ts` ｜ **优先级：** P2

验证 AI 功能页面能正常加载并显示关键 UI 元素。**不会**实际调用 AI API 生成内容。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | AI 对话页加载 | 打开 `/ai` → 如果未被重定向到登录页，验证文本输入区域（`<textarea>` 或 `contenteditable`）可见 |
| 2 | 图片生成页加载 | 打开 `/image-generate` → 验证提示词输入框可见 → 验证模型选择器（下拉框）存在 |
| 3 | 视频生成页加载 | 打开 `/video-generate` → 验证提示词输入框可见 → 验证模型选择器（下拉框）存在 |
| 4 | 图片生成页有生成按钮 | 打开 `/image-generate` → 验证页面上至少有一个按钮 |
| 5 | 视频生成页有生成按钮 | 打开 `/video-generate` → 验证页面上至少有一个按钮 |

---

## 7. Stripe 支付流程测试

**文件：** `specs/stripe-payment.spec.ts` ｜ **优先级：** P0

> ⚠️ **前置条件：**
> 1. 开发服务器在 8001 端口运行
> 2. `stripe listen --forward-to localhost:8001/api/payment/webhook/stripe` 正在运行
> 3. `.env` 中配置了 Stripe 测试模式的 API Key

完整的 Stripe 支付端到端流程，覆盖**订阅购买**和**积分购买**两个链路。使用测试卡号 `4242 4242 4242 4242` 模拟支付，不产生真实扣款。

> 所有测试共用一个浏览器上下文（`beforeAll` 注册），按串行顺序执行。

### A) 订阅购买流程

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 点击 Stripe 订阅计划跳转到 Checkout | API 注册用户 → 打开定价页（默认"订阅"标签页） → 等待 plan cards 渲染完成 → 找到 "Stripe Monthly Plan" 标题 → 滚动到可见区域 → 点击对应的 CTA 按钮 → 等待 URL 跳转到 `checkout.stripe.com` |
| 2 | 完成 Stripe 订阅支付 | 重复步骤 1 跳转到 Stripe Checkout → 等待卡号输入框出现 → 填写卡号 `4242 4242 4242 4242` → 填写有效期 `12/30` → 填写 CVC `123` → 填写持卡人姓名 → 点击 "Subscribe" 按钮 → 等待重定向回 `/payment-success` → 验证 URL 包含 `payment-success` 和 `provider=stripe` |
| 3 | 支付成功页显示成功 UI | 重复步骤 2 完成支付 → 验证成功页 `<h1>` 标题可见 → 验证页面上有跳转到 `/dashboard` 的链接 |
| 4 | 支付取消页可正常访问 | 直接访问 `/payment-cancel` → 验证 URL 正确 → 验证页面标题可见 → 验证有返回 `/pricing` 的链接 |
| 5 | 仪表盘订阅标签显示计划详情 | 访问 `/dashboard` → 点击"Subscription Status"导航按钮 → 等待订阅数据加载 → **如果 webhook 已处理**：验证计划名称 "Stripe Monthly Plan" 可见 → 验证 "Active" 状态徽章可见 → 验证 "Start Date" 和 "End Date" 标签可见 → 验证 "Recurring" 付款类型徽章可见 → 验证进度条存在。**如果 webhook 未处理**：验证 "No Active Subscription Found" 提示可见 → 验证 "View Plans" 链接可见 |

### B) 积分购买流程

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 6 | 点击 Stripe 积分计划跳转到 Checkout | 打开定价页 → 点击「Credits / 积分充值」标签 → 等待积分计划卡片渲染 → 找到 "100 Credits Stripe" 标题 → 点击对应的 CTA 按钮 → 等待 URL 跳转到 `checkout.stripe.com` |
| 7 | 完成 Stripe 积分购买 | 重复步骤 6 跳转到 Stripe Checkout → 填写测试卡信息 → 点击 "Pay" 按钮 → 等待重定向回 `/payment-success` → 验证 URL 包含 `payment-success` 和 `provider=stripe` |
| 8 | 仪表盘积分标签显示余额更新 | 访问 `/dashboard` → 点击"Credits"导航按钮 → 验证 "Credit Balance" 标题可见 → 验证 "Available Credits" 标签可见 → 读取余额数值 → 验证 ≥ 100 → 验证 "Total Purchased" ≥ 100 → 如果 webhook 已处理，验证交易记录中出现 "Purchase" 类型条目 |

### Stripe 订阅支付完整链路图

```
用户登录
  ↓
打开 /pricing 定价页（"订阅"标签页）
  ↓
点击 "Stripe Monthly Plan" 的 CTA 按钮
  ↓
前端调用 POST /api/payment/initiate { planId: 'monthly', provider: 'stripe' }
  ↓
后端创建 Stripe Checkout Session → 返回 paymentUrl
  ↓
前端 window.location.href = paymentUrl
  ↓
浏览器跳转到 checkout.stripe.com（Stripe 托管页面）
  ↓
用户填写测试卡信息并点击 "Subscribe"
  ↓
Stripe 处理支付 → 重定向到 /payment-success?session_id=xxx&provider=stripe
  ↓
前端调用 GET /api/payment/verify/stripe?session_id=xxx 验证支付状态
  ↓
同时 Stripe 发送 webhook → stripe listen 转发到 /api/payment/webhook/stripe
  ↓
后端更新订单状态 → 创建/更新订阅记录
  ↓
用户在仪表盘"订阅"标签页看到：计划名称、Active 状态、起止日期、进度条
```

### Stripe 积分购买完整链路图

```
用户登录
  ↓
打开 /pricing 定价页 → 切换到「积分充值」标签页
  ↓
点击 "100 Credits Stripe" 的 CTA 按钮
  ↓
前端调用 POST /api/payment/initiate { planId: 'credits100', provider: 'stripe' }
  ↓
后端创建 Stripe Checkout Session → 返回 paymentUrl
  ↓
浏览器跳转到 checkout.stripe.com
  ↓
用户填写测试卡信息并点击 "Pay"
  ↓
Stripe 处理支付 → 重定向到 /payment-success?session_id=xxx&provider=stripe
  ↓
webhook 触发后端 → 查询 plan 的 credits 字段 (100) → 调用 creditService.addCredits()
  ↓
用户在仪表盘"积分"标签页看到：可用积分 ≥ 100、累计购买 ≥ 100、交易记录
```

---

## 8. 个人资料更新测试

**文件：** `specs/profile-update.spec.ts` ｜ **优先级：** P1

验证仪表盘中编辑个人资料的完整流程：进入编辑模式 → 修改姓名 → 保存 → 验证更新。

> 所有测试共用一个浏览器上下文（`beforeAll` 注册），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 个人资料标签页显示用户名和编辑按钮 | API 注册用户 → 访问 `/dashboard` → 验证用户名可见 → 验证 "Edit" 按钮可见 |
| 2 | 可以进入编辑模式并修改姓名 | 访问 `/dashboard` → 等待用户名加载 → 点击 "Edit" 按钮 → 验证 `#name` 输入框可见 → 清空并填入新姓名 → 点击 "Save" → 等待编辑模式关闭（"Edit" 按钮重新出现） → 验证新姓名显示在页面上 |

---

## 9. 修改密码测试

**文件：** `specs/password-change.spec.ts` ｜ **优先级：** P2

验证仪表盘「账户」标签页的密码修改功能。

> 所有测试共用一个浏览器上下文（`beforeAll` 注册），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 账户标签页显示修改密码区域 | API 注册用户 → 访问 `/dashboard` → 点击 "Account" 标签 → 验证 "Change Password" 文字可见 → 验证修改密码按钮可见 |
| 2 | 可以打开密码修改对话框并提交 | 访问 `/dashboard` → 切换到 "Account" 标签 → 点击 "Change Password" 按钮 → 等待对话框出现 → 填写当前密码 → 填写新密码 → 填写确认密码 → 点击提交 → 等待对话框关闭（表示修改成功） |
| 3 | 可以用新密码登录 | 创建全新浏览器上下文（无 cookie） → 用新密码调用 `signInViaAPI` → 验证返回 200 → 访问 `/dashboard` → 验证用户名可见（确认 session 有效） |

---

## 10. 语言切换测试

**文件：** `specs/i18n-switching.spec.ts` ｜ **优先级：** P2 ｜ **无需登录**

验证 Site、产品 Web 与 Admin 的无前缀本地化契约、共享偏好、旧链接兼容和本地化错误页。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 默认语言使用规范 URL | 清空 Cookie → 打开 Web `/signin` → 验证 HTML 语言为配置默认值且 URL 不含语言段 |
| 2 | 官网切换语言不改资源 URL | 打开 Site `/blog?source=i18n#posts` → 切换语言 → 验证 pathname、query、hash 不变且页面文案切换 |
| 3 | 三应用共享语言偏好 | 在 Site 切换语言 → 依次打开 Web `/signin` 与 Admin `/signin` → 验证三者从共享 Cookie 使用相同语言 |
| 4 | 旧语言前缀跳转规范 URL | 分别访问 Site、Web、Admin 的 `/en/**` 与 `/zh-CN/**` → 验证 307 后保留业务路径、query、hash，且语言偏好生效 |
| 5 | 未支持语言返回本地化 404 | 在两种语言偏好下分别访问三个应用的 `/fr/**` → 验证不重定向且 404 文案使用当前偏好语言 |

---

## 11. 上传页测试（真实上传）

**文件：** `specs/upload-page.spec.ts` ｜ **优先级：** P2

验证上传页面的真实上传流程（成功上传 + 客户端校验）。需要已配置可用的存储服务（OSS/S3/R2/COS）。

> 测试共用一个浏览器上下文（`beforeAll` 注册），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 上传页加载并显示存储服务选择器 | API 注册用户 → 访问 `/upload` → 验证页面标题可见 → 验证存储服务选择下拉框（`[role="combobox"]`）可见 |
| 2 | 成功上传图片并显示结果 | 使用 `input[type="file"]` 上传 1 张小尺寸 PNG → 等待 `POST /api/upload` 返回 200 → 验证上传后缩略图可见 → 验证查看文件链接可见 |
| 3 | 非图片文件被拒绝 | 上传 `.txt` 文件 → 验证提示 "Only image files are allowed" → 验证未出现上传结果 |
| 4 | 超过 1MB 文件被拒绝 | 上传 > 1MB 文件 → 验证提示 "File size must be less than 1MB" → 验证未出现上传结果 |

---

## 12. 管理员面板测试

**文件：** `specs/admin-panel.spec.ts` ｜ **优先级：** P3

验证管理员面板的核心功能：Dashboard 统计、子页面数据表、侧边栏导航和权限控制。

> 使用预置管理员账号 `admin@example.com` 登录（非测试创建，不会被 teardown 清理）。

### 管理员 Dashboard

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 管理员 Dashboard 加载并显示统计卡片 | 用管理员账号 API 登录 → 访问 `/admin` → 验证 "Admin Dashboard" 标题可见 → 验证至少有 4 个统计卡片 |
| 2 | Dashboard 显示图表和今日数据 | 访问 `/admin` → 验证 "Today" 相关文字可见 → 验证 "Recent Orders" 相关文字可见 |

### 管理员子页面

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 3 | 用户管理页显示数据表 | 访问 `/admin/users` → 验证 "User Management" 标题可见 → 验证 `<table>` 存在 |
| 4 | 订阅管理页显示数据表 | 访问 `/admin/subscriptions` → 验证 `<table>` 存在 |
| 5 | 订单管理页显示数据表 | 访问 `/admin/orders` → 验证 `<table>` 存在 |
| 6 | 积分管理页显示数据表 | 访问 `/admin/credits` → 验证 `<table>` 存在 |

### 侧边栏导航

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 7 | 侧边栏导航跨页面跳转 | 访问 `/admin` → 点击侧边栏 "Users" 链接 → 验证 URL 包含 `/admin/users` → 点击 "Orders" 链接 → 验证 URL 包含 `/admin/orders` |

### 用户详情管理

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 8 | 管理员从用户列表进入用户详情页 | 访问 `/admin/users` → 等待表格加载 → 点击第一行用户链接 → 验证 URL 匹配 `/admin/users/<id>` → 验证显示 "Edit User" 标题 |
| 9 | 管理员通过 API 获取用户详情 | 获取管理员 session → `GET /api/users/<adminId>` → 验证返回 200 → 验证 `id` 和 `email` 正确 |
| 10 | 管理员通过 API 更新用户信息 | 创建测试用户 → 重新登录管理员 → `PATCH /api/users/<testUserId>` 更新名称 → 验证返回 200 → `GET /api/users/<testUserId>` 验证名称已更新 |
| 11 | 非管理员用户无法访问用户详情 API | 创建普通用户 → `GET /api/users/<randomId>` → 验证返回 401 或 403 |

### 权限控制

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 12 | 非管理员用户访问管理面板被拒 | 使用全新浏览器上下文（未登录） → 访问 `/admin` → 验证被重定向到 `/signin` 或显示 "Access Denied" |

---

## 13. AI 对话（真实交互）

**文件：** `specs/ai-chat.spec.ts` ｜ **优先级：** P2

> ⚠️ **前置条件：**
> 1. 至少一个 AI 提供商的 API Key 已配置（如 Qwen、DeepSeek、OpenAI 等）
> 2. 积分通过 `seedCredits()` 在 `beforeAll` 中直接写入数据库（500 credits）

真实发送消息、验证 AI 回复、检查积分不足提示。

> 所有测试共用一个浏览器上下文（`beforeAll` 注册 + 种子积分），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 使用默认模型发送消息并获得回复 | API 注册用户 → `seedCredits(userId, 500)` → 访问 `/ai` → 等待页面渲染 → 点击 "New Chat" 清除示例消息 → 在 `<textarea>` 输入 "Hello, please respond with OK" → 点击 `button[aria-label="Submit"]` → 等待 `.is-user` 用户消息出现 → 等待 `.is-assistant` 助手消息出现 → 轮询直到助手消息文本非空（Streamdown 流式渲染） |
| 2 | 对话历史显示用户和助手消息正确排列 | 访问 `/ai` → 清除示例消息 → 输入 "Say the word PINEAPPLE" → 提交 → 等待用户和助手消息均出现 → 验证消息总数 ≥ 2 → 验证倒数第二条为 `.is-user`、最后一条为 `.is-assistant` |
| 3 | 积分不足时显示错误提示 | 新建浏览器上下文 → API 注册用户并确认获得默认欢迎积分 → `setCreditBalance(userId, 0)` 显式构造余额不足 → 访问 `/ai` → 清除示例消息 → 输入 "Hello" → 提交 → 验证 "Insufficient Credits" toast 或 `.bg-destructive/10` 错误区域出现 |

### 积分种子方式

```
beforeAll:
  signUpViaAPI → 获取 userId → seedCredits(userId, 500)
  
seedCredits 实现 (helpers/credits.ts):
  1. 连接 DATABASE_URL
  2. UPDATE user SET credit_balance = credit_balance + amount WHERE id = userId
  3. INSERT INTO credit_transaction (bonus 类型) 用于审计追踪
```

---

## 15. AI 图片生成（真实生成）

**文件：** `specs/ai-image-generate.spec.ts` ｜ **优先级：** P2

> ⚠️ **前置条件：**
> 1. 至少一个图片生成提供商的 API Key 已配置（当前使用 Qwen / Aliyun BaiLian）
> 2. 积分通过 `seedCredits()` 在 `beforeAll` 中直接写入数据库（500 credits）
> 3. 生成通常需要 5-15 秒，测试超时设置为 120 秒

真实调用 Qwen 图片生成 API，验证图片生成、下载、积分不足提示。

> 所有测试共用一个浏览器上下文（`beforeAll` 注册 + 种子积分），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 使用默认 Qwen 模型生成图片 | API 注册用户 → `seedCredits(userId, 500)` → 访问 `/image-generate` → 验证 `<h1>` 标题可见 → 验证 Provider 下拉框（`[role="combobox"]`）默认 "Aliyun BaiLian" → 验证 Model 下拉框默认 "Qwen Image Plus" → 在 `<textarea>` 输入 "A cute cat sitting on a table" → 点击 "Generate" 按钮 → 等待成功 toast "Image generated successfully!" 出现（超时 60 秒） → 验证 `img[alt="Generated image"]` 可见 → 验证图片 `src` 非空 → 验证 "Download" 按钮可见 |
| 2 | 生成后可以下载图片 | 访问 `/image-generate` → 输入提示词 → 点击生成 → 等待成功 toast → 验证 "Download" 按钮可见且可用 → 点击下载 → 验证无错误发生 |
| 3 | 积分不足时显示错误提示 | 新建浏览器上下文 → API 注册用户并确认获得默认欢迎积分 → `setCreditBalance(userId, 0)` 显式构造余额不足 → 访问 `/image-generate` → 输入提示词 → 点击生成 → 验证 "Insufficient Credits" toast 出现 |

### 积分种子方式

```
beforeAll:
  signUpViaAPI → 获取 userId → seedCredits(userId, 500)
  
seedCredits 实现 (helpers/credits.ts):
  1. 连接 DATABASE_URL
  2. UPDATE user SET credit_balance = credit_balance + amount WHERE id = userId
  3. INSERT INTO credit_transaction (bonus 类型) 用于审计追踪
```

### 页面选择器参考

```
通过 agent-browser 探索发现的选择器：
  - h1: "AI Image Generation"
  - 积分显示: text "credits: <number>"
  - Provider 下拉框: [role="combobox"] (第1个) — 默认 "Aliyun BaiLian"
  - Model 下拉框: [role="combobox"] (第2个) — 默认 "Qwen Image Plus"
  - 提示词输入: <textarea> placeholder="Describe the image you want to generate..."
  - 生成按钮: button 包含 "Generate" 文字
  - 结果区域: h2 "Result"，状态 "Idle" / "Generating..."
  - 生成图片: img[alt="Generated image"]
  - 下载按钮: button 包含 "Download" 文字
  - 成功 toast: Sonner 通知 "Image generated successfully!"
  - 积分不足 toast: "Insufficient Credits"
```

> **注意：** 视频生成测试暂不添加，因生成时间较长（通常 1-5 分钟），不适合自动化测试的超时设置。

---

## 16. 管理员子页面筛选功能测试

**文件：** `specs/admin-filters.spec.ts` ｜ **优先级：** P3

> 使用预置管理员账号 `admin@example.com` 登录。

验证各管理员子页面的搜索和下拉筛选功能。搜索功能通过 URL 参数导航验证页面状态（绕过 Vue `useVModel` 的反应性时序问题），下拉筛选通过 Radix/Reka combobox 交互验证 URL 更新。

> **实现说明：**
> - `goToPage` 等待 `networkidle` 确保 SSR 水合完成（避免点击时 Vue 事件处理器未挂载）
> - `pickFromCombobox` 使用重试循环 + Escape 关闭已打开的下拉框（处理 Radix UI overlay 阻塞）
> - Next.js 订阅页使用 `paymentType` 参数，Nuxt 使用 `provider` 参数（测试自动检测）

### A) 用户管理页筛选

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 搜索通过 URL 反映到页面状态 | 访问 `/admin/users?searchField=email&searchValue=admin&page=1` → 验证搜索输入框的值为 "admin" |
| 2 | 按角色筛选更新 URL | 访问 `/admin/users` → 在角色下拉框中选择 "Admin" → 等待 URL 包含 `role=admin` |
| 3 | 按封禁状态筛选更新 URL | 访问 `/admin/users` → 在封禁状态下拉框中选择 "Banned" → 等待 URL 包含 `banned=true` |
| 4 | 清除按钮重置所有筛选 | 访问带有多个筛选参数的 URL → 点击清除按钮 → 验证 URL 不再包含 `searchValue`、`role`、`banned` |

### B) 订阅管理页筛选

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 5 | 搜索通过 URL 反映到页面状态 | 访问 `/admin/subscriptions?searchField=userEmail&searchValue=test&page=1` → 验证搜索输入框值为 "test" |
| 6 | 按状态筛选更新 URL | 访问 `/admin/subscriptions` → 选择 "Active" → 等待 URL 包含 `status=active` |
| 7 | 第三筛选器更新 URL | 访问 `/admin/subscriptions` → 自动检测第三筛选器类型 → Next.js: 选择 "Recurring" → 验证 `paymentType=recurring`；Nuxt: 选择 "Stripe" → 验证 `provider=stripe` |

### C) 订单管理页筛选

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 8 | 按状态筛选更新 URL | 访问 `/admin/orders` → 选择 "Paid" → 等待 URL 包含 `status=paid` |
| 9 | 按提供商筛选更新 URL | 访问 `/admin/orders` → 选择 "Stripe" → 等待 URL 包含 `provider=stripe` |
| 10 | 组合筛选全部出现在 URL | 访问 `/admin/orders` → 选择 "Paid" → 再选择 "Stripe" → 验证 URL 同时包含 `status=paid` 和 `provider=stripe` |

### D) 积分管理页筛选

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 11 | 按类型筛选更新 URL | 访问 `/admin/credits` → 选择 "Purchase" → 等待 URL 包含 `type=purchase` |
| 12 | 搜索通过 URL 反映到页面状态 | 访问 `/admin/credits?searchField=userEmail&searchValue=admin&page=1` → 验证搜索输入框值为 "admin" |
| 13 | 清除按钮重置筛选 | 访问带有筛选参数的 URL → 点击清除按钮 → 验证 URL 不再包含 `searchValue`、`type` |

---

## 待实现的测试 (Backlog)

以下是已规划但尚未实现的测试用例。按优先级排列，实现后应迁移到上方对应章节。

### 17. Creem 支付流程测试

**计划文件：** `specs/creem-payment.spec.ts` ｜ **优先级：** P1

> ⚠️ **前置条件：**
> 1. `.env` 中配置了 Creem 测试模式的 API Key 和 Webhook Secret
> 2. Creem webhook 转发已配置到 `localhost:8001/api/payment/webhook/creem`
> 3. Creem 产品已创建并配置了 `creemProductId`

Creem 与 Stripe 流程类似，都是页面跳转到托管 Checkout 页面完成支付，通过 webhook 回调通知后端。

#### A) 订阅购买流程

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 点击 Creem 订阅计划跳转到 Checkout | API 注册用户 → 打开定价页 → 找到 "Creem Monthly Plan" 标题 → 点击 CTA 按钮 → 等待 URL 跳转到 Creem Checkout 页面 |
| 2 | 完成 Creem 订阅支付 | 跳转到 Creem Checkout → 填写测试卡信息（Creem 测试模式下的测试卡号） → 点击支付按钮 → 等待重定向回 `/payment-success?provider=creem` |
| 3 | 仪表盘显示订阅详情 | 访问 `/dashboard` → 点击"订阅"标签 → 验证 "Creem Monthly Plan" 计划名称可见 → 验证 Active 状态可见 |

#### B) 一次性购买流程

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 4 | 点击 Creem 一次性计划跳转到 Checkout | 打开定价页 → 找到 "Creem Monthly Plan (One Time)" 标题 → 点击 CTA 按钮 → 等待 URL 跳转到 Creem Checkout |
| 5 | 完成 Creem 一次性支付 | 完成支付流程 → 验证重定向回 `/payment-success?provider=creem` |

#### Creem 支付链路图

```
用户登录
  ↓
打开 /pricing 定价页
  ↓
点击 "Creem Monthly Plan" 的 CTA 按钮
  ↓
前端调用 POST /api/payment/initiate { planId: 'monthlyCreem', provider: 'creem' }
  ↓
后端通过 Creem SDK 创建 Checkout Session → 返回 checkoutUrl
  ↓
浏览器跳转到 Creem Checkout 页面
  ↓
用户填写卡信息并支付
  ↓
Creem 处理支付 → 重定向到 /payment-success?provider=creem
  ↓
Creem 发送 webhook (checkout.completed / subscription.active)
  → 后端更新订单 → 创建/更新订阅
  ↓
用户在仪表盘查看订阅状态
```

---

## 18. PayPal 支付流程测试

**文件：** `specs/paypal-payment.spec.ts` ｜ **优先级：** P2

> ⚠️ **前置条件：**
> 1. `.env` 中配置了 PayPal **沙盒** Client ID 和 Secret（`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`）
> 2. `.env` 中配置了沙盒买家账号（`PAYPAL_E2E_USER_NAME`, `PAYPAL_E2E_USER_PWD`）
> 3. `PAYPAL_SANDBOX="true"` 已设置
> 4. 沙盒环境的 Plan ID 已配置在 `config/payment.ts`（`paypalPlanId`）

PayPal 使用沙盒账户测试，用户跳转到 PayPal 授权页面，使用沙盒买家账号登录并确认支付。每个流程使用独立的浏览器上下文和用户，避免状态泄漏。

> 如果 `PAYPAL_E2E_USER_NAME` / `PAYPAL_E2E_USER_PWD` 未配置，所有测试自动跳过。

#### A) 一次性支付（One-time）

> 所有测试共用一个浏览器上下文（`beforeAll` 注册），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 点击 PayPal 一次性计划跳转到 PayPal | API 注册用户 → 打开定价页 → 找到 "PayPal Monthly (One Time)" 标题 → 点击 CTA 按钮 → 等待 URL 跳转到 `sandbox.paypal.com` |
| 2 | 完成 PayPal 一次性支付并看到成功页 | 跳转到 PayPal → 使用沙盒买家账号登录（email → Next → password → Log In） → 点击 "完成购物" / "Pay Now" 按钮 → 等待重定向回 `/payment-success?provider=paypal` → 验证 `<h1>` 标题和 dashboard 链接可见 |
| 3 | 仪表盘订阅标签显示 PayPal 计划 | 访问 `/dashboard` → 点击"Subscription"标签 → 验证 "PayPal Monthly" 计划名称可见（或 "No Active Subscription" 如 webhook 未处理） → 如有计划则验证 "Active" 状态可见 |

#### B) 循环订阅（Recurring）

> 使用独立浏览器上下文和用户。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 4 | 点击 PayPal 订阅计划跳转到 PayPal | API 注册用户 → 打开定价页 → 找到 "PayPal Monthly Plan" 标题 → 点击 CTA → 等待跳转到 `sandbox.paypal.com`（PayPal 订阅确认页面） |
| 5 | 完成 PayPal 订阅并看到成功页 | 使用沙盒买家账号登录 → 点击 "同意并订阅" / "Agree & Subscribe" 按钮（PayPal 订阅页面使用 iframe/Web Component 渲染，需跨 frame 搜索按钮） → 等待重定向回 `/payment-success?provider=paypal` |

#### C) 积分购买

> 使用独立浏览器上下文和用户。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 6 | 完成 PayPal 积分购买并看到成功页 | API 注册用户 → 打开定价页 → 切换到"积分充值"标签 → 找到 "100 Credits PayPal" → 点击 CTA → 在 PayPal 沙盒完成支付 → 验证重定向回 `/payment-success?provider=paypal` |
| 7 | 仪表盘积分余额更新 | 访问 `/dashboard` → 点击"Credits"标签 → 轮询最多 6 次（每次间隔 10s）等待 webhook 处理 → 验证可用积分 ≥ 100 → 验证累计购买 ≥ 100 |

#### PayPal 支付链路图

```
用户登录
  ↓
打开 /pricing 定价页
  ↓
点击 "PayPal Monthly (One Time)" 的 CTA 按钮
  ↓
前端调用 POST /api/payment/initiate { planId: 'monthlyPaypalOneTime', provider: 'paypal' }
  ↓
后端调用 PayPal API 创建 Order → 获取 approve URL
  ↓
浏览器跳转到 sandbox.paypal.com（授权页面）
  ↓
用户使用沙盒买家账号登录 → 点击 "Pay Now" / "完成购物"
  ↓
PayPal 重定向到 /api/payment/return/paypal?order_id=xxx&token=xxx&PayerID=xxx
  ↓
后端自动 capture 订单 → 更新订单状态 → 创建订阅
  ↓
重定向到 /payment-success?provider=paypal
  ↓
用户在仪表盘查看订阅/积分状态
```

#### PayPal 沙盒页面选择器参考

```
通过 agent-browser 探索发现的选择器：

一次性支付 (Orders API) 登录页面:
  - 邮箱输入: #email (textbox "Email or mobile number")
  - 下一步按钮: #btnNext (button "Next")
  - 密码输入: #password (textbox "Password")
  - 登录按钮: #btnLogin (button "Log In")

一次性支付审批页面 (sandbox.paypal.com/checkoutnow):
  - PayPal 余额: radio "PayPal余额 首选" (默认选中)
  - 信用卡: radio "Visa 信用卡 ••••0522"
  - 支付按钮: button "完成购物" / "Pay Now" / "Complete Purchase"
  - 取消链接: link "取消并返回Vibe Chat"

订阅支付审批页面 (sandbox.paypal.com/webapps/hermes):
  ⚠️ 内容在 iframe 中渲染，需使用 frame.getByRole('button', ...) 搜索
  - 审批按钮: button "同意并订阅" / "Agree & Subscribe"
  - 取消按钮: button "取消并返回到Vibe Chat"

注意：PayPal 可能记住登录状态，跳过 email/password 步骤直接到审批页面。
测试代码需处理两种场景（全新登录 vs 已登录）。
```

---

### 19. 支付宝支付流程测试

**计划文件：** `specs/alipay-payment.spec.ts` ｜ **优先级：** P2

> ⚠️ **前置条件：**
> 1. `.env` 中配置了支付宝**沙盒**环境的 App ID、私钥和公钥
> 2. 支付宝沙盒环境已开通（参考 [支付宝沙盒文档](https://opendocs.alipay.com/open/00dn7o)）
> 3. `ALIPAY_SANDBOX=true` 已设置
> 4. 沙盒买家账号已准备好

支付宝使用 PC 网站支付（`alipay.trade.page.pay`），用户跳转到支付宝页面完成支付，支付宝通过异步通知（notify_url）回调后端。

#### A) 订阅购买

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 点击支付宝计划跳转到支付宝 | API 注册用户 → 打开定价页 → 找到 "Alipay Monthly Plan / 支付宝月度" 标题 → 点击 CTA 按钮 → 等待 URL 跳转到 `alipay.com` 或 `alipaydev.com`（沙盒） |
| 2 | 在支付宝沙盒中完成支付 | 跳转到支付宝页面 → 使用沙盒买家账号登录并支付 → 等待重定向回 `/payment-success?provider=alipay` |
| 3 | 异步通知处理后仪表盘更新 | 支付宝发送异步通知到 `/api/payment/webhook/alipay` → 后端验签并更新订单 → 用户访问仪表盘验证订阅状态 |

#### 支付宝支付链路图

```
用户登录
  ↓
打开 /pricing 定价页
  ↓
点击 "Alipay Monthly Plan" 的 CTA 按钮
  ↓
前端调用 POST /api/payment/initiate { planId: 'monthlyAlipay', provider: 'alipay' }
  ↓
后端调用 alipay.trade.page.pay → 生成支付页面 URL
  ↓
浏览器跳转到 alipay.com / alipaydev.com（支付宝页面）
  ↓
用户登录沙盒买家账号 → 确认支付
  ↓
支付宝同步跳转到 /payment-success?provider=alipay
  ↓
同时支付宝异步通知 → POST /api/payment/webhook/alipay
  ↓
后端验签 → 更新订单状态 → 创建订阅
  ↓
用户在仪表盘查看订阅状态
```

> **注意：** 微信支付使用 Native 扫码支付（二维码），不适合 Playwright 自动化测试（无法模拟扫码），暂不计划添加。

---

### 20. 博客功能测试

**计划文件：** `specs/blog.spec.ts` ｜ **优先级：** P2

> ⚠️ **前置条件：**
> 1. 数据库已推送 `blog_post` 表（`pnpm db:push`）
> 2. 预置管理员账号 `admin@example.com` 可用

验证博客功能的完整流程：管理员创建/编辑/删除博客文章，公共页面展示已发布文章，权限控制。

> 管理员测试使用预置账号 `admin@example.com`（非测试创建，不会被 teardown 清理）。

#### A) 管理员博客管理

> 所有测试共用一个浏览器上下文（管理员登录），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 管理员侧边栏显示博客入口 | 用管理员账号 API 登录 → 访问 `/admin` → 验证侧边栏包含 "Blog" 链接 → 点击链接 → 验证 URL 包含 `/admin/blog` |
| 2 | 博客列表页加载并显示数据表 | 访问 `/admin/blog` → 验证页面标题可见 → 验证 `<table>` 存在 → 验证 "New Post" 按钮可见 |
| 3 | 创建新博客文章 | 点击 "New Post" 按钮 → 验证 URL 包含 `/admin/blog/new` → 填写标题 "E2E Test Post" → 验证 slug 自动生成 → 填写摘要 → 在 Markdown 编辑器中输入内容 → 选择状态为 "Published" → 点击保存 → 等待重定向到 `/admin/blog` → 验证列表中出现 "E2E Test Post" |
| 4 | 编辑已有博客文章 | 在列表中找到 "E2E Test Post" → 点击编辑按钮 → 验证 URL 包含 `/admin/blog/` → 修改标题为 "E2E Test Post Updated" → 点击保存 → 等待重定向到列表 → 验证列表中标题已更新 |
| 5 | 删除博客文章 | 在列表中找到 "E2E Test Post Updated" → 点击删除按钮 → 验证确认对话框出现 → 点击确认删除 → 验证文章从列表中消失 |
| 6 | 非管理员用户无法访问博客管理页 | 新建浏览器上下文 → 注册普通用户 → 访问 `/admin/blog` → 验证被重定向到 `/signin` 或返回 403 |

#### B) 公共博客页面

> 需要先通过 API 创建一篇已发布和一篇草稿文章用于测试。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 7 | 博客列表页加载并显示已发布文章 | 访问 `/blog` → 验证页面标题可见 → 验证至少有一篇文章卡片可见 → 验证卡片包含标题、摘要、日期 |
| 8 | 草稿文章不在公共页面显示 | 访问 `/blog` → 验证页面上不包含草稿文章的标题 |
| 9 | 博客详情页正确渲染 Markdown 内容 | 在博客列表点击文章卡片 → 验证 URL 包含 `/blog/` → 验证文章标题可见 → 验证作者信息可见 → 验证发布日期可见 → 验证 Markdown 内容已渲染（检查 `<h1>`/`<p>`/`<code>` 等 HTML 元素） |

#### C) 公共导航

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 10 | 网站头部导航包含博客链接 | 打开首页 `/` → 验证 `<header>` 中包含 "Blog" 链接 → 点击链接 → 验证 URL 包含 `/blog` |

#### 博客管理完整链路图

```
管理员登录
  ↓
打开 /admin/blog 博客管理页
  ↓
点击 "New Post" 按钮
  ↓
填写标题（自动生成 slug）、摘要、Markdown 内容、状态
  ↓
点击保存 → POST /api/admin/blog
  ↓
后端创建 blog_post 记录 → 重定向到列表
  ↓
已发布文章自动出现在 /blog 公共页面
  ↓
用户访问 /blog → 看到文章列表
  ↓
点击文章 → /blog/[slug] → Markdown 渲染展示
```

---

## 21. 推荐返利系统测试

**文件：** `specs/affiliate.spec.ts` ｜ **优先级：** P1

验证推荐返利系统的用户侧完整流程：推荐码生成、推荐链接 cookie 捕获、推荐码领取、仪表盘推荐标签页展示、提现请求。

> 需要显式配置 `AFFILIATE_ENABLED=true`（默认关闭）。

### A) 推荐码生成与仪表盘 API

> 所有测试共用一个浏览器上下文（`beforeAll` 注册），按串行顺序执行。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 推荐统计 API 返回推荐码和链接 | API 注册用户 → `GET /api/affiliate/stats` → 验证返回 200 → 验证响应包含 `referralCode`（8 字符）、`referralLink`（含 `?ref=`）、`commissionBalance`（≥ 0）、`commissionRate`（> 0）、`enabled`（true） |
| 2 | 推荐统计 API 多次调用返回相同推荐码 | 同一用户连续调用两次 `GET /api/affiliate/stats` → 验证两次返回的 `referralCode` 完全相同（幂等性） |

### B) 推荐链接 Cookie 捕获

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 3 | 访问带 ?ref= 的 URL 设置推荐 cookie | 新建浏览器上下文（未登录） → 访问 `/?ref=TESTCODE123` → 等待页面加载 → 验证浏览器 cookie 中存在 `referral_code=TESTCODE123` → 验证 URL 不再包含 `ref=` 参数 |

### C) 推荐码领取流程

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 4 | 完整推荐领取流程 | 用户 A（推荐人）API 注册 → `GET /api/affiliate/stats` 获取推荐码 → 新建浏览器上下文 → 访问 `/?ref={推荐码}` → 用户 B（被推荐人）API 注册 → `POST /api/affiliate/claim` → 验证返回 200 且 `applied` 为 true → 验证用户 A 的 `GET /api/affiliate/referrals` 返回 1 条记录 |
| 5 | 无推荐码时领取返回正常 | API 注册用户（无 cookie） → `POST /api/affiliate/claim` → 验证返回 200 且 `applied` 为 false 或 `noCode` 为 true |

### D) 仪表盘推荐标签页 UI

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 6 | 仪表盘显示推荐标签页 | API 注册用户 → 访问 `/dashboard` → 验证页面上有 "Affiliate" 或 "推荐" 标签按钮可见 → 点击该标签 → 验证推荐统计区域可见（佣金余额、佣金比例等） → 验证推荐链接输入框可见 |
| 7 | 仪表盘显示提现标签页 | 访问 `/dashboard` → 验证页面上有 "Withdrawal" 或 "提现" 标签按钮可见 → 点击该标签 → 验证提现表单可见（金额输入框、支付方式选择） |

### E) 提现请求

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 8 | 余额不足时提现失败 | API 注册用户 → `POST /api/withdrawal/request` body: `{ amount: "100", paymentMethod: "alipay", paymentAccount: "test@test.com" }` → 验证返回 400 且包含余额不足错误信息 |

### 推荐返利完整链路图

```
用户 A 注册
  ↓
GET /api/affiliate/stats → 生成推荐码 (lazy-generate)
  ↓
用户 A 分享推荐链接 example.com/?ref=ABCD1234
  ↓
用户 B 点击链接 → 中间件设置 referral_code cookie (30天)
  ↓
URL 参数 ?ref= 被自动清除
  ↓
用户 B 注册/登录
  ↓
前端调用 POST /api/affiliate/claim
  ↓
后端: user B.referredByCode = ABCD1234
  ↓
如果配置了 refereeSignupBonus > 0: 给用户 B 加积分
如果配置了 referrerSignupBonus > 0: 给用户 A 加积分
  ↓
用户 B 购买任何计划 → payment webhook 触发
  ↓
processReferralCommission → 计算佣金 → 写入 commission 表 → 增加用户 A 的 commissionBalance
  ↓
用户 A 在仪表盘"推荐"标签页看到佣金余额和推荐列表
  ↓
用户 A 在"提现"标签页提交提现申请
  ↓
管理员在 /admin/withdrawals 审批提现
```

---

## 22. 管理员返利管理测试

**文件：** `specs/admin-affiliate.spec.ts` ｜ **优先级：** P2

> 使用预置管理员账号 `admin@example.com` 登录。
> 依赖 `libs/database/seed.ts` 中的推广返利测试数据（3 个邀请用户, 3 条佣金记录, 2 条提现记录）。

验证管理员后台的佣金管理、提现管理页面，以及用户列表中推荐相关列的展示。

### A) 管理员佣金管理页

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 佣金管理页加载并显示表格 | 用管理员账号 API 登录 → 访问 `/admin/commissions` → 验证页面标题 "Commission Records" 或 "佣金记录" 可见 → 验证 `<table>` 存在 |
| 2 | 佣金管理页有搜索字段下拉框 | 访问 `/admin/commissions` → 验证 `[role="combobox"]` 搜索字段下拉框可见 → 验证搜索输入框可见 |
| 3 | 佣金管理页搜索无报错 | 访问 `/admin/commissions` → 在搜索框输入 "admin" → 等待 1s → 验证页面标题仍然可见（页面未崩溃） |
| 4 | 佣金管理页有状态筛选 | 访问 `/admin/commissions` → 验证 `[role="combobox"]` 数量 ≥ 2（搜索字段 + 状态筛选） |

### B) 管理员提现管理页

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 5 | 提现管理页加载并显示表格 | 访问 `/admin/withdrawals` → 验证页面标题 "Withdrawal Requests" 或 "提现管理" 可见 → 验证 `<table>` 存在或显示空状态提示 |
| 6 | 提现管理页有搜索字段下拉框 | 访问 `/admin/withdrawals` → 验证 `[role="combobox"]` 搜索字段下拉框可见 → 验证搜索输入框可见 |
| 7 | 提现管理页搜索无报错 | 访问 `/admin/withdrawals` → 在搜索框输入 "admin" → 等待 1s → 验证页面标题仍然可见 |
| 8 | 提现管理页有状态筛选 | 访问 `/admin/withdrawals` → 验证 `[role="combobox"]` 数量 ≥ 2 |

### C) 管理员侧边栏导航

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 9 | 侧边栏包含佣金和提现入口 | 访问 `/admin` → 验证侧边栏包含 "Commissions" 或 "佣金管理" 链接 → 验证侧边栏包含 "Withdrawals" 或 "提现管理" 链接 |

### D) 用户管理页推荐列

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 10 | 用户列表视图筛选包含推荐列 | 访问 `/admin/users` → 等待表格加载 → 点击 "视图"/"View" 按钮 → 验证下拉菜单包含 "Referral Code/推荐码"、"Referred By/邀请人"、"Commission Balance/佣金余额" 三项 |
| 11 | 推荐列可以切换显示 | 访问 `/admin/users` → 点击 "视图" → 点击 "推荐码" 菜单项 → 关闭下拉 → 验证表头出现 "Referral Code/推荐码" |

### E) 用户管理 API 推荐信息

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 12 | 用户 API 返回推荐人信息 | `GET /api/admin/users?limit=50` → 验证返回 200 → 找到 `referredByCode` 非空的用户 → 验证该用户的 `referredBy` 对象包含 `email` 字段（即推荐码已被解析为实际用户信息） |

---

## 23. 推荐佣金支付全流程测试

**文件：** `specs/affiliate-commission.spec.ts` ｜ **优先级：** P0

> ⚠️ **前置条件：**
> 1. 开发服务器在 8001 端口运行
> 2. `stripe listen --forward-to localhost:8001/api/payment/webhook/stripe` 正在运行
> 3. `.env` 中配置了 Stripe 测试模式的 API Key
> 4. 显式配置 `AFFILIATE_ENABLED=true`（默认关闭）

验证推荐返利系统的完整支付链路：推荐人分享 → 被推荐人注册 → 被推荐人通过 Stripe 购买 → Webhook 触发佣金计算 → 推荐人余额增加。

这是捕获集成 bug（如 metadata 覆盖导致推荐信息丢失）的关键端到端测试。

> 所有测试共用浏览器上下文，按串行顺序执行。整体超时 3 分钟（含 Stripe + Webhook 处理）。

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 被推荐人完成 Stripe 积分购买 | `beforeAll`: 用户 A（推荐人）API 注册 → `GET /api/affiliate/stats` 获取推荐码和初始余额 → 用户 B（被推荐人）设置 `referral_code` cookie → API 注册 → `POST /api/affiliate/claim` 领取推荐码 → **测试体**: 用户 B 打开定价页 → 切换到「积分充值」标签 → 找到 "100 Credits Stripe" → 点击 CTA → 跳转到 Stripe Checkout → 填写测试卡 `4242 4242 4242 4242` → 提交支付 → 验证重定向回 `/payment-success?provider=stripe` |
| 2 | 推荐人佣金余额增加 | 轮询用户 A 的 `GET /api/affiliate/stats`（最多 12 次，每次间隔 5s）→ 验证 `commissionBalance` 大于初始余额（$5 × 20% = $1.00 佣金） |
| 3 | 推荐人仪表盘显示佣金统计 | 用户 A 访问 `/dashboard` → 点击 "Affiliate" 标签 → 验证 "Commission Balance" 可见 → 通过 API 验证 `totalRegisteredReferrals ≥ 1` 且 `totalPaidReferrals ≥ 1` |
| 4 | 佣金记录包含购买用户信息 | `GET /api/affiliate/commissions?limit=10` → 验证返回 ≥ 1 条佣金记录 → 最新记录包含 `buyer.email`（含 @）、`orderAmount`、`commissionAmount > 0` |

### 推荐佣金完整链路图

```
用户 A（推荐人）注册
  ↓
GET /api/affiliate/stats → 获取推荐码 + 记录初始佣金余额
  ↓
用户 B（被推荐人）设置 referral_code cookie
  ↓
用户 B 注册 → POST /api/affiliate/claim → referredByCode 写入用户 B
  ↓
用户 B 打开 /pricing → 选择 "100 Credits Stripe" ($5)
  ↓
POST /api/payment/initiate → 创建订单
  → 查询用户 B 的 referredByCode → 解析推荐人 ID
  → 订单 metadata = { referralCode, referrerId, ...stripeMetadata }
  ↓
跳转到 checkout.stripe.com → 填写测试卡 → 支付
  ↓
Stripe 发送 webhook → stripe listen 转发到 /api/payment/webhook/stripe
  ↓
后端处理 webhook → processReferralCommission(orderId)
  → 读取订单 metadata.referrerId
  → 计算佣金 ($5 × 20% = $1.00)
  → 写入 commission 表
  → 增加用户 A 的 commissionBalance
  ↓
轮询用户 A 的 /api/affiliate/stats → 验证余额增加
  ↓
用户 A 仪表盘 → Affiliate 标签 → 看到佣金和推荐统计
```

---

## 24. 管理员动态定价管理测试

**文件：** `specs/admin-pricing.spec.ts` ｜ **优先级：** P2

> 使用预置管理员账号 `admin@example.com` 登录。

验证管理员后台的动态定价管理功能：列表页加载、创建/编辑/删除方案、导入静态配置、权限控制。不需要种子数据，测试中创建的方案在 afterAll 中自动清理。

### A) 列表页

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 1 | 定价列表页加载并显示操作按钮 | 用管理员账号 API 登录 → 访问 `/admin/pricing` → 验证 "Pricing Plans" 标题可见 → 验证 "Create Plan" 链接可见 → 验证 "Import" 按钮可见 → 验证 "Subscription" / "Credits" 标签切换按钮可见 |
| 2 | 订阅/积分标签切换 | 访问 `/admin/pricing` → 点击 "Credits" 标签 → 验证 URL 仍为 `/admin/pricing` → 点击 "Subscription" 标签 → 验证 URL 正确 |

### B) 创建方案

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 3 | 创建方案页加载并显示分组卡片 | 访问 `/admin/pricing/new` → 验证 "Create Plan" 标题可见 → 验证 "Plan Information"、"Pricing"、"Provider Configuration"、"Display Settings" 四个区块可见 → 验证返回链接可见 |
| 4 | 创建新定价方案 | 填写英文名称/描述/时长标签/功能特性 → 切换到中文标签填写 → 输入金额 9.99 → 点击保存 → 验证重定向回列表页 |
| 5 | 新建方案出现在列表中 | 访问列表页 → 验证刚创建的方案名称可见 |

### C) 编辑方案

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 6 | 编辑页加载并显示已有数据 | 在列表页找到方案 → 点击编辑按钮 → 验证 URL 匹配 `/admin/pricing/<id>` → 验证 "Edit Plan" 标题可见 → 验证名称输入框包含正确值 |
| 7 | 更新方案名称 | 编辑页清空名称 → 输入新名称 → 保存 → 验证重定向回列表 → 验证新名称可见 |

### D) 切换激活状态

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 8 | 切换方案激活开关 | 在列表页找到方案行 → 点击 Switch → 等待 API 响应 → 验证状态改变 → 点击复原 |

### E) 删除方案

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 9 | 删除方案后从列表消失 | 接受确认对话框 → 点击方案行的删除按钮 → 等待删除 → 验证方案不再显示 |

### F) 导入静态配置

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 10 | 通过 API 导入静态配置方案 | POST `/api/admin/pricing-plans/import` → 验证返回 200 → 验证 `imported ≥ 0` |

### G) 表单交互

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 11 | 提供商配置区块根据所选提供商显示对应字段 | 默认 Stripe → 验证 "Stripe Price ID" 可见 → 切换到 WeChat → 验证显示 "无需额外配置" 提示 |
| 12 | i18n 标签切换保持各语言数据独立 | 英文标签填写名称 → 切换到中文标签 → 验证名称为空 → 填写中文名称 → 切回英文 → 验证英文名称恢复 |

### H) 权限控制

| # | 测试名称 | 具体流程 |
|---|---------|---------|
| 13 | 非管理员用户无法访问定价管理页 | 未登录访问 `/admin/pricing` → 验证重定向到 `/signin` 或返回 403 |
| 14 | 非管理员用户无法访问定价管理 API | 未认证调用 `GET /api/admin/pricing-plans` → 验证返回 401 或 403 |

---

## 25. 聊天宿主基础功能（历史基线，已由 #35 替代）

**文件：** 已删除；真实回归见 `specs/chat-real-product-state.spec.ts` ｜ **状态：** Replaced ｜ **历史 fixture 基线**

本组场景记录 2026-08-11 的前端壳验收历史，不再代表当前实现。2026-08-12 起登录后宿主不允许 fixture 或浏览器本地 mutation，自动化由 #30–#35 的真实 Matrix/产品状态用例承担。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 消息宿主加载 | 打开 `/messages` → 验证消息、联系人、发现、我的四项一级导航存在 → 验证统一会话列表和未读状态可见 |
| 2 | 搜索与未读筛选 | 在会话搜索框输入房间名或成员名 → 验证列表收窄 → 清空后切换未读筛选 → 验证仅展示有未读消息的会话 |
| 3 | 进入房间并发送消息 | 从会话列表进入房间 → 验证氛围画布、宿主控制岛和消息时间线可见 → 输入文字并发送 → 验证本地回显及发送完成状态 |
| 4 | 回复与回应 | 在房间中选择回复一条消息 → 验证输入区显示回复上下文 → 发送后验证关联内容可见 → 点击回应按钮并验证计数变化 |
| 5 | 新建聊天 | 打开“新聊天” → 先选择一位或多位联系人 → 继续选择一个氛围空间 → 在确认页创建 → 验证进入新房间且新会话出现在列表中 |
| 6 | 联系人与发现 | 打开联系人页 → 接受或拒绝好友请求 → 打开发现页 → 搜索/筛选氛围空间、收藏空间并从空间发起聊天 |
| 7 | 响应式导航 | 使用移动端视口打开消息页 → 验证底部四项导航和单列会话列表 → 进入房间后验证底部导航隐藏、宿主控制岛保留 |
| 8 | 本地持久化 | 发送消息、置顶/静音会话或收藏空间后刷新页面 → 验证用户操作仍然保留 |

---

## 26. Email OTP 与产品 Session Bootstrap

**文件：** `specs/chat-auth-bootstrap.spec.ts` ｜ **优先级：** P0 ｜ **本地数据库**

本组用例验收 A2 的第一条真实服务切片。认证必须由 Better Auth Email OTP plugin 完成；产品接口只读取 Better Auth Cookie session，不复制 session token，也不在 Matrix 尚未接入时返回伪造凭据。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 请求登录验证码 | 打开 `/signin` → 保持 Email OTP 为默认登录方式 → 输入邮箱并请求验证码 → 验证进入六位验证码输入步骤 |
| 2 | 首次邮箱自动注册并登录 | 在开发环境读取 Better Auth 响应中的测试 OTP → 提交验证码 → 验证自动创建用户、写入 Cookie session 并进入 `/spaces` |
| 3 | 获取产品 session bootstrap | 登录后请求 `GET /v1/session/bootstrap` → 验证返回当前用户 ID、邮箱、展示名和头像字段 → 验证响应明确标记 Matrix 尚未配置且不包含 access token |
| 4 | 未登录请求被拒绝 | 清除 Cookie 后请求 `GET /v1/session/bootstrap` → 验证返回 401 和稳定的产品错误结构 |
| 5 | 旧密码登录仍可访问 | 在登录页切换到密码登录 → 验证旧账号兼容入口仍存在，迁移期间不破坏既有认证用户 |

---

## 27. Matrix Identity 生命周期

**文件：** `specs/chat-auth-bootstrap.spec.ts` + `tests/unit/identity/*.test.ts` ｜ **优先级：** P0 ｜ **本地数据库 / fake adapter**

本组场景验收 A2 的第二条切片。产品 profile 必须持久化，Matrix user/device 的创建必须通过 adapter 和幂等 repository；Synapse 未配置时不能创建 binding 或返回 token。由于 Synapse Admin “login as user”不会创建真实设备，本切片不把该接口当成浏览器设备凭据签发方案。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 幂等创建产品资料 | Email OTP 登录后连续请求两次 `GET /v1/session/bootstrap` → 验证 user ID、username、display name 保持一致 |
| 2 | 产品资料成为权威 | 首次 bootstrap 从 Better Auth session 创建 profile → 后续 bootstrap 读取已持久化 profile，不重复创建或覆盖产品字段 |
| 3 | Synapse 未配置安全降级 | 本地未配置 Synapse adapter → 验证 Matrix 状态为 unavailable → 数据库中不创建 session binding → 响应不含 access token |
| 4 | Matrix user 幂等 provision | 使用 fake adapter 并发 bootstrap 同一用户 → 验证只形成一个 Matrix identity，重复调用返回同一 Matrix user ID |
| 5 | Session-device 幂等绑定 | 同一 Better Auth session 顺序重复 bootstrap 不再创建 device；并发 bootstrap 由 repository 选出唯一 binding，loser device 立即注销；token 经 protector 后才写入 repository |
| 6 | Session 撤销进入 outbox | 撤销已绑定 session → binding 标记 revoked → 写入幂等 `matrix.device.revoke` outbox 事件，供后续 worker 处理 |
| 7 | Adapter 失败不泄漏凭据 | Matrix adapter 抛错 → route 映射稳定产品错误 → 不写入明文 token 或半成品 active binding |

---

## 28. Synapse Appservice Adapter

**文件：** `tests/unit/identity/synapse-appservice.test.ts` + `specs/chat-auth-bootstrap.spec.ts` ｜ **优先级：** P0 ｜ **mock HTTP / 本地 Synapse**

产品服务作为 Matrix Application Service 管理专属用户 namespace。用户使用 `m.login.application_service` 注册为无密码 Matrix 用户，再通过标准 `/login` 获取绑定真实 device 的单用户 scoped token；Synapse Admin “login as user”和自建 Matrix 密码均不进入该链路。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 配置全有或全无 | Matrix 环境变量全部缺失 → adapter unavailable；只配置一部分 → 启动/请求明确失败且不回退到伪 token |
| 2 | 无密码用户幂等注册 | adapter 使用 appservice token 调用标准注册端点并设置 `inhibit_login` → 首次创建成功；`M_USER_IN_USE` 视为已存在并返回同一 Matrix user ID |
| 3 | Scoped device login | adapter 使用 `m.login.application_service` 登录已注册用户 → 请求携带唯一 device ID 与显示名 → 校验响应 user/device/token 后才返回凭据 |
| 4 | 并发 winner/loser 回收 | 同一 Better Auth session 并发 bootstrap → repository 只保留一个 binding → loser 立即用自己的 token 调用 `/logout`，两个响应都返回 winner 凭据 |
| 5 | 标准注销撤销 device | outbox worker/adapter 使用待撤销 binding 的 access token 调用 Matrix `/logout` → token 失效且 device session 不再可用 |
| 6 | 错误与 secret 隔离 | Synapse 返回非 2xx、无效 JSON 或字段不匹配 → 抛出稳定 adapter error → 日志/异常不包含 appservice token 或 Matrix access token |
| 7 | 真实本地联调 | 启动固定版本 Synapse + appservice registration → Email OTP 登录并 bootstrap → 返回 ready、真实 Matrix user/device/token → 重复 bootstrap 保持 binding 稳定 |

---

## 29. Session 撤销与 Matrix Device 回收

**文件：** `tests/unit/identity/device-revocation-worker.test.ts` + `specs/chat-session-revocation.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse**

Better Auth session 是产品会话权威。任何单会话或批量 session 删除都先把对应 Matrix binding 标记为 revoked 并写入幂等 outbox；删除完成后 worker 立即尝试注销 scoped Matrix device。远端失败不得丢事件或泄漏 token，后续 drain 可安全重试。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 登出先持久化撤销意图 | 已 bootstrap 的 Better Auth session 调用 sign-out → session delete hook 将 binding 标记 revoked → 同一 session 只形成一个 `matrix.device.revoke` 事件 |
| 2 | Worker 回收真实 device | worker 读取 binding 并解密 token → 调用 Matrix `/logout` → 标记 outbox processed → 原 token 请求 `/account/whoami` 返回 401 |
| 3 | 重复处理保持幂等 | 重复触发 session delete 或重复 drain → 不新增事件、不重复保留 pending 状态，已失效 token 被视为成功 |
| 4 | 远端失败可重试 | Synapse 暂时不可用 → attempts 增加、availableAt 延后且 processedAt 仍为空 → 下次到期 drain 成功 |
| 5 | 无 binding 安全跳过 | 删除从未 bootstrap 的 Better Auth session → hook 和 worker 无错误完成且不创建空 outbox |
| 6 | 凭据与日志隔离 | outbox payload、worker result 与错误日志均不包含 Matrix access token 或加密 key |
| 7 | 真实端到端撤销 | Email OTP 登录 → bootstrap → token whoami 为 200 → sign-out → drain → 同 token whoami 为 401 → bootstrap 再请求为 401 |

---

## 30. 真实 Matrix 房间与消息 Timeline

**文件：** `tests/unit/rooms/*.test.ts` + `specs/chat-matrix-room.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse / Chromium**

本组场景把聊天宿主的 room/timeline 权威从 fixture 切换到 Matrix。产品 API 校验会话、参与人和内置氛围版本后创建私有 room 与产品索引；浏览器单例 `matrix-js-sdk` 负责 `/sync`、IndexedDB timeline 缓存、local echo、transaction ID 和恢复。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 幂等创建氛围房间 | 已 bootstrap 用户以固定 `clientRequestId` 两次调用 `POST /v1/rooms` → 返回同一 Matrix room ID → `room_index` 只有一条记录 |
| 2 | 房间状态写入 Matrix | 创建 room → 读取 `io.vibechat.space.instance.v1` → 验证 space/version/integrity/权限快照和创建人完整 |
| 3 | 浏览器真实同步 | 启动单例 matrix-js-sdk → `/sync` PREPARED 后宿主会话列表显示新 room → 页面刷新后由 IndexedDB + 增量 sync 恢复同一 room |
| 4 | Local echo 到远端确认 | 在房间发送文字 → timeline 立即显示 sending → Matrix 返回 event ID 后显示 sent → 刷新后消息仍来自远端 timeline |
| 5 | Transaction ID 幂等 | 相同 transaction ID 重试同一发送 → Synapse 返回同一 event ID，timeline 不重复消息 |
| 6 | 回复与回应使用标准关系 | 回复消息写入 `m.in_reply_to`；回应写入 `m.reaction` → 宿主投影 reply/reactions 且恢复视图可读 |
| 7 | 鉴权与参与人约束 | 未登录建房返回 401；未 bootstrap 或 participant Matrix identity 未 ready 返回稳定 409；不存在的空间返回 404 |
| 8 | 凭据不落 localStorage | access token 仅存在于内存 client；localStorage 不包含 token，IndexedDB 只保存 SDK sync/timeline 缓存 |

---

## 31. 好友关系与双用户 Matrix 邀请

**文件：** `tests/unit/social/*.test.ts` + `specs/chat-social-invite.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse / 双 Chromium Context**

产品数据库是好友、备注与屏蔽的权威来源；Matrix 只保存 room membership 和邀请。联系人使用 Better Auth product user ID，建房 service 经 identity mapping 转换为 Matrix user ID，并在创建私有 room 时发送邀请。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 精确用户搜索 | 登录用户按 username 或完整 email 搜索 → 不返回自己、被屏蔽用户或公开全量目录 → 返回产品 profile 与 Matrix readiness |
| 2 | 好友请求幂等 | A 向 B 发送请求 → B 收件箱出现一条 pending → A 重复发送不产生第二条 → A/B 各自可读取稳定 snapshot |
| 3 | 接受形成双向联系人 | B 接受 pending 请求 → request 变 accepted → contacts 原子写入 A→B 与 B→A 两行 → 双方列表均显示对方 |
| 4 | 拒绝不形成联系人 | B 拒绝请求 → request 变 rejected → 双方 contacts 不新增关系 → 重复拒绝保持稳定 |
| 5 | 屏蔽优先 | B 屏蔽 A → pending 请求被终止、既有联系人移除 → A 不能再次请求或邀请 B；解除屏蔽后仍需重新建立好友关系 |
| 6 | 非联系人禁止邀请 | A 尝试把非联系人加入 room → 产品 API 返回稳定 409；不能靠已知 Matrix user ID 绕过产品社交策略 |
| 7 | 创建对话弹窗可读 | A 从联系人发起聊天 → Portal 弹窗使用独立且不透明的主题 surface → 遮罩后的页面内容不穿透联系人选择、Space 选择和确认步骤 |
| 8 | 双用户邀请确认 | A/B 成为联系人 → A 创建氛围 room 并邀请 B → B 宿主显示邀请 → B 确认后 Matrix membership 变 join |
| 9 | 双向实时消息 | A 发消息 → B `/sync` timeline 显示 → B 回复/回应 → A timeline 收到且刷新后双方历史一致 |
| 10 | 多方言一致与凭据隔离 | PG/SQLite/D1 schema 同步；社交响应、日志和 Matrix invite state 不包含 Better Auth Cookie、Matrix token 或加密 key |

---

## 32. 浏览器会话与本地 Matrix 数据管理

**文件：** `specs/chat-session-management.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse / 双 Chromium Context**

Better Auth session 是浏览器登录设备的产品权威；每个产品 session 对应独立 Matrix device。用户可以查看和撤销设备，退出当前会话时宿主必须同时清理对应 Matrix IndexedDB timeline cache 和本地 UI 偏好。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 活动会话列表 | 同一账号在两个浏览器 context 登录并 bootstrap → “我的 / 设备与会话”显示两条活动会话并标记当前设备 |
| 2 | 撤销其他设备 | 当前设备调用 Better Auth `revoke-other-sessions` → 列表只保留当前会话 → 另一产品 session 立即失效 |
| 3 | Matrix device 联动撤销 | 另一 session 被删除 → lifecycle hook/outbox 注销对应 Matrix device → 原 access token `/whoami` 返回 401 |
| 4 | 当前退出 | 从聊天“我的”页退出 → 当前 Better Auth session 和 Matrix device 均失效 → 跳转本地化登录页 |
| 5 | 本地数据清理 | 退出前停止 Matrix client → 删除 `matrix-js-sdk:vibechat-sync-{deviceId}` IndexedDB → 清除聊天 UI 偏好且不把 token 写入 localStorage |

---

## 33. Matrix 完整消息操作

**文件：** `specs/chat-matrix-operations.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse / 双 Chromium Context**

阶段 1 的消息 adapter 必须使用 Matrix 标准事件与关系完成文字以外的日常操作，并在双方同步、刷新和恢复投影中保持一致。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 编辑自己的文字 | 发送者编辑已确认消息 → 写入 `m.replace` 与 `m.new_content` → 双方原消息位置展示新文字和“已编辑” |
| 2 | 删除自己的消息 | 发送者确认删除 → Matrix redaction → 双方保留删除占位而不是静默丢失时间线位置 |
| 3 | 权限约束 | 非发送者 UI 不显示编辑/删除；adapter 不把编辑和 redaction 暴露为普通新消息 |
| 4 | 媒体附件 | 选择图片或文件 → 上传 Synapse media repository → 发送 `m.image`/`m.file` → 对端显示名称、类型和受控下载入口 |
| 5 | 正在输入 | 输入框变化发送 `m.typing` ephemeral event → 对端显示输入提示 → 发送、清空或超时后提示消失 |
| 6 | 历史搜索 | 会话搜索命中已加载消息正文或附件名称 → 返回对应房间；删除内容不再参与可读搜索 |
| 7 | 恢复一致 | 页面刷新后编辑、删除和附件投影保持一致；token、媒体内容与本地文件句柄不写入 localStorage |

---

## 34. 首次资料设置与联系人备注

**文件：** `specs/chat-profile-onboarding.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse / 双 Chromium Context**

产品资料是 Better Auth 账号、社交目录和 Matrix 身份之间的稳定映射。新账号先完成资料设置，联系人备注只影响设置者自己的联系人视图。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 首次设置守卫 | 新账号访问聊天页 → 跳转 `/onboarding`；已完成资料的账号不再被拦截 |
| 2 | 资料校验 | 昵称必填；用户名只能使用小写字母、数字和下划线且全局唯一；非法或重复值返回稳定错误码 |
| 3 | 完成首次设置 | 保存昵称、唯一用户名并选择跳过头像 → 标记完成 → 进入消息页 → bootstrap 返回新资料 |
| 4 | 后续编辑 | “我的”页面修改昵称与用户名 → 页面刷新和 Matrix 当前用户投影展示最新资料 |
| 5 | 头像入口 | 支持选择受限图片并复用认证上传接口；存储未配置时展示可恢复错误且允许跳过，不阻塞首次设置 |
| 6 | 联系人备注 | 建立好友后设置备注 → 仅设置者联系人列表、选人和会话成员投影优先显示备注；对端仍显示原昵称 |
| 7 | 备注清除与权限 | 清空备注恢复昵称；非联系人不能写备注；长度和输入由共享 schema 校验 |

---

## 35. 登录后产品状态真实化

**文件：** `specs/chat-real-product-state.spec.ts` ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse / 双 Chromium Context**

登录后的聊天产品只能展示当前账号、产品数据库和 Matrix 的真实状态。服务不可用时显示明确错误，不再用 fixture 掩盖失败。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 路由认证守卫 | 未登录访问消息、联系人、发现、我的或房间 → 跳转本地化登录页，不渲染演示用户或演示房间 |
| 2 | 空账号真实状态 | 新账号完成 onboarding 后进入消息页 → 当前用户来自 profile → 房间、联系人、请求和收藏均为空 → 不出现 River/林林等 fixture 内容 |
| 3 | Matrix 失败关闭 | 已登录但 Matrix 配置不可用或 bootstrap 失败 → 展示可重试的服务不可用状态 → 不进入可发送的本地模拟模式 |
| 4 | 官方空间目录 | `GET /v1/spaces` 返回服务端内置空间版本与权限 → 发现页和新建聊天使用该响应 → 不把第三方市场标记为已上线 |
| 5 | 收藏持久化与隔离 | A 收藏官方空间并刷新/重新登录后仍存在 → B 的收藏不受影响 → 非法空间 ID 被拒绝 |
| 6 | 用户偏好持久化 | 通知偏好和主题/语言更新写入产品 API → 刷新与新浏览器 session 读取一致值 |
| 7 | 房间偏好持久化 | A 对真实 Matrix 房间置顶/静音 → 刷新或另一 session 仍保持 → B 的同一房间视图不继承 A 的偏好 |
| 8 | 真实 mutation 边界 | 发送、建房、好友、备注、屏蔽、收藏和偏好操作只调用真实接口/Matrix；失败时保持错误态，不创建本地假记录 |
| 9 | 凭据与缓存隔离 | localStorage 不包含 profile、联系人、收藏、偏好权威副本、Matrix token 或消息正文；清理缓存不删除服务端用户态 |

---

## 36. Apps 拆分与同源 Backend 网关

**文件：** `specs/public-pages.spec.ts`、`specs/auth-flow.spec.ts`、聊天 P0 specs ｜ **优先级：** P0 ｜ **SQLite / 本地 Synapse**

官网、产品 Web 和共享 backend 是独立构建单元，但浏览器继续从 `8001` 使用稳定的同源认证与产品 API 路径。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 独立官网 | 打开 `http://localhost:8003/` → 首页 Header、单一品牌介绍和 Footer 可见 → CTA 指向 `http://localhost:8001/spaces` |
| 2 | 产品根入口 | 打开 `http://localhost:8001/` → 未登录进入 `/signin`；已登录进入 `/spaces`，不渲染官网或 legacy 页面 |
| 3 | Backend 健康 | 经 Web 同源路径请求 `GET /api/health` → 返回 `application=backend` 和健康数据库状态 |
| 4 | 同源 Auth | 经 `8001/api/auth/*` 注册、登录、读取 session、退出 → Cookie 生命周期与拆分前一致 |
| 5 | 同源产品 API | 经 `8001/v1/*` 完成 bootstrap、profile、social、rooms、spaces 与 product state → 真实 Matrix/数据库链路不变 |
| 6 | 构建边界 | site、web、backend 分别 typecheck/build → Site/Web 不导入数据库、支付、AI、存储或 server Auth → app-to-app import 被边界检查拒绝 |
| 7 | Legacy 隔离（历史阶段） | 该阶段曾隔离旧 AI、支付、affiliate 和通用 Admin；后续 #39 已评审恢复并替代此临时状态 |

---

## 37. 跨宿主 Workspace Package 边界

**文件：** package unit tests、`scripts/check-app-boundaries.mjs`、聊天 P0 specs ｜ **优先级：** P0 ｜ **pnpm workspace / SQLite / 本地 Synapse**

Web、Backend 与未来 Desktop 共用的契约和客户端能力必须通过真实 workspace package 发布边界消费；重构不能改变同源 Auth、产品 API 或 Matrix 用户链路。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 独立 Package 元数据 | `api-contracts`、`auth-client`、`product-core`、`product-client`、`matrix-client`、`platform-contracts` 各自声明 package name、exports、依赖、typecheck/build 与 README |
| 2 | API contract 单一来源 | Backend route 与 Web client 使用 `@vibechat/api-contracts` 的相同 Zod schema → 输入、输出和错误码不在 app 内复制 |
| 3 | 可注入产品 Client | `ProductApiClient` 用注入的 base URL 和 transport 发请求 → Web 使用同源 gateway → 测试可替换 transport → 非 2xx 返回稳定 `ProductApiClientError` |
| 4 | Matrix 运行时隔离 | Web 不直接依赖 `matrix-js-sdk` → `@vibechat/matrix-client` 接收宿主 IndexedDB → 真实 room/timeline/媒体/编辑/撤回链路保持通过 |
| 5 | Auth client/server 隔离 | Web 只导入 `@vibechat/auth-client` → `libs/auth` 只暴露 server auth/session lifecycle → 注册、登录、session、退出与设备撤销行为不变 |
| 6 | Package 依赖门禁 | packages 不导入 app、`@/`、`@libs/*` 或未声明的其他 package；Site/Web 不导入 server-only 领域实现；违规 import 使 `boundaries:check` 失败 |
| 7 | 保留合理 libs | 只有 Backend 消费的 identity/social/rooms/product-state 继续作为服务端领域实现 → 不为目录整齐创建无独立消费者的 package |
| 8 | 真实链路无回归 | 完整活动 Playwright 回归覆盖官网、同源 Auth/API、真实空账号、好友/房间、Matrix timeline 和产品偏好，重构后通过数不下降 |

---

## 38. 独立 Admin App 与运营管理链路

**文件：** `specs/admin-app.spec.ts`、`tests/api/admin-permission.test.ts` ｜ **优先级：** P0 ｜ **Admin 8005 / Backend 8002 / SQLite**

旧脚手架中仍有价值的运营后台迁入独立 Admin App；浏览器不直接依赖数据库或服务端领域实现，所有读取和 mutation 通过统一 Backend 权限边界完成。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 独立宿主 | 打开 `http://localhost:8005/admin` → Admin 壳层和运营导航可见 → Admin 可独立 typecheck/build，不进入 Web 产品 route tree |
| 2 | 未登录守卫 | 清空 Cookie 后访问 Admin 页面 → 转到本地化登录引导 → 管理 API 返回 `401`，不泄露统计或用户数据 |
| 3 | 非管理员拒绝 | 普通真实用户访问 Admin 页面 → 显示无权限状态 → 管理 API 返回 `403`，前端篡改角色不能绕过 Backend |
| 4 | 管理员会话 | seeded Admin 通过 Web 密码登录并提交 `callbackURL=http://localhost:8005/admin` → Better Auth 接受受信 Admin 回跳 → 共享 localhost session 生效 → Dashboard 读取真实用户、订阅、订单和收入统计 |
| 5 | 运营读取 | 用户、订阅、订单、积分、定价、Blog、佣金和提现页面分别请求真实 Backend API → 每个同源 API 禁止重定向并返回 JSON → 页面等待对应请求成功后呈现空状态或数据态，不使用 fixture，也不能用页面标题掩盖加载失败 |
| 6 | 用户管理 mutation | Admin 打开测试用户详情并修改可恢复字段或角色 → Backend 校验管理员权限与输入 → 刷新后数据库值一致，再恢复原值 |
| 7 | 定价与内容写入边界 | 管理定价或 Blog 的创建/更新/排序/删除操作通过 Backend 完成 → 非管理员执行同请求仍被拒绝 |
| 8 | App 与 libs 边界 | Admin 不导入 database、server Auth、payment/AI provider、storage 或 Backend 内部领域库 → 无活动消费者的旧库被删除 → 保留库均有引用证据 |
| 9 | 产品无回归 | Backend/Web/Site/Admin 根级 typecheck/build、管理权限测试和完整活动聊天 E2E 通过 |

---

## 39. Legacy 产品能力完整迁移

**文件：** `specs/account-services-ai.spec.ts`、`specs/admin-app.spec.ts`、API ownership suites 与领域单元测试 ｜ **优先级：** P0 ｜ **Web 8001 / Backend 8002 / Admin 8005**

旧源码只有在进入当前 app/package/lib 边界并通过真实用户链路后才算迁移。外部 provider 可以因缺少沙盒凭据跳过真实供应商步骤，但本地权限、输入、幂等、账本和失败补偿不能跳过。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 账户中心 | 用户登录 → 查看真实资料、订单、订阅、积分与安全状态 → 修改密码/账户操作经过 Better Auth → 不显示其他用户数据 |
| 2 | 定价与上传 | 公共定价读取活动计划 → 登录用户发起购买 → 金额由服务端计划决定；通用媒体上传校验类型/大小/数量并复用 storage |
| 3 | 积分账本 | 查询自己的余额/流水 → 并发扣减不透支 → 增加/扣减与账本原子 → AI/provider 失败退款且只退款一次 |
| 4 | 推荐与提现 | 推荐码归因 → 领取奖励幂等 → 支付佣金只生成一次 → 用户只能查看自己记录并申请提现 → 管理拒绝只退款一次 |
| 5 | 六支付 Provider | Stripe、PayPal、Creem、Dodo、微信、支付宝各自创建支付 → 验证回调/Webhook → 订单/订阅/积分入账 → 重复通知不重复履约 |
| 6 | AI 对话 | 有积分用户发起对话 → Backend 选择允许的 provider/model → 流式或完整响应 → 账单元数据可对账；无 key/失败时明确错误并退款 |
| 7 | 图片与视频 | 服务端校验模型、尺寸、时长和输入 → 创建生成任务 → 查询真实状态/结果 → 失败退款，不以浏览器轮询作为账务权威 |
| 8 | Admin 深度运营 | 用户/订阅/订单/积分筛选、定价 CRUD、Blog CRUD、佣金/提现处理通过真实 Backend；非管理员全部拒绝 |
| 9 | Legacy 清理 | 活动路由、API、领域服务、测试和文档均有 owner → 默认构建/E2E 覆盖恢复能力 → 删除不再是唯一实现的 legacy 快照 |

---

## 40. Space App：聊天之上的可定制空间（Active）

### 40.0 Space-first 路由迁移（P0，Verified baseline；页面形态已被 40.2 替代）

- [x] 已登录用户、产品根入口和认证完成回跳统一进入 `/spaces`，一级导航显示 Spaces，不再显示“消息”。
- [x] `/spaces` 中每一项都是一个可进入的 Space Instance，展示 Space 名称、模板/App 视觉、成员、未读和最近活动，不再呈现“联系人 + 氛围”的会话对象模型。
- [x] 进入 `/spaces/:spaceId` 后 Kernel、Chat、App 三边界同时保持可访问；返回动作回到 `/spaces`，创建 Space 后也进入新的 Space URL。
- [x] `/messages` 与 `/rooms/:roomId` 只做兼容重定向；官网、Admin、联系人、发现、支付完成页和内部导航不再生成旧 URL。
- [x] 桌面与移动端均可搜索、筛选、新建和进入 Space；Space App/Runtime 失败不得阻塞 Chat。

本组验收先允许 `:spaceId` 使用已有 Matrix Room ID 作为解析键，但产品界面、ARIA、测试 ID 和公开文档必须使用 Space 语义。完成证据需包含新旧 URL、创建后 URL、桌面/移动端截图或 DOM 结果、真实 Matrix Chat 与 App 共存结果、定向 E2E、typecheck 和 build。

2026-08-23 验证证据：

- Chromium `chat-real-product-state.spec.ts` 9/9 通过，覆盖 `/spaces` 认证守卫、Space 集合/卡片、旧 `/messages` 和 `/rooms/:roomId` 重定向、Space 详情、移动端搜索/筛选/新建/进入，以及 Space App 返回 503 时 Chat composer 仍可使用。
- Chromium `chat-matrix-room.spec.ts` 与 `chat-social-invite.spec.ts` 3/3 通过，覆盖模板创建后进入 `/spaces/:spaceId`、不透明创建弹窗、双用户邀请/加入、双向 Chat、持久消息与回复。
- 真实登录浏览器同时显示 Kernel 控件、Matrix Chat composer 与官方 Template Dev App；完整 dev 栈重启后 App state 仍恢复。`pnpm docs:check`、`pnpm build:docs`、全仓 18/18 package/app `pnpm typecheck` 与 `pnpm build` 均通过。

以上只证明 `/spaces` 路由、Matrix Chat、Runtime 与 App 并列画布可以共存。宿主固定 Chat composer/timeline 的页面形态不再是目标，不能用于勾选 40.2。

### 40.1 首版纵向链路（P0，Active）

- [x] 官方目录的 Default Chat 与四个差异化 Space Template 都声明不可变版本与 `agentos-app-v1` Project 源码，源码彼此独立且不再共享 Runtime 通用 seed。
- [x] 选择固定模板版本创建 Space 后，Runtime 幂等复制为该 `spaceInstanceId` 的独立 Project，并在首次 Agent 对话前提供 ready Dev App；重复 bootstrap 不覆盖 Agent 后续修改。
- [x] 带 v1 模板 lineage 的历史房间原地 lazy bootstrap 到兼容 Project，不创建新 Matrix Room、Space Instance 或聊天记录。
- [x] 新建模板 Space 后进入同一 Matrix 会话，两个已登录用户通过 Template App 的 Chat SDK 仍能发送、接收、回复、编辑、删除和 reaction。
- [x] 在同一 Space 发送普通文本不会创建 Agent turn；App 提交平台结构化 `@agent` Mention 后，人类消息先进入 Matrix timeline，随后 Kernel 显示唯一 Agent turn。
- [ ] 对同一 Matrix `event_id` 重试 Agent command 只接受一次；相邻 Agent 请求按接收顺序执行，publish 作为单独屏障。
- [ ] Agent 修改 Project 后 Candidate 通过校验并实时切换为当前 ready Revision；另一位成员看到相同 App 与 App state。
- [ ] Publish 将固定 ready Revision 固化为不可变 Release；后续实时更新不改写该 Release。
- [ ] Agent/Candidate 构建失败时继续运行最后 ready Revision；Kernel Bar 可以恢复 Default Chat App，Chat Core 数据不受影响。

首版完成证据需记录真实命令、运行环境、两个用户/浏览器、Matrix event id、Space instance id、draft id 与 release id。缺少 Synapse、Pi/provider 凭据或 AgentOS Runtime 时，只能记录未覆盖项，不能勾选通过。

2026-08-22 定向实现证据（尚不足以勾选本组 E2E）：

- `tests/unit/rooms/service.test.ts`、`database-repository.test.ts`、`product-client/client.test.ts`、`space-runtime/space-instance-server.test.ts` 共 10 个测试通过。
- Node 24 + Host Pi 对隔离 Space `space-smoke-host` 真实生成共享计数器；Draft `2969552e780ea11a` 的 Dev App 返回 200。
- 显式 publish 生成 Release `2a832ede…`，Live App 返回 200 且带固定 release header；未携带内部 token 的 snapshot 返回 401。
- 当前环境没有运行本地 Synapse 和双 Chromium，因此 Matrix event ID、双成员协作和完整 Chat 故障隔离尚未形成本轮证据；所有复选框保持未通过。
- `pnpm docs:check`、`pnpm build:docs`、全仓 `pnpm typecheck` 和包含 Space Runtime 的 17-package/app `pnpm build` 通过。全量 `pnpm test` 为 137 通过、1 跳过、3 个仓库已记录的 validator/email 基线失败。

2026-08-23 本地运行基线（仍不足以勾选本组 Agent/App E2E）：

- `pnpm dev` 自动复用 Node 24、准备本地 SQLite、初始化/启动 Synapse，并启动 Backend、Web、Site、Admin 和 Space Runtime；`/_matrix/client/versions`、Backend health、Space Runtime health 与 RivetKit health 均返回 200。
- Alice 的真实 session bootstrap 返回 `matrix.status=ready`，浏览器 Space 宿主显示“Synapse 已连接”和“Matrix 时间线已同步”，不再进入服务未配置保护页。
- `pnpm test:matrix:integration` 1/1 通过；Bootstrap、认证兼容、Matrix Room 创建和持久消息定向 Chromium E2E 5/5 通过。
- 本轮尚未执行双 Chromium、显式 `@agent`、共享 Draft/App State 与 publish，所以 40.1 六项仍保持未勾选。

2026-08-23 官方 Template 迁移证据（只覆盖上方前三个模板复选项）：

- `@vibechat/space-templates` unit 验证 Default Chat 与四个差异化 v4 条目拥有不同 App Project 源码、`agentos-app-v1` 格式和 v1 lineage 兼容；ProjectStore 验证重复 bootstrap 不覆盖后续自定义 Revision。
- Alice 从 v2 苔原共创室创建 Matrix Room `!JMBcNJQgAZDgcSmOpt:localhost`，首次 Agent turn 前即得到独立 SpaceInstance `space-4abc25a3-8cc2-4146-90ea-98d969063633` 与 ready Draft `85b251af233f07b6`；SDK 共享便签写入、刷新恢复和 Chat composer 共存通过，完整 dev 栈重启后 presence 仍解析为真实 `user_*` 成员而非 guest。
- 历史 v1 夜航电台 `!qcRWjoykTSidOmkOix:localhost` 没有新建 Room/Instance，在原 lineage 上 lazy bootstrap ready Draft `3a849bb6345867b5`。
- 定向 unit 13/13 通过；`pnpm docs:check`、Docs production build、全仓 18/18 package/app `pnpm typecheck` 与 `pnpm build` 通过。完整双 Chromium Agent/publish #40 E2E 尚未执行，其余复选项保持未通过。

### 40.2 实时 Space App Surface 与不可修改 Chat Core（P0，Active）

- [x] 产品文案、URL 和 Kernel 状态都把 Space 描述为持续可用、实时更新的在线空间，不出现 Workspace、试验场或“发布后才能使用”的语义。
- [x] `/spaces/:spaceId` 只有顶部 Kernel Bar 是宿主固定 UI；其下整个视口来自单一 Space App Project，不存在宿主 Chat rail、timeline、composer 或并列 App panel。
- [ ] 空白 Space 复制 Default Chat App 作为初始 ready Revision；Chat UI 本身可由模板或 Agent 完全重写。
- [ ] Default Chat App 与至少一个完全不同布局的 Template App 都通过同一 Chat Core contract：文字、媒体、回复、编辑、删除、Reaction、已读、typing、历史与错误恢复保持正常。
- [x] App 通过 SDK 查询平台结构化 agent Mention；普通消息不调度 Agent，带 Agent Mention 的消息在 Matrix event 确认后按 `eventId` 幂等执行 ACL、credits 与 queue。member Mention 的完整双浏览器覆盖仍待补齐。
- [ ] Candidate 成功后对同一 Space 的双浏览器实时切换 ready Revision；失败保留最后 ready App；Publish 只固化固定 Revision，不把 Space 从“试验”变成“可用”。
- [x] Space 冷启动期间只显示中性准备状态，不把 Default Chat App 当作超时占位；首个 ready Revision 就绪后只挂载对应 App。已有 ready App 在 Runtime 轮询、Agent 构建或暂时不可用期间保持显示，不回退到 Default Chat。
- [ ] App 文档代理对 Runtime 非 2xx 保持原始失败状态，不在 Template Project 之外合成 Default Chat HTML；Candidate 使用隔离的版本实例构建，失败后原 ready Revision 在 iframe 重载与页面刷新时仍可按固定版本读取。恢复 Default Chat App 只能由 Kernel 的显式恢复操作创建新的受管 Revision。
- [ ] App 无法覆盖/伪造 Kernel Bar，不能读取 Matrix token、伪造身份、改写 Mention 解析、绕过屏蔽/ACL/计费或建立第二条消息 timeline。

Kernel 显式恢复的定向验收：成员从可信 Kernel 菜单确认恢复 → 请求携带幂等 `requestId` 与当前 `expectedReadyRevisionId` → Backend 校验 Better Auth 与 Matrix membership → Runtime 将恢复作为不可合批的同 Space 顺序 Turn → 从官方 Default Chat Template 当前固定 Version/Artifact 生成 Candidate → Candidate ready 后原子保存为新的 ready Revision 并广播 → Published Release、Matrix timeline 与 App State 不变。相同 request ID 去重；revision 已变化、artifact 不存在或 Candidate 失败均不得覆盖当前 ready App；恢复不进入 Agent Adapter 或 credits 预留/结算。

完成证据必须包含 Default Chat App 源码、Custom Template App 源码、Host DOM 只有 Kernel Bar + iframe 的断言、两种 App 的 Chat Core contract suite、双 Chromium 实时 Revision 切换、Candidate 失败保护、结构化 `@agent` 去重和发布固化结果。

2026-08-23 第一版证据：

- Host 浏览器 DOM 只有 Kernel Bar 与单一 iframe；差异化夜航电台 App 内提供自己的 Chat drawer，新建流程默认选择 Default Chat 且允许零联系人。
- `chat-matrix-room.spec.ts` 5/5 通过，覆盖固定 Template Version Space 创建、ready snapshot 后挂载 App iframe、真实 Matrix 发送/回复/Reaction、刷新后历史唯一恢复，以及 Default compact More/390px action sheet、Campfire top-layer、Focus 抽屉和 Arcade 徽章/抽屉回归。
- `chat-matrix-operations.spec.ts` 1/1 通过，覆盖两个真实用户在同一 Template App 内的 typing、发送/接收、编辑、撤回、附件、离线失败/重试和刷新恢复。
- Space Template/Runtime/Product State 定向 unit 12/12 通过，覆盖五个不同 App Project、Default Chat App HTML 恢复、安全升级未修改内置 Project、自定义 Project 不覆盖；全仓 18/18 package/app `pnpm typecheck` 通过。
- 本证据尚未覆盖双 Chromium 完整操作、媒体/typing/Mention、结构化 `@agent`、Candidate 失败、rollback 和发布固化，所以其余复选项保持未通过。

2026-08-24 冷启动修正证据：

- ready App target 状态机 unit 5/5 通过：首次 `building` 不生成 iframe URL，ready preview 与 `draftId` 精确匹配后挂载，同一 Space 构建/重连保留上一版，切换 Space 不串用旧 snapshot/target。
- 本地 Synapse Chromium `chat-matrix-room.spec.ts` 3/3 通过；新建 Template Space 的首个 App 文档响应不包含 `x-vibechat-space-recovery: default-chat-app`，随后在同一 Template App 内完成真实发送、回复、Reaction 和刷新恢复；独立 Default 用例覆盖桌面与 390px 渐进式消息操作。
- 全仓 18/18 package/app `typecheck` 与 `build`、应用边界、文档链接和 `git diff --check` 通过。

2026-08-24 App fallback 边界修正证据（尚不足以勾选 Candidate 双浏览器 E2E）：

- Backend App 代理不再导入或合成包级 Default Chat HTML；Runtime 503 保持 503，SDK 只注入成功的 HTML。无效 revision 被产品 API 拒绝。
- Dev Preview 定向 unit 验证 Candidate 与 ready Revision 使用不同版本实例，Candidate 失败后旧 ready Revision 仍可按固定版本读取；Web 状态机验证页面刷新时从 Project `draftId` 恢复旧版本。
- 相关 Space Runtime/Template/Product State/Room unit 32/32 通过，全仓非缓存 typecheck/build 均为 18/18，文档链接、Docs production build、Cloudflare production bundle 与真实 Synapse `chat-matrix-room.spec.ts` 2/2 通过。Alice 浏览器打开默认 Chat Space 后 iframe URL 固定到 revision `95d93d0de00c212b`，Host DOM 只有 Kernel Bar + iframe，完整 Matrix Chat 在 App 内可用且没有宿主 Default Chat 闪屏。
- 尚未用双 Chromium 制造真实 Agent Candidate 构建失败并验证另一成员重载，所以“失败保持最后 ready Revision”复选项继续保持未勾选。

2026-08-23 Template Source 管理证据（目录结论已由 2026-08-24 修正）：

- 五个官方 Template 已拆为五个独立目录；当时采用的逐 Version Project 源码目录已被后续单一 `app/` 工作源码 + immutable artifact 方案替代，不能再作为当前结构依据。
- `SpaceTemplate`、`SpaceTemplateVersion` 与 `SpaceTemplateMarketEntry` 是官方/用户共用协议；官方标记只来自 `publisher.verification=official`。App 来源用户样本使用完全相同结构，以 `provenance.origin=app` 和固定 `sourceSpaceRevisionId` 记录来源。
- `/v1/spaces`、创建服务、Matrix Template snapshot、Runtime bootstrap、收藏和 Discover 已移除 `source=builtin`/官方专用布尔类型；旧 `builtin` v1–v5 与误写的 `5.0.0` ID 仅作开发数据 alias，新写入规范化为 `0.1.0` `tplv-*`。
- Runtime Project JSON 保存 Template lineage hash 与当前 Project hash；加载时拒绝 hash 不一致的文件，重复初始化不覆盖已定制 Project。
- 定向 unit `catalog.test.ts`、`product-state/service.test.ts`、`rooms/service.test.ts`、`rooms/synapse-room-adapter.test.ts` 共 14/14 通过；本地 Synapse Chromium 的 Product State 9/9 与 Matrix Space 2/2 通过；全仓 18/18 package/app typecheck/build、文档链接检查和 Docs production build 通过。用户发布 API/审核和生产 Product DB/Object Store 仍未完成。

2026-08-24 Template 版本治理证据：

- 五个尚未正式发布的官方 Template 从误写的开发轮次 `5.0.0` 一次性纠正为首个有序基线 `0.1.0`；Project source 保持不变，Version manifest、repository provenance、source/manifest lock 与生成目录同步重签。
- 共享 registry 与官方 codegen 同时拒绝非规范 SemVer、非 `0.1.0` 首版、跳号/倒序/重复、非最高 current、空载荷升版和已锁版本漂移；Template schema、SDK/Runtime 与 Space Revision/Release 不触发 Template 升版。
- 旧 `builtin` v1–v5 与误写的 `tplv-<template>-5-0-0` 均只读兼容到当前 `0.1.0`，新市场响应和 Space lineage 只签发规范 Version ID。
- 定向 unit 15/15、Product State Chromium 9/9 通过；真实登录页面的创建流程显示五个 `App 模板 v0.1.0`。全仓 19 个 workspace project 的递归 typecheck/build、Docs production build、文档链接、应用边界、catalog codegen 与 `git diff --check` 通过。

2026-08-24 Template Source 单一项目树修正证据：

- 每个官方 Template 只维护 `official/<template-id>/app/` 一份工作源码；`releases.json` 扁平追加发布元数据，不再按 SemVer 创建或复制源码目录。
- Template Version 与市场条目都携带统一 `SpaceTemplateArtifact` 引用；生成目录不内联 App source。开发 Node provider 校验当前 `app/` hash，生产 Runtime 按 artifact ID 从统一 Registry/Object Store 解析，官方固定 Git revision 与用户固定 ready Revision 使用同一 artifact 协议。
- catalog codegen、定向 unit 15/15、全仓 19 个 workspace project 的递归 typecheck/build、文档链接、Docs production build 与 `git diff --check` 通过；本地 Synapse Chromium 的 Product State 9/9 与 Matrix Space 2/2 通过，覆盖市场 Artifact 数据、固定 Template Version 创建、App iframe 真实聊天和刷新恢复。

2026-08-24 Template App 多文件项目修正证据：

- 五个官方 App 与 Runtime seed 已把 `src/index.ts` 收敛为约 250 字节的装配入口，Runtime、page、Template App 和默认 Chat UI 分为至少 9 个源码模块；`src/index.ts` 不再内联整页 HTML/CSS/浏览器脚本。
- Template Registry、codegen、Node Artifact provider、Space Project Store、Dev Preview 和 Host/AgentOS Agent 工作区均改为完整项目树协议：保留三个历史入口的 canonical 顺序并对新增路径稳定排序，嵌套文件参与 hash，三个必需入口不是白名单；路径穿越、隐藏文件、依赖/构建目录、符号链接、文件数与大小越界被拒绝。迁移后本地已有 25/25 Space Project 均通过 sourceHash 加载校验。
- 新建 `space-campfire` 测试 Space 从 11 文件 Artifact 完成真实 Runtime bootstrap，Dev VM 成功转译模块依赖并返回 200、`夜航电台` 标题与 Default Chat App marker。Space Runtime/Template 定向 unit 18/18、五个官方 Project 与 seed 独立 TypeScript 编译、catalog check、全仓 18/18 typecheck/build、Docs production build、文档检查和 `git diff --check` 通过。

2026-08-24 AgentOS Release 兼容 patch 与 Kernel 恢复证据：

- 五个官方 Template 在唯一 `app/` 工作树导出 AgentOS `registry`，按 `0.1.0 → 0.1.1` 相邻 patch 追加 manifest、source/manifest lock、artifact 引用与 CHANGELOG；旧 lock 未覆盖且不存在版本源码目录。
- 本地 AgentOS Build VM 使用显式 DNS；Agent 生成约束同步要求入口导出 `registry`。Alice 的现有 Space 经 Kernel 恢复到 `space-default@0.1.1` Revision `2d68a0defce3aac1`，原 Matrix 消息保持，随后成功固化 64 位内容寻址 Release。
- 显式发布归属 Kernel；Host 只把真实 Agent reply 投影给 App，不把恢复、发布或 Runtime error 伪装成 Pi/成员聊天。相关 unit 33/33、五个官方 App 与 Runtime seed 严格 TypeScript、真实 Synapse Matrix Space 2/2、全仓 18/18 typecheck/build、边界和文档检查通过。

2026-08-24 本地 Engine 生命周期与 Published Release 重启证据（尚不足以勾选生产多副本接管）：

- 根 `pnpm dev` 启动仓库托管的 Rivet Engine 并等待健康后再启动应用，Engine 使用固定 filesystem 数据库；正常退出时端口 `6420` 释放，数据库、Actor 与 Release 保留。若端口已被未知 Engine 占用，启动器失败关闭而不终止未知进程。
- Alice 的同一 App/ready Revision 在完整停止并重新启动 Synapse 以外的开发栈后，通过同一 Published Release `4b3802b5db16fe23e62228477f9b2d8a798fde0abef1676bee8ed3d9a2e468c4` 返回 HTTP 200；Scaler 丢弃旧 boot 的 replica `/0` 并创建 `/1`，没有重新生成 Template Version、Project、Draft 或 Release。
- 本证据覆盖本地单 Runtime 的 Engine 持久化和死亡 VM 租约恢复，不覆盖两个 Runtime replica 竞争 lease、interrupted Turn 回队首或账务 reconciliation，因此场景 14 和 S4 完成条件保持未通过。
- 重启后的首次 Live 请求返回 200、固定 release header 和一个新 replica；紧接的热请求在 `58.760 ms` 返回相同的 24,168-byte App，`cold-start=0`、queue delay `0 ms`。定向 unit 31/31、真实 Synapse Chromium Matrix Space 2/2、全仓 18/18 typecheck/build、Docs production build、文档和应用边界检查通过。

2026-08-24 结构化 Agent Mention、欢迎积分与真实 Pi 用量证据：

- 2026-08-24 走查时，新账号通过 Better Auth `databaseHooks.user.create.after` 获得当时配置的 100 欢迎积分；交易 ID 固定为 `signup:welcome:<userId>`，同一账号重复执行不会重复入账，`CREDITS_NEW_USER_GRANT=0` 可关闭。
- 2026-08-26 当前默认欢迎额度调整为 1000；真实注册 E2E 要求 `/api/credits/status` 的余额与累计购入均为 1000，且账本只有一条 `new_user_bonus`。
- Default Chat App 发送 Agent Mention 时把 `io.vibechat.agent_mentions` 结构化 metadata 与人类消息一起写入 Matrix；Backend 再读取该精确 `eventId`，核对 sender、事件类型、Agent target、Space membership 与实例 allowlist 后才预留积分和入队，不再用消息文本正则决定是否调度。
- Alice 在真实 Synapse Space `!JMBcNJQgAZDgcSmOpt:localhost` 中发送 `@pi` 后，Matrix 人类消息先进入 App timeline，Kernel 显示 Agent 处理中，系统 Host Pi 以确定性 UUID session 和 `deepseek/deepseek-v4-pro` 返回“积分与 Agent 对话都已打通。”；Project 未发生源码变化。
- 该成功 turn 上报 Pi 的真实 `input/output/total` usage。4,839 tokens 先预留 4 credits，再幂等补扣 1 credit，Alice 余额由 100 变为 95；此前失败的两个 turn 均各自只产生一次 4-credit 退款。批次 usage 按整数余数稳定分摊，所有 tokens 只结算一次。
- 开发栈干净重启后，Alice 再次收到 Pi 的真实回复；随后要求 Pi 把背景改为深蓝色 `#07162b` 且不发布。Pi 修改 `src/app/styles.ts`、`src/chat/styles.ts` 和 `src/app/client.ts`，保留完整 Chat Core，iframe 精确版本从 `2d68a0defce3aac1` 热更新为 `46f337b6b99d8f27`，Project 的 `publishedDraftId=2d68a0defce3aac1` 与 Release `4b3802b5…` 均未变化。该修改 turn 上报 29,856 tokens，预留与补扣合计 30 credits；Alice 最终余额为 59。
- 当前证据是单 Chromium 的真实服务走查加定向 unit，不是场景 5/13 的完整双浏览器自动化；Agent 回复仍由 Runtime 投影到 App，尚未写成 Matrix virtual-user event，因此对应场景继续保持 Active。

2026-08-25 Template App 模块化与 Composer 修正证据：

- 五个官方 Project 将浏览器 SDK 视图、消息投影、Composer、启动订阅、Template controller 与 CSS 分区拆为可独立阅读和严格类型检查的源码模块；`src/index.ts` 仍只装配 Runtime，未新增包级 Default Chat fallback，也未按版本复制源码目录。
- 全屏 Default Chat 隐藏与 Kernel Bar 重复的 App Header；附件按钮、可伸缩 textarea 和发送按钮进入同一 Composer grid，Timeline 与 Composer 使用正常文档流。五个 Project 渲染后的 module script 均可解析，官方 Catalog 固定签发相邻 patch `0.1.2`。
- Alice 的定制 Project 以 `space-default@0.1.2` 为基线保留原有深蓝动态 App 代码，经 Runtime Candidate 构建成功后将 ready Revision 从 `644b173f6420e62d` 切换为 `b942d96a821f9542`；Published Revision `2d68a0defce3aac1` 和 Release 均未变化。
- 定向 unit 13/13、五个 App Project 严格 TypeScript、Catalog codegen、全仓 typecheck/build 18/18、Docs production build、文档链接、应用边界和 `git diff --check` 通过。浏览器视觉走查被本地 URL 安全策略拒绝，场景 3/4 的最终视觉确认不据此标为自动化通过。

### 40.3 Space App 基础组件库（P1，Active）

- [x] `@vibechat/space-app-components` 是独立 workspace/package release unit，拥有显式 `/foundation|user|agent|chat`、`/chat/inline`、`/register/*` 与 manifest exports、独立依赖和构建门槛；仅 registrar 是 side-effect entry，普通领域入口保留 ESM module boundary 供 tree-shake。组件只接收注入的 `SpaceAppClient`，不创建第二个 SDK 或连接 Matrix/Backend/Agent provider。
- [x] 构建生成 `vibechat.space-component-bundle/v1` manifest，固定 package version、SDK range、Project format、exports、CSS token version、source hash 与 artifact hash；browser bundle 和离线 catalog 不依赖 npm/CDN 或新增 Host capability URL。
- [x] `@vibechat/space-app-dependencies` 通过 exact package version + `space-app-dependencies.json` integrity + 注入式 Registry 生成 prepared artifact；stored source 保持普通 package import，generated vendor/resolved manifest 只存在于 build artifact，内容漂移会 fail closed。
- [x] Runtime Dev、Publish、手工 deploy 与 cold start 共用 prepared artifact；source/prepared 分别使用 `sourceObjectKey/sourceHash` 和 `artifactObjectKey/artifactHash`，旧无 lock Space 保持原 Revision ID 算法，任意现有 Space 可在后续 Revision 添加依赖。
- [x] 相同 component artifact 在本地真实 Rivet/AgentOS Dev 与完整开发栈冷启动恢复中保持同一 hash/ready Revision。
- [x] Managed publish 把规范化 package object 写入私有内容寻址 Object Store，并登记不可变 name/version/integrity/project formats/object key/hash；相同版本同内容幂等，相同版本内容漂移冲突，Runtime 只读凭证不能发布。
- [x] Runtime 在没有 workspace package、`dist/package` 或本地 Registry cache 的冷启动中，按 exact name/version/integrity/project format 从远程 Registry 同时解析 `0.7.4` 与 `0.8.1`；对象缺失、pointer/hash/envelope/file integrity 篡改全部 fail closed，最后 ready Revision/Published Release 与 Existing Space 依赖版本不变。
- [ ] 相同 component artifact 在不可变 Release、生产 Object Store 和跨 Runtime 恢复中保持同一 hash；Registry 缺失或 hash 不匹配时 Candidate 失败且最后 ready Revision 不变。
- [ ] Default Chat 与至少一个抽屉式 Template 固定同一组件版本，只保留各自布局、主题和场景代码；Chat Core contract、双浏览器 Matrix timeline 与 Existing custom Project 不静默升级。
- [ ] User/Agent identity 和 Chat 组件覆盖 keyboard、IME、screen reader、200% 字体、high contrast、reduced motion、长文案、图片失败、空/错/disabled/权限拒绝状态。

2026-08-27 Default Chat package/Registry 迁移证据：`space-default@0.1.3` 已改用语义化 `@vibechat/space-app-components/chat/inline` import、exact `0.5.0` dependency 和 managed integrity `sha256:9754fd6cb4b084c3c23c7f945a4e8784192ed04aa2b1b3fb8517bc8b4e780049`，相对 vendor module 已删除。组件 source/browser artifact hash 为 `sha256:5152dfc65729876657a2fa3eece6665081091562feb25653395b79d177e16be5` / `sha256:5470312b1b770ef19e7dcd3c6655219b23a17711f4b2fffdce211a9a1213954d`；Template source/artifact hash 为 `sha256:a3c634456525b7aab93ff3ade653e49832adb10eb05ba99c7dcde3a5a9211526`，manifest hash 为 `sha256:7a614d15d2d7c7ab07e93cad8b5a034ebfad78e91f8d5341dace417f9f1c2bca`。定向 10 files、49 tests 覆盖 exact lock、旧 Space 后加依赖、Registry/hash/path fail closed、Dev import materialization、冷启动缓存、prepared tamper、source/artifact Object Store 分离和最后 ready Revision 保留；Node 24 下完整 Runtime unit 为 14 files、38 tests。此前 mock SDK 单 Chromium 的 1280px、390px、200% 等效 640px、结构化 Mention、44px touch target和无溢出/console error 证据保持有效。Git 不保存逐版本 package，生产 Object Store publish、真实 Synapse 双浏览器、AgentOS Dev/Release/重启和完整 screen-reader/high-contrast/reduced-motion 尚未执行，因此上方真实复合场景保持未勾选。

2026-08-27 本地真实 Runtime 验收补充：Alice 通过 Web 与真实 Synapse 创建 Default Chat Space；Rivet/AgentOS Dev VM 用 prepared artifact `sha256:2548105d1ea72db86dbe3c9eec6960698de3e05e18ca51552771b29a5d4aca40` 生成 ready Revision `2548105d1ea72db8`，完整停止并重启 `pnpm dev` 后恢复同一 revision。响应实际包含组件版本 `0.5.0`；单 Chromium iframe 中 `vc-space-chat-composer` 已注册为 open Shadow DOM，Timeline、附件、textarea 与发送按钮可见，空文本发送禁用且重载后无新 console error。本轮修复了 prepared `.d.ts` 被错误送入 emitter、以及 CSP 未允许既有 `/chat/inline` Blob ESM 两个缺口，回归测试 2 files、9 tests 通过。没有发送消息，也没有生成不可变 Release；生产 Object Store、跨 Runtime、双 Chromium Matrix 交互和完整 screen-reader/high-contrast/reduced-motion 仍未验证，因此其余复合场景保持未勾选。

2026-08-27 Default 审计补丁 Spec/工程证据：Host snapshot 增加 fail-closed `chat.permissions`，message view 只从显式 permission + ownership/status 生成 reply/edit/delete/retry/react availability；交互 Timeline 自己组合 Actions/Reaction、导出稳定 `chat-message-entry` 与 action/reaction parts，并在交互 Reaction 可用时隐藏重复的只读 Reaction。`space-default@0.1.4` 固定本地签锁的 `@vibechat/space-app-components@0.6.0`（integrity `sha256:4187cc990c2ed9aea01fdd596535593e22460d77e28ca7b2d143ae7184be9b25`），不再读取 Timeline `shadowRoot`/私有 `data-message-id` 或注入样式；read receipt 只在 Chat 打开且 document 可见时按最新 message ID 去重发送，dock unread 增量累积。E2E 在恢复 Default 前保留 Campfire 旧 DOM 断言，恢复后改用 `chat-message-entry` 和 Reaction button accessible name。组件 source/browser hash 为 `sha256:23e09f9e83642f353849a832033dfac33faca5834fa3737bb4d072438df28565` / `sha256:7b9dcf2cc12de5fda6aa2f0eacc96f4bdbc73fc5faf12c641b0087c48c0a5b50`；Template source/manifest hash 为 `sha256:446fa544386fe4f1b95b8a6f6e99b1e3dc402f1544ea2b85eb2b9603610b09ce` / `sha256:b4384f73bac9a1bf48a57b1fd4146556f4f2596109c2615083eedc230916c691`。定向 5 files、30 tests 与 package/bundle 校验通过；生产 managed publish、真实 `0.1.4` ready Revision/Release、双 Chromium Matrix/a11y E2E 未执行，复合场景保持未勾选。

2026-08-27 Default 操作密度修复最终证据：`@vibechat/space-app-components@0.7.0` 新增 standalone opt-in `MessageActions.compact/reactionChoices`、`getSpaceChatMessageGroupPositions()`、action menu/reaction choice parts 与英中内建文案；交互 Timeline 默认只组合真实 Reaction 和 compact More，不再合并 0-count 候选或保留 Message 内只读 Reaction。More 使用 authored SVG，覆盖焦点进入/循环/恢复、Escape、外部点击、关闭后 Delete 确认复位、viewport-aware 桌面浮层、390px action sheet/backdrop、forced colors 和 reduced motion；等价 snapshot 更新不移动既有 Timeline entry 或重建菜单。组件 source/browser hash 为 `sha256:c22df8454e0866229dd596c5b0938d3a255398a0ac37f60dc6cc0bc36745d7d7` / `sha256:60e66b2f9e2db6d595fa9c7bd66cd749624db7aa51ed3c43c3e65d76edc44c83`，integrity 为 `sha256:7640548144e75ce7305d893c26e43f2ae14d1c6adefdd099cd58af80d54e3103`，browser/chat gzip 为 25,431 / 21,804 bytes；Default source/manifest hash 为 `sha256:5e26e8fc2d6cf530bfff971b94029ba32d366cb90c8daf42d8115cc5ccce4449` / `sha256:8e3363f923328a46b9b668488d4a3753c6a8e214bd332b5a4646162a4f725dfa`。定向 unit 7 files、43 tests 和 `chat-matrix-room.spec.ts` 3/3 通过；当前本地验收 ready Revision 为 `04b4b51`。生产 managed publish、不可变 Release、双 Chromium 同房交互和完整 a11y 矩阵仍未执行。

下一抽屉迁移切片 Spec：`space-focus@0.1.3` 使用与 Default 相同的 exact `@vibechat/space-app-components@0.7.0` 和 managed integrity。共享便签桌面的 markup/state/theme 保持不变；Chat launcher 打开抽屉后，由同一个公共 controller snapshot 驱动 Timeline、Composer、Mention、附件、Reaction、消息操作、错误与 read receipt，不再保留 Template 自有 message renderer/composer/state machine。验收必须确认 `space-focus@0.1.2` release lock 未改写、既有 Space 不自动升级、抽屉关闭时 unread 累积且打开后清零，并在真实 iframe 中覆盖 Matrix 发送/回复/Reaction/刷新恢复；这些证据未齐前，上方双 Template 复合场景保持未勾选。

2026-08-27 Focus 迁移证据：`space-focus@0.1.3` source/manifest hash 为 `sha256:6b42d106b6da65979810dda9ae93f7dafa977b37d4cdc51fafac26c8761080a2` / `sha256:8c4fa05b215b53c64a65b53e8bbc98fedf507e33c7c4518aa7c8b9c7450f7f34`，固定 `@vibechat/space-app-components@0.7.0` 和 managed integrity `sha256:7640548144e75ce7305d893c26e43f2ae14d1c6adefdd099cd58af80d54e3103`。Catalog unit 保留 `0.1.2` release lock 并确认相邻 `0.1.3` 为 current development version；真实 Matrix 单 Chromium `keeps Focus notes and docked Chat stable across refresh and responsive layouts` 通过，覆盖共享便签、dock launcher、关闭时 unread/打开清零、发送、回复、Reaction、刷新恢复及 390px iframe 可用视口。Impeccable detector 只有共享工作台网格背景的 advisory；该网格表达真实桌面/测量表面语义，保留为既有 Focus 视觉。双 Chromium 同房交互、Existing custom Project 的端到端不升级证据、不可变 Release 和生产 managed publish 仍未执行，因此上方复合场景继续未勾选。

2026-08-27 Popover top-layer 与 Campfire 迁移最终证据：Default `0.1.6`、Campfire `0.1.5`、Focus `0.1.6` 固定 exact `@vibechat/space-app-components@0.7.4` 与 integrity `sha256:4a7d7296653b0164005283b5d836788300504e1d7590f803bbd2ba52fd15e201`。组件 source/browser hash 为 `sha256:38aa4979ee10c2e54004e6c50824b1fd97b2e71b22f3fbe3cdc8705c84669578` / `sha256:7c53377c043aaad983c14b63eec9ed28246dcaf888953a27147afccb317d3d4f`。compact More 在支持 Popover 时进入 top layer，只使用 native light-dismiss/toggle/`::backdrop`；无 Popover 时保留 fixed/backdrop/document fallback。Campfire/Focus 恢复原抽屉 transform 与 `blur(26px)`，真实 E2E 仍能完成 More、回复、Reaction，未再触发 Chromium renderer crash。390px action sheet 两侧各 12px，外部点击与 Escape 均关闭并恢复 trigger 焦点。`chat-matrix-room.spec.ts` 整文件 4/4 通过，Impeccable detector 返回空结果。生产 managed publish、不可变 Release、双 Chromium、Existing custom Project 端到端不升级和完整 screen-reader/high-contrast/200% 字体矩阵仍未执行，因此上方复合场景继续保持未勾选。

Arcade 迁移切片 Spec：`space-arcade@0.1.3` 必须固定 exact `@vibechat/space-app-components@0.7.4` 与同一 managed integrity，保留像素徽章计数、共享 signal、presence、主题和原抽屉 transform/`blur(26px)`；Template 自有 renderer/Composer/Mention/message state machine 必须删除。真实 iframe 验收覆盖徽章写入与刷新恢复、共享 Chat 发送/回复/Reaction、抽屉 unread、刷新后 Matrix 历史唯一恢复、组件版本标记和 390px 可用视口；`0.1.2` lock 与既有 Space 不得被原地改写。这些证据齐全前不得把 Arcade 或 C5 标记 Complete。

2026-08-27 Arcade 迁移证据：`space-arcade@0.1.3` source/artifact hash 为 `sha256:6cfd57f84f9972b3f1081817c70dba189ef1e96cdd3fcd899a1ecc5ebb12dd6e`，manifest hash 为 `sha256:46366ddea6e8e441bd9d25fb5e9252ccfbee9f3b632dbbe7b26e96a96d03cc69`，固定 exact `0.7.4` 与 integrity `sha256:4a7d7296653b0164005283b5d836788300504e1d7590f803bbd2ba52fd15e201`；`0.1.2` lock 未改写。Template 已删除自有 composer/dom/messages/render，真实单 Chromium 场景覆盖徽章写入/刷新恢复、共享 Chat 发送/回复/Reaction、抽屉 unread、历史恢复、组件版本标记、active transform + `blur(26px)` 和 390px 全视口。`chat-matrix-room.spec.ts` 整文件 5/5，Catalog unit 9/9，Template/Arcade TypeScript 通过，Impeccable detector 返回空结果。生产 managed publish、不可变 Release、双 Chromium、Existing custom Project 端到端不升级和完整 a11y 矩阵仍未执行，因此 C5 保持 Active，下一迁移目标为 Postcard。

Postcard 迁移切片 Spec：`space-postcard@0.1.3` 必须固定 exact `@vibechat/space-app-components@0.7.4` 与同一 managed integrity，保留 `postcard.messages`、最多十张卡片、寄出表单、presence、暖纸张主题和原抽屉 transform/`blur(26px)`；Template 自有 renderer/Composer/Mention/message state machine 必须删除。真实 iframe 验收覆盖写入一张明信片及刷新恢复、共享 Chat 发送/回复/Reaction、抽屉 unread、刷新后 Matrix 历史唯一恢复、组件版本标记和 390px 可用视口；`0.1.2` lock 与既有 Space 不得被原地改写。这些证据齐全前不得把 Postcard 或 C5 标记 Complete。

2026-08-27 Postcard 迁移证据：`space-postcard@0.1.3` source/artifact hash 为 `sha256:92d5f04f6f2c351fba6e0e61cd5a69bfbdf6ed1ca5f3922211ddc5f2c3c28360`，manifest hash 为 `sha256:0ecadc2d72e2464d57995e731e96ae18de940bbf186a5b0f19c7a2dd5954fad4`，固定 exact `0.7.4` 与 integrity `sha256:4a7d7296653b0164005283b5d836788300504e1d7590f803bbd2ba52fd15e201`；`0.1.2` lock 未改写。Template 已删除自有 composer/dom/messages/render，真实单 Chromium 场景覆盖卡片写入/刷新恢复、共享 Chat 发送/回复/Reaction、抽屉 unread、历史恢复、组件版本标记、active transform + `blur(26px)` 和 390px 全视口。`chat-matrix-room.spec.ts` 整文件 6/6，Catalog unit 9/9，Template/Postcard TypeScript 通过，Impeccable detector 返回空结果。生产 managed publish、不可变 Release、双 Chromium、Existing custom Project 端到端不升级和完整 a11y 矩阵仍未执行，因此 C5 保持 Active；五个官方 Template 的共享 Chat 源码迁移已完成。

Recipe 第一切片 Spec：`@vibechat/space-app-components` 以向后兼容 minor 版本新增语义化 `/recipes` 与 `/recipes/inline`，保留 `/chat`、`/chat/inline`、typed event、token、part 和 Custom Element 契约。`mountDefaultChatRecipe` / `mountChatDrawerRecipe` 必须只接收注入 context、Template copy 和既有元素，统一 controller snapshot、Timeline/Composer/Mention/Error 装配、unread、可见时 read receipt 与幂等 dispose；不得读取全局 `space`、固定主题/launcher/场景状态或新增 Matrix/Agent/Kernel 权威。Default/Focus 分别签发相邻 development `0.1.7` 作为 full/dock 两个真实消费者，删除重复 bootstrap 主体并固定 exact component version/integrity；其历史 lock、另外三个 `0.7.4` Template 和 Existing Space 不得自动升级。真实 iframe 回归继续覆盖发送/回复/Reaction、刷新恢复、抽屉 unread、Popover/action sheet 和 390px 布局；package/unit 还需覆盖事件 listener 只装配一次、dispose 后无 listener/read/typing 副作用、不可见时不 mark read，以及 recipe bundle gzip/SSR/offline 约束。

2026-08-28 Recipe 迁移证据：`@vibechat/space-app-components@0.8.1` source/browser artifact/integrity 分别为 `sha256:9383001b8b7262f9258a8965313654fe99796912fdaea281050079cc07133d73`、`sha256:4d776ed99e9062571daf71bdb432314b1ff952dd872f8f661530afc6e453a905`、`sha256:6d980005ca07a1a9ac76dad9c18524bb3e1885261616252f949d9787af996dc2`；Recipe gzip 为 23,059 bytes。Default `0.1.7` source/manifest 为 `sha256:2773c71af78fadc791978669d30d8ed5ed2aaa3b2e10448efff3a5f3b0b66651` / `sha256:466f81bb1feabdc3b8d31358cc73905846f5e53760e4f86b8dc41720ed16cc47`，Focus `0.1.7` 为 `sha256:93daabc0d3e9c199d27912b0f11ac19f46e93c291df79e028db5f7a87cb31c3e` / `sha256:ebbdf498767ab5b83f707cd510348caa69a6e68067e86a00ec11482f95719ee3`。components/dependencies/templates 定向 unit 7 files、45/45；`chat-matrix-room.spec.ts` 真实单 Chromium 全文件 6/6，Default/Focus 分别断言 `0.8.1` full/dock Recipe，Campfire/Arcade/Postcard 继续断言 `0.7.4`。inline bundle 已显式注册 Timeline/Composer/Mention/Error；本地 Registry 以 gitignored exact-version cache 同时解析两个版本，错误 integrity fail closed。生产 managed publish、不可变 Release、双 Chromium 和完整 a11y 矩阵仍未执行。

2026-08-28 managed Registry/Object Store 接线证据：`vibechat.space-app-managed-package-object/v1` 规范化 JSON envelope 是主发布对象，npm tarball 只作为可选 mirror。PG/SQLite schema 与 0014 migrations、新的 immutable repository/service、publisher/Runtime credential 隔离和 production-only remote provider 均已接入；定向 10 files、31/31 tests 覆盖多个精确版本、幂等、漂移、缺失/篡改、错误权限和 Existing prepared Project 不升级。隔离 D1 已从 0000 应用到 0014；workerd/R2 实跑发布 `0.7.4` → object `5ac435ac84e0…`、`0.8.1` → `03c2a80bb33d…`、发布工具 patch `0.8.2` → `18fc0fdfa6b7…`，重复发布返回 Verified，漂移返回 HTTP 409。Runtime 远程 provider 在无本地 package 参与下解析 `0.7.4` 66 个文件与 `0.8.1`/`0.8.2` 各 74 个文件。`0.8.2` 只更新 package README/发行工具，browser artifact 仍为 `sha256:4d776ed9…`；Default/Focus 继续固定 `0.8.1`，历史锁未重签。Backend Node/Cloudflare build、Runtime/Backend/components typecheck 均通过。真实部署 publish、不可变 Space Release、跨 Runtime 恢复、双 Chromium 和完整 a11y 矩阵仍未执行，因此后续三个复合项保持未勾选。

Agent activity P0 DOM/API 验收场景（先写 Spec，再迁移 Template）：

- [x] `createSpaceAgentActivityView(snapshot.agent)` 只投影 provider-neutral name/status/stage、active/pending count 和数量受限的 activity label/detail；`input/output/arguments/payload`、provider/model、credits、turn source 和 Kernel 控制字段不进入 view model 或 DOM。
- [x] `createSpaceAgentController(context)` 只复用注入的 `SpaceAppClient` 并订阅 Agent snapshot；等价更新不重复通知，`dispose()` 幂等释放 listener，组件库不增加 `agent.invoke()` 或第二个 Agent/SDK client。
- [x] `vc-space-agent-queue-status` 与 `vc-space-agent-activity` 同时提供可见文本和 polite live region，不用颜色作为 queued/working/completed/failed 的唯一信号；长 stage/activity 在 390px、200% 字体下无横向溢出，forced colors/reduced motion 有显式 fallback。
- [x] `mountAgentActivityPanelRecipe` 只把标准 element 接到只读 controller，不拥有 Template 主题、场景状态、Agent 调度或 Kernel 操作；Default Chat 与一个抽屉式 Template 显式升级 exact component version 后，删除各自手写 build panel 投影并保持 Matrix Chat/ready Revision 行为不变。
- [x] Default `0.2.0` full 与 Focus `0.2.0` dock 的生成文档都从 `recipes/inline@0.9.1` 注册 Agent Activity；同一 mock SDK/context 的 working stage、queue 和有限 activity 在 390px、200% 字体、forced-colors/reduced-motion 下无横向溢出、无 console error，且源码不再包含 `vcc-build` 投影。
- [x] `/agent`、`/recipes` 与 `/recipes/inline` 保持 SSR-safe、无远程 import、领域 tree-shaking 和 bundle budget；离线 catalog 在两套主题中使用同一 Agent activity DOM，并固定到同一 package/artifact hash。

2026-08-28 Agent activity package 证据：`@vibechat/space-app-components@0.9.0` 新增只读 view/controller、`vc-space-agent-queue-status`、`vc-space-agent-activity` 与 `AgentActivityPanelRecipe`，source/browser artifact/integrity 为 `sha256:b522904eaf23c94cda1850d5f49e52a7187dc13ffaf92b7bd699cb81e6e98856` / `sha256:dfa862ed56a5a5c098054ed84928ab30ad8d8ceca4a0b7961d8ab4b1685956c4` / `sha256:e4addfc9684062d79d192bde3c847185248b9930a46e390c357e7a624793a73e`。组件 TypeScript、34/34 package unit、semantic export/SSR/offline/managed integrity gate 通过；agent/recipes gzip 为 7,465 / 26,055 bytes。离线 catalog 单 Chromium 的两主题 DOM 均暴露 Agent activity group、polite status、identity、stage、queue 和文字 activity；390×844 下页面 `scrollWidth === clientWidth === 390`、无 console warning/error。真实 Template 尚未升级，screen reader、200% 字体和强制 high-contrast/reduced-motion 浏览器矩阵未执行，因此后两项复合 a11y/迁移场景保持未勾选。

2026-08-28 Agent activity Template 迁移证据：兼容 patch `@vibechat/space-app-components@0.9.1` 的 source/browser/integrity 为 `sha256:511ca97c185edf3d4e5c2cb595005d9ecf3bf920a7a8ec63a21f414993e34785` / `sha256:92259060a408554cd5d91c22e6135380074bc957e366a82d2e5b35e75b3a9899` / `sha256:bf9d6ee624ca368380df425e9d284c9345ef255ecc5ac59c9233f58575ee6b68`。Default/Focus 相邻 development `0.2.0` 固定该 exact version/integrity，复用同一 SDK/context 挂载 full/dock Chat Recipe 与 Agent Panel Recipe，删除手写 `vcc-build` DOM/CSS；完整旧 build DOM 仍兼容、全缺失使用 detached hidden placeholder、部分缺失 fail closed。`space-template-agent-activity.spec.ts` 隔离 Chromium 2/2，通过动态 long stage、1 active/2 pending queue、两条 activity、polite live region、390px、200% 字体、forced-colors/reduced-motion、无动画、无横向溢出、Composer 可见和无 console/page error。当前证据不包含真实 Matrix/AgentOS ready Revision、screen reader、生产 publish 或不可变 Release。

阶段 1 identity DOM 验收场景（先写 Spec，再实现 selector）：

- [ ] 同一份 `vc-space-user-*` / `vc-space-agent-*` DOM 在 dark signal 与 light field-note 两个容器中渲染；主题只覆盖 `--vc-space-*` token，组件标签、view model 和身份文案不分叉。
- [ ] UserInfoCard 的长 display name/handle 在 390px 与 200% 根字体下不产生页面横向溢出；图片加载失败后保留 initials 与可访问名称。
- [ ] IconButton 是原生 button 语义，具有可见 focus、44×44 touch target、disabled/loading 状态和非空 accessible name；键盘 Enter/Space 不依赖自定义 click 模拟。
- [ ] User presence 与 Agent idle/queued/working/unavailable/failed 均同时提供文本和视觉信号；Agent badge 明确区分成员与 Agent，不暴露 provider、模型、积分或 Kernel 操作。
- [ ] 所有 identity element 可重复注册、SSR import-safe；Custom Element disconnect/reconnect 不创建 SDK、timer、observer 或泄漏 listener，high contrast/reduced motion 有显式 CSS fallback。

阶段 2 Chat timeline 第一切片 DOM/API 验收场景（先写 Spec，再实现 selector）：

- [ ] `createSpaceChatMessageViews(snapshot)` 只按 `snapshot.chat.messages` 的既有顺序投影 Matrix timeline，不合并 `snapshot.agent.messages`；unknown member、Agent identity、缺失/已删除 reply、edited、sending/sent/failed 与 reaction count 均有稳定只读 view model。
- [ ] `createSpaceChatTimelineController(context)` 分别订阅 messages、typing、members、mentions 与 agent；typing 或仅 presence 变化不替换 messages 数组引用，identity 变化才重新投影 author，`dispose()` 幂等释放全部 listener。
- [ ] 同一份 `vc-space-chat-message` DOM 在 dark signal 与 light field-note 容器中组合 `vc-space-chat-message-meta`、`vc-space-reply-preview`、`vc-space-chat-bubble` 与只读 reaction；组件只通过 typed property 或安全 attribute 接收内容，所有用户文本写入 `textContent`，不接受 HTML。
- [ ] own/member/Agent、long message、缺失 reply、deleted、edited 与 failed delivery 在 390px 和 200% 根字体下不产生页面横向溢出；作者、时间、Agent 类型、reply fallback 和 delivery 不能只靠颜色表达。
- [ ] `vc-space-typing-indicator` 使用 SDK typing member IDs 投影的身份文本并提供 `role=status`/live region；typing 更新不得重建完整 timeline，unknown typing member 有稳定 fallback。
- [ ] Chat elements 使用 open Shadow DOM，公开 `::part`，可重复注册且 SSR import-safe；forced colors、more contrast 与 reduced motion 有显式 fallback，离线 bundle/catalog 不请求 npm、CDN 或 Host capability。

阶段 2 Chat Template 迁移就绪 DOM/API 验收场景（先写 Spec，再迁移官方 Template）：

- [ ] `createSpaceChatController(context)` 复用注入的 `SpaceAppClient` 并覆盖 `send/attach/edit/delete/toggleReaction/retry/setTyping/markRead`；每个命令暴露确定性的 pending/error 状态，失败后保留 draft/context 并可清错重试，`dispose()` 会停止 typing timer、发送一次 `setTyping(false)` 并释放全部 listener。
- [ ] Composer 使用原生 form/textarea/file/button 语义；textarea 自动扩展但不遮挡 timeline，Enter 发送、Shift+Enter 换行、IME composition Enter 不发送，空白/command pending/disabled 状态不提交重复命令，附件选择通过 typed event 传递原始 `File`。
- [ ] Mention 由 `space.mention.search(query)` 的结构化 target 驱动；选择时保存明确 `mentionIds` 并传给 `chat.send`，member/Agent 类型和 unavailable 状态有文字语义，ArrowUp/ArrowDown/Enter/Escape 可完整操作，不扫描 draft 中的 `@handle` 猜测 Agent 调度。
- [ ] Timeline 容器分别呈现 loading/empty/error/ready，消息增量更新保持既有节点和用户滚动位置；仅当用户接近底部时自动锚定新消息，typing/presence 更新不替换 timeline，错误状态不会伪装成 Kernel/Runtime/Candidate 诊断。
- [ ] Attachment view 只接受经过安全 URL 处理的显式 metadata，非法协议不生成链接/图片；MessageActions 只按显式 `canReply/canEdit/canDelete/canRetry` view 显示原生按钮，不自行推断 ACL；Reaction 使用原生 button、明确 count/current-user 状态和 typed toggle event。
- [ ] Host 对 SDK snapshot 下发显式 Chat permissions；交互 Timeline 只按 permission + ownership/status 组合 Actions/Reaction，并通过公开 property/event/part 扩展。Template 不读取 Shadow DOM；read receipt 在 Chat 打开且可见时随最新消息更新，同一消息不重复发送。
- [x] 交互 Timeline 对每条消息只呈现一套 canonical Reaction；静止态不渲染 0-count 候选 Reaction，也不同时出现只读 pill 与交互 button。候选 Reaction、reply/edit/delete/retry 只在 compact More 展开后出现，Delete 使用危险语义并要求二次确认。
- [ ] compact More 在桌面以不占整行宽度的气泡锚定浮层呈现，在 320/360/390px 使用带 backdrop 的底部 action sheet；打开后焦点进入操作面，Tab/Shift+Tab 循环，Escape/外部点击关闭并恢复到触发按钮，200% 字体下不产生横向溢出。
- [ ] 相邻同作者、同方向且间隔不超过五分钟的消息形成 `single/first/middle/last`；后续消息不重复作者/时间，own delivery 只在组尾或异常状态保留，非 own avatar 只在组尾/单条显示，同时 message key、Matrix 顺序、reply/edited/failed 语义不变。
- [ ] 所有交互元素以 bubbling/composed typed CustomEvent 暴露 submit、attachment、typing、mention query/select、reply/edit/delete/retry/reaction 与 dismiss-error 意图；组件不直接创建 SDK、不连接 Matrix/Backend/Agent provider，也不提供 `agent.invoke()`。
- [ ] 迁移适配器可用同一个 controller snapshot 驱动 `vc-space-chat-timeline`、`vc-space-chat-composer`、`vc-space-mention-menu`、`vc-space-chat-attachment`、`vc-space-reaction-bar`、`vc-space-message-actions` 与 `vc-space-chat-error-state`；Default Chat 与抽屉 Template 只需保留布局、主题和场景组合代码。

组件库 E2E 必须从真实 Template artifact 构建 iframe DOM，不使用独立 catalog 代替产品验收。断言至少包含 component artifact hash、Template source/artifact hash、ready Revision、Published Release 和两端 Matrix event ID。组件 package/build/unit 只能完成前三项的工程基线，不能勾选 Runtime、双 Template 或可访问性浏览器场景。

**文件：** `specs/chat-matrix-room.spec.ts`、`specs/chat-matrix-operations.spec.ts`、`specs/chat-social-invite.spec.ts`、`specs/chat-space-agent-collaboration.spec.ts`、`specs/space-runtime-membership-revocation.spec.ts` 与对应 unit/contract suites ｜ **优先级：** P0 ｜ **状态：** Active ｜ **Web / Backend / Space Runtime / SQLite / 本地 Synapse / 双 Chromium Context**

本组场景验收 2026-08-23 校正后的 Space App 设计。Space 是持续可用并实时更新的在线空间，不是 Workspace 或试验场。顶部 Kernel Bar 是唯一固定宿主界面，其下全部由 App Project 渲染；Default Chat UI 也是 App 代码。不可修改的是 Chat Core、Mention 和 Agent 调度语义。Space 市场、分类、收藏、版本和模板创建保持不变；Agent 使用 provider-neutral Adapter，Pi 只是首个候选示例。Space Runtime 继续采用 `chat-app-server` 同构技术链。现有房间与多人 Space 映射同一 SpaceInstance；ready Revision 实时更新当前 Space，Publish 固化不可变 Release。

#30 的真实 Matrix Chat 与 #35 的官方 Space 目录/收藏是本组必须保持的基础回归，不会被 #40 替代。#40 只能增量增加空白创建、Default Chat App、完整 SDK、Agent、ready Revision 和 Release。

| # | 验收场景 | 具体流程 |
|---|---------|---------|
| 1 | 市场模板创建 Space | A/B 已是联系人 → A 从 Discover 浏览分类/详情并收藏模板 → Default Chat 与四个差异化官方条目分别暴露不可变 Version/Artifact 引用 → 选择固定版本创建 Space → Runtime 解析 artifact 并幂等创建 Matrix Room、Space Instance、Project 和 ready Revision → 双方立即进入同一可用 Space |
| 2 | 空白 Space 与后选模板 | A 选择空白创建 → 复制 Default Chat App 并立即可聊天 → 之后从 Kernel/Discover 选择模板 → Candidate 验证成功后实时切换 ready Revision，成员、消息和历史不变 |
| 3 | Kernel Bar + App Surface | 进入 Space → Host DOM 固定内容只有顶部 Kernel Bar → 其下单一 iframe 覆盖完整 App Surface → Default Chat UI 位于 App 源码 → 全屏 Default Chat 不再渲染一条重复 Space 身份/连接状态的 App Header，抽屉式 Chat 只保留抽屉自身必要控制 → 不存在宿主 Chat Panel、并列画布、Studio 或 Workspace |
| 4 | 不可修改 Chat Core | 分别在 Default Chat App 和不同布局 Template App 中 → 双方完成文字/媒体/回复/编辑/删除/Reaction/已读/typing/历史 → Composer 在桌面与移动端都按“附件、可伸缩输入、发送”稳定布局且不遮挡 timeline → 两个 App 使用同一 SDK/Matrix timeline/ACL，UI 变化不改变能力语义 |
| 5 | Mention 与 Agent 调度 | App 查询结构化 member/agent target → 每个逻辑 Agent 只出现一个可调用 target，受管 Matrix virtual user 不再作为普通成员、第二个 Mention 或成员计数暴露 → 普通讨论只进入 Matrix、不调用 Agent → 带 Agent Mention 的消息先获得 Matrix event ID → 仅该事件完成 ACL/credits 和幂等入队 → 一个合并 turn 只由受管 Agent virtual user 向 Matrix 幂等写入一个 `m.room.message` → 双方与刷新后的 Chat Core 都只显示该 Matrix Agent event，不投影 Runtime 私有 message |
| 6 | Agent provider-neutral | 相同合约分别接 Pi Adapter 与 fake/第二 Adapter → Agent ID/provider 可切换 → Project、queue、usage、错误、权限和 UI 不出现 Pi 专属字段或行为依赖 |
| 7 | Conversation 与 Revision | A 向 Agent 提问只得到回复，Project 指针不变 → 再请求改变 App → Agent 生成 Candidate → Runtime 验证成功 → 双方实时看到相同 ready Revision → Published Release 不被改写 |
| 8 | 多成员批次与单写 | A/B 连续提交兼容定制 → 保留作者、Agent 和顺序并合并一批 → 同一 Space 只有一个 active write batch → 不同 Space 在配额内并行 → 普通 Chat 不被批处理阻塞 |
| 9 | Publish 屏障与不可变发布 | ready Revision M1 → Kernel 读取并随 P 提交 `expectedReadyRevisionId=M1` → 修改 M2 连续入队 → P 只固化 M1 并原子更新 Published 指针 → M2 不越过 P 且仍可成为当前 ready Revision → stale/缺失 expected revision 被拒绝且不产生 Release → 自然语言“发布”只走普通 Agent turn → 重复 idempotency key 返回同一 Release |
| 10 | 失败保护与恢复 | 当前运行 ready Revision 时提交无法构建的 Candidate/发布 → Candidate 在独立版本实例中失败且不会终止当前 ready App → App 代理保持真实非 2xx，不合成包级 Default Chat 页面 → 当前 ready Revision 在 iframe 重载与页面刷新后仍按固定版本可用，Published Release 不被覆盖 → Kernel Bar 显示诊断并可显式恢复由 Template Project 管理的 Default Chat App |
| 11 | Space SDK 数据语义 | 双浏览器 App 读取真实 members/chat → 完整消息操作、Mention、presence、state CAS 和瞬时 event 均走版本化 SDK → chat.send 使用当前成员身份 → UI 代码无法改变服务端结果 |
| 12 | iframe 与身份安全 | 伪造 iframe/source/nonce/action/userId/spaceId/mention target/agentId、超大 JSON、原型污染 key 和越权 publish → Kernel/Backend 拒绝；Matrix member 被 kick/leave 后即使 `participant_user_ids_json` 仍含该用户，app/bootstrap/events/dev/publish/restore/messages/bridge 全部 fail closed；Backend→Runtime 与 callback 的过期、错误 audience、错误 method/path 短期凭证均被拒绝 → App 无法覆盖 Kernel Bar、读取 Cookie/Matrix token/Agent 凭据/源码或发布 API |
| 13 | ACL、积分与退款 | `space.chat` 与 `agent.invoke` 独立 → 无 Agent 权限/余额时消息仍进 Chat但请求不入队 → 有权限请求逐条 reservation → provider/Candidate 构建失败只退款一次 → 重放不重复扣费 |
| 14 | 重启、多副本与跨系统恢复 | 启动两个 Runtime replica 竞争同一 `spaceInstanceId`，断言只有 lease owner 与当前 fencing token 可写 → 在 ready M1、Publish P、修改 M2 连续排队时终止 owner，第二 replica 接管且 P 仍只固化 M1、M2 不越过屏障 → 在 Agent active 与 outbox 投递中分别终止 owner，interrupted Turn 回队首、sequence/snapshot 恢复、旧 owner fenced write 被拒绝 → 重放 reconciler 不重复 Matrix Agent reply、credits settlement/refund、Matrix v2 state、Revision 或 Release |
| 15 | 现有房间与多人 Space 统一 | 准备一个带 v1 模板 lineage 的历史一对一 `room_index`、一个历史群聊和一个新多人 Space → 原地回填唯一 `spaceInstanceId`，不创建新记录/Matrix Room → 历史实例按 lineage lazy bootstrap 兼容 Project → 三者都经同一 SpaceInstanceRepository/Server/Project/SDK/queue → v1/v2 双读且参与人数不触发实现分支 |
| 16 | 基础能力无回归 | #26–#39 与 #40 一起运行 → 认证、资料、联系人、邀请、Chat、Discover、分类、详情、收藏、模板版本、账户和 Admin 全绿 → 不删除 `/v1/spaces` 或模板创建 |
| 17 | 官方/用户 Template 统一发布 | 每个官方 Template 在仓库只维护一个普通的多文件 `app/` 工作源码树和扁平 `releases.json` 元数据；`src/index.ts` 只负责导出/启动 Runtime registry 与 App handler 装配，页面、样式、浏览器交互和 Chat 调用按职责拆分，Chat 浏览器状态机、消息渲染、Composer 交互与样式分区必须是可单独阅读和类型检查的模块，不能以压缩后的巨型字符串或单文件状态机代替项目结构，也不按版本复制源码 → Artifact 递归包含并校验整个受支持项目树，任一嵌套源码变化都会产生新 source hash → 官方从 Git revision、用户从固定 ready Revision 构建按 hash 寻址的不可变 artifact → 两者进入同一 Registry/Object Store 和市场查询并拥有相同 Template/Version/Artifact/Market schema → 仅 Publisher verification/provenance 不同 → 收藏、创建、Runtime bootstrap、升级、撤销走同一服务 → 用户源码完成隐私清理且不能伪造官方标记 |
| 18 | Template 有序版本治理 | 新 Template 必须从 `0.1.0` 开始 → 仅不可变 Project/能力/兼容契约变化允许按 SemVer 单步升 patch/minor/major → 跳号、倒序、重复版本、空内容升级和非规范版本被拒绝 → `currentVersionId` 始终指向最高版本 → Template schema、SDK/Runtime、Space Revision/Release 版本不与 Template 版本联动 |

`chat-space-agent-collaboration.spec.ts` 的首个 P0 用例必须使用两个独立 Chromium Context 和同一个真实 Synapse Space：A/B 完成联系人与加入；A 发送普通消息并由 B 接收；A 再从 App 发送结构化 `@agent`；两端断言只有一条 Agent 回复，回复带 Agent 身份并关联原始事件；两端刷新后数量仍为一；若 Agent 修改 Project，则两端最终指向相同 ready Revision 且 Published Release 未被隐式改写。测试不得以 Runtime SSE message 或页面 fixture 充当 Agent Chat 成功证据。

Agent Revision 用例必须由当前配置的真实 Pi/provider 修改完整 Project，并在两个 iframe 中观察相同的可见 marker；不能通过测试进程直接改 Project JSON。Candidate 失败用例使用仅在显式测试配置下启用的 provider-neutral fake Adapter 生成确定性的 TypeScript 语法错误，经正常 Matrix Mention、ACL、credits、Space turn、自动修复和 Dev Preview 链路失败；不得要求真实模型“故意写坏代码”，也不得直接覆盖 ready Project。失败后两个浏览器继续加载失败前的固定 revision、能够互发 Matrix Chat，刷新后 Draft/Release 仍不变。

Runtime 多副本故障用例必须提供可控 barrier/failpoint，而不是依赖固定 `sleep` 猜测时序。M1、P、M2、lease owner、fencing token、turn attempt、outbox event ID 和各下游幂等键都要在断言中可见；测试必须分别在“持久化前中止”“持久化后但 callback ACK 前中止”两处恢复，证明 at-least-once 投递与下游 exactly-once effect 同时成立。

2026-08-26 control-plane unit 证据：定向 Vitest 6 个文件、17/17 通过。`control-plane-failover.test.ts` 使用注入时钟而非 `sleep`，覆盖 SQLite Product control plane 上的 M1→P→M2、lease token 1→2、P attempt 1→2、旧 owner fenced write、ready M2 不覆盖 Published M1，以及 outbox callback ACK 丢失后的稳定 dedupe effect；同一文件还以两个真实 `SpaceInstanceServer` 对象验证 active P 被第二 owner 接管且只完成一次。`space-instance-server.test.ts` 另断言自然语言“发布”只产生普通 message Turn。该证据满足 repository/runtime integration 门槛，但不代替场景 #14 的两个独立进程、Synapse、AgentOS 与 D1/R2 演练。

2026-08-26 Matrix membership 撤权 E2E 证据：`space-runtime-membership-revocation.spec.ts` 2/2 通过。测试分别让 owner kick member、member 主动 leave；Matrix member state 已为 `leave` 而 SQLite `participant_user_ids_json` 仍包含该 product user 时，被移除成员访问 snapshot/bootstrap、live/dev App、events、messages/turns、publish、restore 与 bridge 全部得到 404 `SPACE_INSTANCE_NOT_FOUND`。两种场景均断言 Space Turn/Outbox 数量、成员 credits 余额和交易数量不变，owner 仍可读取 Runtime snapshot 与 Dev App。该证据完成场景 #12 的真实 membership 撤权子项；其余 iframe 伪造输入和凭证边界继续由现有 contract/unit 证据维护。

当前 Runtime 验收不得设置本地控制模式或依赖 `.data/projects`、`.data/spaces` 恢复。开发、预览与生产都必须通过同一 Product DB/Object Store API；缺少内部签名/Backend origin 配置时 Runtime 启动失败，Backend、数据库迁移或 Object Store 不可用时读写 fail closed，不得回退到本地 JSON。unit 可注入显式内存 adapter，但该 adapter 不得进入生产 import graph。

2026-08-25 Matrix Agent P0 运行证据：

- 本地 `pnpm dev` 同时运行 Web 8001、Backend 8002、Space Runtime 8007、Synapse 8008 与受管 Rivet Engine 6420；Runtime health 对 Engine 做真实探测并返回 200，Agent 为 Pi、provider 为 `deepseek`。
- `chat-matrix-room.spec.ts`、`chat-matrix-operations.spec.ts`、`chat-social-invite.spec.ts`、`chat-space-agent-collaboration.spec.ts` 合并执行 5/5 通过（两个独立 Chromium Context）。覆盖真实人类双向消息/操作、Template Space 邀请、结构化 `@pi`、双方只见同一个受管 virtual-user Matrix event、原事件 reply/Agent metadata、刷新唯一恢复，以及 chat-only turn 不改写 Draft/Release。加入 `io.vibechat.agent_member` identity 与逻辑 Agent 投影后，collaboration spec 再次单独执行 1/1 通过：成员 state marker 正确，Mention 面板恰好一个 `@pi`，没有 `vibe_agent_*` target。
- v1 Matrix state `templateId`/`spaceId` 双读修复了创建者 `/sync` 早于 Product DB metadata 落库时的 Space 消失竞态；`chat-social-invite.spec.ts` 修复后单独 1/1、合并回归再次通过。
- Agent Adapter、完成回调、Runtime health、Host timeline 隔离和 v1 state 兼容共 6 个定向测试文件、17/17 unit 通过。空白 Space 后选模板、member Mention、Candidate 双浏览器切换/失败保护、publish 屏障与多副本接管仍保持未完成。

2026-08-25 Candidate 隔离自动化证据：

- `chat-space-agent-collaboration.spec.ts` 新增两个独立 Chromium Context 的 Revision 成功与失败用例。成功用例只在 `E2E_SPACE_AGENT_EXPECT_READY=1` 下调用真实 Pi/provider；失败用例只在 Runtime 显式启用 `SPACE_AGENT_FAKE_ENABLED=1` 且测试设置 `E2E_SPACE_FAKE_AGENT_READY=1` 时开放，不把 Fake Adapter 暴露为默认 Agent。
- Fake Adapter 通过普通结构化 `@fake` Matrix event、membership/ACL、欢迎积分 reservation、Space turn、三次自动修复和 Dev Preview 提交无法转译的 Candidate。Google Chrome 实跑失败隔离 1/1 通过：失败状态可观测、active/pending queue 清零，Project Draft/summary 与 Published Release 均未改变；两个 App iframe 始终保留原 ready Revision，失败后仍可双向发送 Matrix Chat，双方刷新后 App 与消息继续可用。
- 修正 Runtime bootstrap 的幂等边界：只有当前进程的 Preview 状态为 `idle` 时才从持久化 Draft 完成真实冷启动；快照轮询在 `building`、`ready` 或 `failed` 时只读取现状，不再用旧 Draft 的重复 `prepare` 抹掉 Candidate 失败状态。
- Space Runtime 定向 unit 12/12、Google Chrome Candidate 失败隔离 E2E 1/1、全仓 18/18 package/app `typecheck` 与 `build`、`docs:check`、Docs production build 和 `git diff --check` 均通过。真实 Pi Revision 自动化代码已经就绪，但本轮没有获得把测试 Space Project 源码与 Prompt 发往外部 DeepSeek 的明确授权，因此没有执行，也没有把“双浏览器成功切换 ready Revision”标为完成。

---

### Backlog 优先级汇总

| 优先级 | 编号 | 测试名称 | 前置条件 | 预计用例数 |
|--------|------|----------|----------|-----------|
| P2 | 19 | 支付宝支付流程 | 支付宝沙盒 App ID/密钥 + 沙盒买家账号 | 3 |
| ✅ | 20 | 博客功能 | blog_post 表已创建 + 管理员账号 | 11 |
| Replaced | 25 | 聊天宿主基础功能 | 历史 fixture 基线，见 #35 | 8 |
| ✅ | 26 | Email OTP 与产品 Session Bootstrap | 本地数据库与开发模式 | 5 |
| ✅ | 27 | Matrix Identity 生命周期 | 本地数据库与 fake adapter | 7 |
| ✅ | 28 | Synapse Appservice Adapter | mock HTTP 与本地 Synapse | 7 |
| ✅ | 29 | Session 撤销与 Matrix Device 回收 | SQLite 与本地 Synapse | 7 |
| ✅ | 30 | 真实 Matrix 房间与消息 Timeline | SQLite、本地 Synapse、Chromium | 8 |
| ✅ | 31 | 好友关系与双用户 Matrix 邀请 | SQLite、本地 Synapse、双 Chromium Context | 9 |
| ✅ | 32 | 浏览器会话与本地 Matrix 数据管理 | SQLite、本地 Synapse、双 Chromium Context | 5 |
| ✅ | 33 | Matrix 完整消息操作 | SQLite、本地 Synapse、双 Chromium Context | 7 |
| ✅ | 34 | 首次资料设置与联系人备注 | SQLite、本地 Synapse、双 Chromium Context | 7 |
| ✅ | 35 | 登录后产品状态真实化 | SQLite、本地 Synapse、双 Chromium Context | 9 |
| ✅ | 36 | Apps 拆分与同源 Backend 网关 | backend/Web/Site、SQLite、本地 Synapse | 7 |
| ✅ | 37 | 跨宿主 Workspace Package 边界 | pnpm workspace、backend/Web/Site、SQLite、本地 Synapse | 8 |
| ✅ | 38 | 独立 Admin App 与运营管理链路 | Admin/Backend、SQLite、seeded Admin/普通用户 | 9 |
| ✅ | 39 | 产品能力完整迁移 | Web/Backend/Admin、SQLite、本地 Synapse | 9 |
| Planned | 40 | Space App：聊天之上的可定制空间 | Web/Backend/Space Runtime、SQLite、本地 Synapse、双 Chromium | 17 |

---

## 测试结果追踪

每次运行后在此记录结果：

| 日期 | 应用 | 通过 | 失败 | 跳过 | 备注 |
|------|------|------|------|------|------|
| 2026-08-28 | Space App Components Recipe + five official Templates + Matrix | 6 | 0 | 0 | `chat-matrix-room.spec.ts` 全文件 6/6；Default/Focus 使用 `0.8.1` full/dock Recipe，Campfire/Arcade/Postcard 继续固定 `0.7.4`；另通过 components/dependencies/templates unit 45/45、组件 bundle 和两个 Template App TypeScript |
| 2026-08-27 | Space App Components + five official Templates + Matrix | 6 | 0 | 0 | `chat-matrix-room.spec.ts` 全文件 6/6；Postcard 独立场景覆盖卡片状态、共享 Chat、抽屉 unread、历史恢复和 390px 布局；另通过 Catalog 9/9、Template/App TypeScript 与 Impeccable detector |
| 2026-08-24 | Space Runtime managed Engine + Published Release recovery | 33 | 0 | 0 | Runtime/Template/Product 定向 unit 31/31；真实 Matrix Space Chromium 2/2；完整停止/重启后 Alice 的同一 Release 冷启动与热请求均为 200；另通过全仓 18/18 typecheck/build、Docs build、边界和文档检查 |
| 2026-08-24 | Space Kernel recovery + Template 0.1.1 + AgentOS Release + Synapse | 35 | 0 | 0 | Runtime/Template/Web/Product Client 定向 unit 33/33；真实 Matrix Space Chromium 2/2；Alice 现有 Space 恢复到 `space-default@0.1.1` 后成功固化 64 位 Release；另通过五个官方 App + Runtime seed 独立 TypeScript、全仓 18/18 typecheck/build、边界和文档检查 |
| 2026-08-24 | Space Template version governance + Market + Web + Synapse | 24 | 0 | 0 | SemVer/兼容 alias/Room/Market 定向 unit 15/15；真实 Product State Chromium 9/9；创建流程五个官方 Template 均显示 v0.1.0；另通过 19 个 workspace project 递归 typecheck/build、Docs build、边界和文档检查 |
| 2026-08-24 | Space App cold start + Web + Runtime + Synapse | 7 | 0 | 0 | ready App 状态机 unit 5/5；真实 Matrix Space Chromium 2/2，首个 App 文档不再返回 Default Chat recovery；另通过全仓 18/18 typecheck/build、边界和文档检查 |
| 2026-08-24 | Space Template + Market + Runtime + Web + Synapse | 25 | 0 | 0 | 统一官方/用户协议 unit 14/14；Product State Chromium 9/9；Matrix Space Chromium 2/2；另通过全仓 18/18 typecheck/build、文档链接检查和 Docs production build |
| 2026-08-23 | Space-first Web + Backend + Runtime + Synapse | 12 | 0 | 0 | `/spaces` 首页与 Space 实例详情、旧 URL 重定向、创建/邀请/双向 Chat、App 503 故障隔离、移动端 Space 控件；另通过 docs 检查/构建及全仓 18/18 typecheck/build |
| 2026-08-23 | Web + Backend + Synapse | 1 | 0 | 0 | 创建对话 Portal 弹窗 surface 回归：好友申请、双向联系人、不透明弹窗、Space 创建、Matrix 邀请与双向消息；另完成真实浏览器视觉走查、17 packages/apps typecheck 与完整 build |
| 2026-08-23 | Space Template + Runtime + Web + Synapse | 13 | 0 | 0 | 四个官方模板 v2/兼容 v1、Project bootstrap、opaque iframe SDK 注入、共享 state/刷新恢复和 Chat 共存；真实浏览器创建 1 个 v2 Space 并 lazy bootstrap 1 个历史 v1 Space |
| 2026-08-14 | Site + Web + Admin | 10 | 0 | 0 | 多应用无前缀本地化与公开页面 Chromium 回归：默认语言、URL 不变的语言切换、跨端 Cookie、三端旧前缀兼容、双语 404、公开表单与根入口；另完成真实浏览器三端走查且控制台无 error |
| 2026-08-14 | Web + Backend + Admin + Site + Synapse | 53 | 0 | 0 | 产品能力迁移最终 Chromium 回归：账户/安全、上传真实失败关闭、AI 结算退款、支付失败幂等、推荐奖励、提现 KYC、Admin CRUD 与完整 Matrix 聊天链路；另通过 Application Service 集成、API ownership、领域单元测试、10 packages 与四 app 构建、Workers 预览和 docs 静态导出 |
| 2026-08-13 | Admin + Backend + Web | 3 | 0 | 0 | 修复当时 `/$lang/admin/*` 与 `/api/admin/*` 的同名路由碰撞；Admin E2E 禁止接口重定向、校验 JSON content-type，并等待八个运营页面的真实 API 成功响应；另完成中文用户/订阅管理页浏览器走查、10 packages + 4 apps typecheck、packages + Backend/Web/Site/Admin/Docs build |
| 2026-08-13 | Better Auth + Web + Admin + Workers | 6 | 0 | 0 | Admin callbackURL 修复：trusted origins 安全单测 3 项、Admin Chromium E2E 3 项；另完成真实中文网页登录回跳、14 package typecheck、全量 build、Docs build，以及 Workers health 200 / 显式 Admin callback 进入凭据查询验证 |
| 2026-08-12 | Packages + Backend + Web + Site + Admin + Synapse + D1 | 150 | 0 | 0 | Admin/libs 清理最终回归：活动领域单测 103 项（含提现拒绝只退款一次）、完整 Chromium E2E 39 项、Admin 权限 API 8 项；另完成 10 package + 4 app 根级 typecheck/build、文档站 build，以及 Workers/D1 health 200、未登录 Admin/bootstrap 401 smoke |
| 2026-08-12 | Packages + Backend + Web + Site + Synapse + Vitest | 81 | 0 | 0 | Package 边界最终回归：活动产品 E2E 36 项、identity/rooms/social/product-state/product-client/product-core 单测 45 项；另完成 6 package + 3 app 根级 typecheck/build、Workers build/health/未登录 bootstrap 401 与文档站 build |
| 2026-08-12 | Backend + Web + Site + Synapse + Vitest | 75 | 0 | 0 | Apps 拆分最终回归：活动产品 E2E 36 项、identity/rooms/social/product-state 单测 39 项；另完成三 app Node build、Backend Workers/D1 preview 与文档站 build |
| 2026-08-12 | Backend + Web + Site + Synapse | 23 | 0 | 0 | Apps 物理拆分定向回归：官网、同源 Auth/API、真实 Matrix 房间消息与持久化产品状态 |
| 2026-08-12 | TanStack + Synapse | 19 | 0 | 0 | 聊天真实链路全量回归（OTP、profile、social、Matrix room/message、product state 与 session） |
| 2026-08-12 | TanStack + Synapse | 9 | 0 | 0 | 登录后产品状态真实化（UI 注册、守卫、Matrix 失败关闭、真实空账号、目录、收藏、用户/房间偏好、持久化与隔离） |
| 2026-08-12 | TanStack + Vitest + Synapse | 49 | 0 | 0 | A2 聊天基础闭环（identity/rooms/social 单测 34 项；OTP、fixture、Matrix 房间/消息操作、资料、社交邀请、会话与撤销 E2E 15 项） |
| 2026-08-12 | TanStack + Synapse | 1 | 0 | 0 | 首次资料设置与联系人备注真实链路（唯一用户名、头像校验、资料热更新、方向性私有备注与权限） |
| 2026-08-12 | TanStack + Synapse | 1 | 0 | 0 | Matrix 完整消息操作真实链路（typing、编辑、撤回、媒体、搜索、刷新恢复、离线 pending event 幂等重发） |
| 2026-08-12 | TanStack + Vitest + Synapse | 42 | 0 | 0 | A2 基础整合（identity/rooms/social 单测 32 项；fixture、真实 room、双用户好友/邀请/屏蔽、会话撤销与本地清理 E2E 10 项） |
| 2026-08-12 | TanStack + Vitest + Synapse | 8 | 0 | 0 | 真实 Matrix 房间与 Timeline（rooms 单测 6 项 + 本地 Synapse/Chromium E2E 2 项） |
| 2026-08-11 | TanStack + Vitest + Synapse | 4 | 0 | 0 | Session 撤销与 Matrix Device 回收（worker 单测 3 项 + 真实 sign-out/token 失效 E2E 1 项） |
| 2026-08-11 | TanStack + Vitest + Synapse | 24 | 0 | 0 | Synapse Appservice Adapter（identity unit/mock/SQLite 17 项 + 真实 Synapse 合约 1 项 + Matrix ready/unavailable bootstrap E2E 各 3 项） |
| 2026-08-11 | TanStack + Vitest | 17 | 0 | 0 | Matrix Identity 生命周期（identity 单测 9 项 + `chat-auth-bootstrap` / `chat-foundation` 浏览器回归 8 项） |
| 2026-08-11 | TanStack | 3 | 0 | 0 | Email OTP 与产品 Session Bootstrap（`chat-auth-bootstrap.spec.ts`，覆盖 5 项验收场景） |
| 2026-08-11 | TanStack | 5 | 0 | 0 | 聊天宿主基础功能（`chat-foundation.spec.ts`，覆盖 8 项验收场景） |
| 2026-08-11 | TanStack | 1 | 0 | 0 | 精简首页回归（`public-pages.spec.ts` 单用例） |
| 2026-02-25 | Next.js | 35 | 0 | 0 | 全部通过（含 Stripe 支付） |
| 2026-03-04 | Next.js | 3 | 0 | 0 | AI Chat 真实交互（ai-chat.spec.ts） |
| 2026-03-06 | Next.js | 3 | 0 | 0 | AI Image Generation 真实生成（ai-image-generate.spec.ts） |
| 2026-03-06 | Nuxt.js | 3 | 0 | 0 | AI Image Generation 真实生成（ai-image-generate.spec.ts） |
| 2026-03-06 | Next.js | 5 | 0 | 0 | Creem 支付流程（creem-payment.spec.ts） |
| 2026-03-06 | Nuxt.js | 5 | 0 | 0 | Creem 支付流程（creem-payment.spec.ts） |
| 2026-03-06 | Next.js | 7 | 0 | 0 | PayPal 支付流程（paypal-payment.spec.ts） |
| 2026-03-06 | Nuxt.js | 7 | 0 | 0 | PayPal 支付流程（paypal-payment.spec.ts） |
| 2026-03-08 | Nuxt.js | 88 | 0 | 0 | **全量回归** — 全部通过（5m19s） |
| 2026-03-08 | Next.js | 88 | 0 | 0 | **全量回归** — 全部通过（6m00s） |
| 2026-03-09 | Nuxt.js | 11 | 0 | 0 | 博客功能（blog.spec.ts）— 全部通过（16.6s） |
| 2026-03-09 | Next.js | 11 | 0 | 0 | 博客功能（blog.spec.ts）— 全部通过（43.4s） |
| 2026-03-09 | Nuxt.js | 11 | 0 | 0 | 博客增强后回归（blog.spec.ts）— 全部通过（15.9s） |
| 2026-03-09 | Next.js | 11 | 0 | 0 | 博客增强后回归（blog.spec.ts）— 全部通过（55.5s） |
| 2026-04-27 | Next.js | 105 | 0 | 0 | **SQLite/D1 分支全量回归 (PG)** — 全部通过（7.4m） |
| 2026-04-27 | Nuxt.js | 96 | 2 | 0 | **SQLite/D1 分支全量回归 (PG)** — 2 个超时 flaky（admin-panel 导航 + blog 创建）（7.4m） |
| 2026-04-27 | TanStack | 105 | 0 | 0 | **SQLite/D1 分支全量回归 (PG)** — 全部通过（6.5m） |
| 2026-04-28 | Next.js | 103 | 1 | 0 | **SQLite/D1 分支全量回归 (SQLite)** — 1 个 PayPal 沙盒超时（9.4m） |
| 2026-04-28 | Nuxt.js | 92 | 2 | 2 | **SQLite/D1 分支全量回归 (SQLite)** — 1 个 admin-filters flaky + 1 个 PayPal 沙盒超时（8.4m） |
| 2026-04-28 | TanStack | 103 | 1 | 0 | **SQLite/D1 分支全量回归 (SQLite)** — 1 个 PayPal 沙盒超时（8.3m） |
| 2026-05-26 | Next.js | 20 | 0 | 0 | **返利管理增强 (PG)** — affiliate + admin-affiliate 全部通过（1.5m） |
| 2026-05-26 | TanStack | 20 | 0 | 0 | **返利管理增强 (PG)** — affiliate + admin-affiliate 全部通过（49s） |
| 2026-05-26 | Nuxt.js | 20 | 0 | 0 | **返利管理增强 (PG)** — affiliate + admin-affiliate 全部通过（40s） |
| 2026-05-26 | Next.js | 20 | 0 | 0 | **返利管理增强 (SQLite)** — affiliate + admin-affiliate 全部通过（1.5m） |
| 2026-05-26 | TanStack | 20 | 0 | 0 | **返利管理增强 (SQLite)** — affiliate + admin-affiliate 全部通过（31s） |
| 2026-05-26 | Nuxt.js | 20 | 0 | 0 | **返利管理增强 (SQLite)** — affiliate + admin-affiliate 全部通过（30s） |
| 2026-05-26 | Next.js | 4 | 0 | 0 | **推荐佣金支付全流程 (PG)** — affiliate-commission 全部通过（52s） |
| 2026-05-26 | TanStack | 4 | 0 | 0 | **推荐佣金支付全流程 (PG)** — affiliate-commission 全部通过（59s） |
| 2026-05-26 | Nuxt.js | 4 | 0 | 0 | **推荐佣金支付全流程 (PG)** — affiliate-commission 全部通过（33s） |

_每次测试运行后更新此表。_
