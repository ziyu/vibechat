# 用户验证器 (User Validators)

Vibe Chat 项目的国际化数据验证系统，基于 Zod v4 构建，提供类型安全的数据验证和多语言错误信息支持。

## 🌟 核心特性

- **🌍 完整国际化** - 支持多语言错误信息，参数插值
- **🔧 框架兼容** - 同时支持 Vue.js (Nuxt) 和 React (Next.js)
- **📱 手机号验证** - 支持多国家/地区手机号格式验证
- **🛡️ 类型安全** - 完整的 TypeScript 类型支持，基于 Zod v4
- **🎯 表单集成** - 与 React Hook Form 和 VeeValidate 无缝集成
- **⚡ 一致体验** - 所有表单使用 `onBlur` 验证模式

## 📦 快速开始

### Vue.js / Nuxt.js 中使用

```typescript
import { createValidators } from '@libs/validators'

// 在 Nuxt.js 组件中直接使用 Vue i18n 的 t 函数
const { t } = useI18n() 
const { loginFormSchema, signupFormSchema } = createValidators(t)

// 在表单验证中使用
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(loginFormSchema),
  mode: 'onBlur'
})
```

### React / Next.js 中使用

```typescript
import { createValidators, createNextTranslationFunction } from '@libs/validators'
import { useTranslation } from '@/hooks/use-translation'

// 在 Next.js 组件中
const { t } = useTranslation() 
const tWithParams = createNextTranslationFunction(t) // 创建支持参数插值的翻译函数
const { loginFormSchema, signupFormSchema } = createValidators(tWithParams)

// 在表单验证中使用
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginFormSchema),
  mode: 'onBlur' // 统一的验证体验
})
```

## 🔧 可用验证器

### 用户认证验证器

```typescript
const {
  // 📧 邮箱注册登录
  emailSignUpSchema,    // 邮箱注册验证
  signupFormSchema,     // 注册表单验证（包含可选图片）
  emailSignInSchema,    // 邮箱登录验证
  loginFormSchema,      // 登录表单验证（包含记住我）
  
  // 📱 手机号注册登录
  phoneSignUpSchema,    // 手机号注册验证
  phoneLoginSchema,     // 手机号登录第一步（发送验证码）
  phoneVerifySchema,    // 手机号登录第二步（验证验证码）
  
  // 🔐 密码管理
  forgetPasswordSchema,   // 忘记密码验证
  resetPasswordSchema,    // 重置密码验证
  changePasswordSchema,   // 修改密码验证
  
  // 👤 用户管理
  userSchema,           // 完整用户信息验证
  updateUserSchema,     // 更新用户信息（所有字段可选）
  userIdSchema,         // 用户 ID 验证
} = createValidators(translationFunction)
```

### 手机号验证支持

```typescript
import { countryCodes, type CountryCode } from '@libs/validators'

// 支持的国家/地区代码
console.log(countryCodes) 
// [
//   { code: '+86', name: '中国', flag: '🇨🇳', phoneLength: [11] },
//   { code: '+1', name: '美国', flag: '🇺🇸', phoneLength: [10] },
//   // 更多国家...
// ]
```

## 🌍 国际化配置

### 翻译键结构

验证器使用统一的翻译键模式：`validators.user.{field}.{errorType}`

```typescript
// 翻译文件示例 (libs/i18n/locales/en.ts, zh-CN.ts)
export default {
  validators: {
    user: {
      name: {
        minLength: "Name must be at least {min} characters",
        maxLength: "Name must be less than {max} characters"
      },
      email: {
        invalid: "Please enter a valid email address"
      },
      password: {
        minLength: "Password must be at least {min} characters",
        maxLength: "Password must be less than {max} characters",
        mismatch: "Passwords don't match"
      },
      phoneNumber: {
        required: "Please enter phone number",
        invalid: "Invalid phone number format"
      },
      verificationCode: {
        invalidLength: "Verification code must be {length} characters"
      }
    }
  }
}
```

### 参数插值示例

```typescript
// 英文: "Password must be at least 8 characters"
// 中文: "密码至少需要8个字符"

// Vue.js - 直接使用 t 函数
t('validators.user.password.minLength', { min: 8 })

// Next.js - 使用增强的翻译函数
tWithParams('validators.user.password.minLength', { min: 8 })
```

## 📝 实践示例

### 登录表单 (Next.js)

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createValidators, createNextTranslationFunction } from '@libs/validators'
import { useTranslation } from '@/hooks/use-translation'

