# Vibe Chat 权限控制系统

这是一个基于 CASL 的权限控制系统，用于 Vibe Chat 应用中控制用户对不同资源的访问权限。支持 Next.js 和 Nuxt.js 应用。

## 🏗️ 设计思想

权限系统基于以下核心概念：

1. **角色 (Roles)**: 定义用户在系统中的身份
   - `normal`: 普通用户（默认角色）*【当前未使用，仅作为默认值】*
   - `vip`: VIP用户（付费用户）*【当前未使用，预留扩展】*
   - `admin`: 管理员（超级权限）*【✅ 当前使用：访问管理后台】*
   - `user`: 标准用户*【✅ 当前实际使用：数据库默认角色】*

2. **资源 (Subjects)**: 定义系统中可被操作的实体
   - `user`: 用户管理*【预留扩展】*
   - `project`: 项目管理*【预留扩展】*
   - `subscription`: 订阅管理*【预留扩展】*
   - `report`: 报告功能*【预留扩展】*
   - `setting`: 系统设置*【预留扩展】*
   - `all`: 所有资源*【✅ 当前使用：管理员访问控制】*

3. **操作 (Actions)**: 定义用户可对资源执行的动作
   - `create`: 创建资源*【预留扩展】*
   - `read`: 读取资源*【预留扩展】*
   - `update`: 更新资源*【预留扩展】*
   - `delete`: 删除资源*【预留扩展】*
   - `manage`: 管理所有操作*【✅ 当前使用：管理员权限检查】*

4. **规则 (Rules)**: 通过 CASL 定义角色、资源和操作之间的关系

## 🚨 当前实际使用情况

**目前系统中主要使用的权限控制场景：**

1. **管理后台访问控制**
   - 路由: `/admin/*` (Next.js) 和 `/admin/*` (Nuxt.js) 
   - 权限检查: `can(user, Action.MANAGE, Subject.ALL)`
   - 只有 `admin` 角色用户可以访问

2. **用户角色系统**
   - 数据库角色: `admin` | `user` (定义在 `libs/database/constants.ts`)
   - 权限系统角色映射: `admin` → `Role.ADMIN`, 其他 → `Role.NORMAL`

3. **订阅功能权限**
   - 部分功能需要有效订阅才能访问（如 premium-features 页面）
   - 使用订阅中间件而非权限系统进行控制

**其他角色和资源目前为预留扩展，可根据业务需求进行配置。**

## 📦 系统组件

权限系统包含以下核心组件：

- **types.ts**: 角色、资源和操作的类型定义
- **abilities.ts**: 基于 CASL 的权限规则定义
- **utils.ts**: 核心权限检查函数（`can`、`createAppUser`）
- **Vue Composables**: Nuxt.js 应用的权限检查组合函数
- **PermissionGuard**: Vue 组件级权限保护

## 💡 基本使用

### 当前系统实际使用示例

```typescript
import { can, Action, Subject, createAppUser } from '@libs/permissions';

// 当前主要使用场景：管理后台访问控制
const user = createAppUser(sessionUser); // 从session用户创建AppUser
const canAccessAdmin = can(user, Action.MANAGE, Subject.ALL); // 只有admin角色返回true

// 在中间件中的实际使用
const hasPermission = can(appUser, Action.MANAGE, Subject.ALL);
if (!hasPermission) {
  // 拒绝访问管理后台
  return Response.json({ error: '权限不足' }, { status: 403 });
}
```

### 扩展权限检查示例

```typescript
// 以下为扩展用法示例，当前未启用
const hasPermission = can(user, Action.UPDATE, Subject.PROJECT);
const canEditProfile = can(user, Action.UPDATE, Subject.USER, { id: user.id });
```

### 实际应用中的权限检查

```typescript
// 当前系统的实际用法（Next.js 中间件）
import { can, Action, Subject, createAppUser } from '@libs/permissions';

// 在路由中间件中检查管理员权限
const appUser = createAppUser(session?.user);
const hasPermission = can(appUser, Action.MANAGE, Subject.ALL);

if (!hasPermission) {
  return Response.json({ error: '权限不足' }, { status: 403 });
}

// Nuxt.js 中间件中的使用
const appUser = createAppUser(user);
const hasPermission = can(appUser, Action.MANAGE, Subject.ALL);

if (!hasPermission) {
  throw createError({
    statusCode: 403,
    statusMessage: '权限不足'
  });
}
```


## 🧪 权限规则

### 当前实际权限矩阵

| 角色 | Admin 后台访问 | 其他资源 | 说明 |
|------|---------------|----------|------|
| **admin** | ✅ 完全访问 | *预留扩展* | 管理员可访问所有管理功能 |
| **user** (默认) | ❌ 拒绝访问 | *预留扩展* | 普通用户无管理权限 |

### 扩展权限矩阵（演示用）

*以下为完整权限系统的演示配置，可根据业务需求启用：*

| 角色/操作 | User | Project | Subscription | Report | Setting |
|----------|------|---------|--------------|--------|---------|
| **NORMAL** | R, U (自己) | R, C | - | R | - |
| **VIP** | R, U (自己) | R, C, U | R | R, C | R |
| **ADMIN** | 全部权限 | 全部权限 | 全部权限 | 全部权限 | 全部权限 |

*注：R=读取, C=创建, U=更新, D=删除*

### 当前使用的权限逻辑

```typescript
// 当前实际使用的权限检查
const user = createAppUser(sessionUser);

// 管理后台访问控制（✅ 当前使用）
can(user, Action.MANAGE, Subject.ALL) // 只有 admin 角色返回 true

// 角色检查（✅ 当前使用）
const isAdmin = user.role === 'admin';
const isVip = userValue?.role === 'vip' || userValue?.role === 'admin';
```

### 扩展权限逻辑（演示用）

*以下为完整权限系统的演示配置：*

```typescript
// 用户只能编辑自己的信息（预留扩展）
can(user, Action.UPDATE, Subject.USER, { id: user.id }) // ✅ 允许
can(user, Action.UPDATE, Subject.USER, { id: 'other-user-id' }) // ❌ 拒绝（非管理员）

// VIP 用户有额外权限（预留扩展）
can(vipUser, Action.CREATE, Subject.REPORT) // ✅ 允许
can(normalUser, Action.CREATE, Subject.REPORT) // ❌ 拒绝
```


## 📈 扩展权限系统

**如需扩展权限功能，可以：**

1. **添加新角色**: 在 `types.ts` 中定义，在 `abilities.ts` 中设置权限规则
2. **添加新资源**: 在 `types.ts` 的 `Subject` 枚举中添加
3. **自定义权限逻辑**: 在 `utils.ts` 的 `can` 函数中添加特殊处理

当前系统设计简单而灵活，可根据业务需求逐步扩展。