export function LoginForm() {
  const { t } = useTranslation()
  const tWithParams = createNextTranslationFunction(t)
  const { loginFormSchema } = createValidators(tWithParams)
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginFormSchema),
    mode: 'onBlur', // 失焦时验证
    defaultValues: {
      email: '',
      password: '',
      remember: true
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input 
          {...register('email')} 
          type="email" 
          autoComplete="email"
        />
        {errors.email && (
          <span className="error">{errors.email.message}</span>
        )}
      </div>
      
      <div>
        <input 
          {...register('password')} 
          type="password"
          autoComplete="current-password"
        />
        {errors.password && (
          <span className="error">{errors.password.message}</span>
        )}
      </div>
      
      <button type="submit">登录</button>
    </form>
  )
}
```

### 注册表单 (Nuxt.js)

```vue
<template>
  <form @submit="onSubmit">
    <div>
      <input v-model="name" type="text" />
      <span v-if="errors.name" class="error">{{ errors.name }}</span>
    </div>
    
    <div>
      <input v-model="email" type="email" />
      <span v-if="errors.email" class="error">{{ errors.email }}</span>
    </div>
    
    <div>
      <input v-model="password" type="password" />
      <span v-if="errors.password" class="error">{{ errors.password }}</span>
    </div>
    
    <button type="submit">注册</button>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { createValidators } from '@libs/validators'

// 直接使用 Vue i18n 的 t 函数
const { t } = useI18n()
const { signupFormSchema } = createValidators(t)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(signupFormSchema)
})

const [name] = defineField('name')
const [email] = defineField('email')
const [password] = defineField('password')

const onSubmit = handleSubmit((values) => {
  // 处理表单提交
})
</script>
```


## 🛠️ 架构设计

### 验证器工厂模式

```typescript
// libs/validators/user.ts 核心实现
export function createValidators(t: TranslationFunction) {
  const userSchema = z.object({
    name: z.string()
      .min(2, t('validators.user.name.minLength', { min: 2 }))
      .max(50, t('validators.user.name.maxLength', { max: 50 })),
    email: z.string().email(t('validators.user.email.invalid')),
    // 更多字段...
  })

  return {
    userSchema,
    loginFormSchema: userSchema.pick({ email: true, password: true })
      .extend({ remember: z.boolean().default(false) }),
    // 更多验证器...
  }
}
```

### 框架适配层

```typescript
// Vue.js - 直接使用 Vue i18n 的 t 函数
const { t } = useI18n()
const { loginFormSchema } = createValidators(t)

// Next.js - 使用翻译函数工厂创建增强的翻译函数
import { createNextTranslationFunction } from '@libs/validators'

const { t } = useTranslation()
const tWithParams = createNextTranslationFunction(t)
const { loginFormSchema } = createValidators(tWithParams)
```


## 📚 API 参考

### createValidators(translationFunction)

创建国际化验证器的主要工厂函数。

**参数:**
- `translationFunction: (key: string, params?: Record<string, any>) => string`

**返回值:**
包含所有验证器 schema 的对象。

### 工具函数

```typescript
// Next.js 翻译函数创建器
createNextTranslationFunction(translations: object): TranslationFunction
```

## 🎯 最佳实践

### 表单验证配置

```typescript
// 推荐的表单配置
const form = useForm({
  resolver: zodResolver(schema),
  mode: 'onBlur',              // 统一使用失焦验证
  reValidateMode: 'onChange',  // 修正后实时验证
  defaultValues: { /* */ }     // 提供默认值
})
```

### 错误信息显示

```tsx
// 直接使用验证器错误信息
{errors.fieldName && (
  <span className="error">{errors.fieldName.message}</span>
)}
```

### 类型安全

```typescript
import type { z } from 'zod'

// 自动推断表单数据类型
type LoginFormData = z.infer<typeof loginFormSchema>
type SignupFormData = z.infer<typeof signupFormSchema>
```

## 🔮 项目集成

### 当前集成状态

- ✅ **Next.js App** - 完全集成，统一验证体验
- ✅ **Nuxt.js App** - 完全集成，统一验证体验
- ✅ **多语言支持** - 英文、中文错误信息
- ✅ **手机号验证** - 支持多国家/地区
- ✅ **类型安全** - 完整 TypeScript 支持

### 已集成的表单

- 登录表单 (`/signin`)
- 注册表单 (`/signup`) 
- 忘记密码表单 (`/forgot-password`)
- 重置密码表单 (`/reset-password`)
- 手机登录表单 (`/cellphone`)
- 修改密码对话框
- 管理员用户管理表单

## 🤝 贡献指南

### 添加新验证器

1. 在 `libs/validators/user.ts` 中添加验证器逻辑
2. 在翻译文件中添加对应的错误消息键
3. 更新类型定义和导出
4. 添加单元测试
5. 更新文档

### 添加新翻译

1. 在 `libs/i18n/locales/` 中添加新语言文件
2. 添加 `validators.user.*` 翻译键
3. 测试参数插值功能

---

**💡 提示**: 这是一个现代化、完全国际化的验证器系统。Vue.js 直接使用 `t` 函数，Next.js 使用 `createNextTranslationFunction` 创建增强的翻译函数。 