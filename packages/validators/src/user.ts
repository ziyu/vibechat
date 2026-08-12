import { z } from 'zod';
import { adminUserRoles } from '@vibechat/api-contracts/admin';
import { getTranslation } from '@vibechat/i18n';
// 手机号码数据类型
export interface CountryCode {
  code: string;
  nameKey: string; // i18n key instead of hardcoded name
  flag: string;
  phoneLength: number[];
  format?: string;
}

// 常用国家/地区代码
export const countryCodes: CountryCode[] = [
  { code: '+86', nameKey: 'china', flag: '🇨🇳', phoneLength: [11], format: 'XXX XXXX XXXX' },
  { code: '+1', nameKey: 'usa', flag: '🇺🇸', phoneLength: [10], format: 'XXX XXX XXXX' },
  { code: '+44', nameKey: 'uk', flag: '🇬🇧', phoneLength: [10, 11], format: 'XXXX XXX XXXX' },
  { code: '+81', nameKey: 'japan', flag: '🇯🇵', phoneLength: [10, 11], format: 'XX XXXX XXXX' },
  { code: '+82', nameKey: 'korea', flag: '🇰🇷', phoneLength: [10, 11], format: 'XX XXXX XXXX' },
  { code: '+65', nameKey: 'singapore', flag: '🇸🇬', phoneLength: [8], format: 'XXXX XXXX' },
  { code: '+852', nameKey: 'hongkong', flag: '🇭🇰', phoneLength: [8], format: 'XXXX XXXX' },
  { code: '+853', nameKey: 'macau', flag: '🇲🇴', phoneLength: [8], format: 'XXXX XXXX' },
  { code: '+61', nameKey: 'australia', flag: '🇦🇺', phoneLength: [9], format: 'XXX XXX XXX' },
  { code: '+33', nameKey: 'france', flag: '🇫🇷', phoneLength: [10], format: 'X XX XX XX XX' },
  { code: '+49', nameKey: 'germany', flag: '🇩🇪', phoneLength: [10, 11], format: 'XXX XXXXXXX' },
  { code: '+91', nameKey: 'india', flag: '🇮🇳', phoneLength: [10], format: 'XXXXX XXXXX' },
  { code: '+60', nameKey: 'malaysia', flag: '🇲🇾', phoneLength: [9, 10], format: 'XX XXXX XXXX' },
  { code: '+66', nameKey: 'thailand', flag: '🇹🇭', phoneLength: [9], format: 'X XXXX XXXX' },
];

// 简单的辅助函数：获取带翻译的国家列表
export function getCountriesWithNames(locale: 'en' | 'zh-CN') {
  const t = getTranslation(locale);

  return countryCodes.map(country => ({
    ...country,
    name: t.countries[country.nameKey as keyof typeof t.countries]
  }));
}

// 根据手机号长度和国家代码验证手机号
function validatePhoneNumber(phone: string, countryCode: string): boolean {
  const country = countryCodes.find(c => c.code === countryCode);
  if (!country) return false;

  // 移除所有非数字字符
  const cleanPhone = phone.replace(/\D/g, '');
  return country.phoneLength.includes(cleanPhone.length);
}

// 翻译函数类型定义
type TranslationFunction = (key: string, params?: Record<string, any>) => string;

// 创建国际化验证器的工厂函数
export function createValidators(t: TranslationFunction) {
  // 基础用户验证器
  const userSchema = z.object({
    name: z.string()
      .min(2, t('validators.user.name.minLength', { min: 2 }))
      .max(50, t('validators.user.name.maxLength', { max: 50 })),
    email: z.email(t('validators.user.email.invalid')),
    emailVerified: z.boolean(),
    image: z.url(t('validators.user.image.invalidUrl')).nullable().optional(),
    role: z.enum([adminUserRoles.admin, adminUserRoles.user]),
    phoneNumber: z.string().nullable().optional(),
    phoneNumberVerified: z.boolean(),
    banned: z.boolean(),
    banReason: z.string().nullable().optional(),
  });

  // 邮箱注册验证器
  const emailSignUpSchema = z.object({
    name: z.string()
      .min(2, t('validators.user.name.minLength', { min: 2 }))
      .max(50, t('validators.user.name.maxLength', { max: 50 })),
    email: z.string().email(t('validators.user.email.invalid')),
    password: z.string()
      .min(8, t('validators.user.password.minLength', { min: 8 }))
      .max(100, t('validators.user.password.maxLength', { max: 100 })),
  });

  // 扩展的注册表单验证器（包含可选的图片URL）
  const signupFormSchema = emailSignUpSchema.extend({
    image: z.url(t('validators.user.image.invalidUrl')).optional().or(z.literal('')),
  });

  // 邮箱登录验证器
  const emailSignInSchema = z.object({
    email: z.string().email(t('validators.user.email.invalid')),
    password: z.string()
      .min(8, t('validators.user.password.minLength', { min: 8 }))
      .max(100, t('validators.user.password.maxLength', { max: 100 })),
  });

  // 扩展的登录表单验证器（包含记住我选项）
  const loginFormSchema = emailSignInSchema.extend({
    remember: z.boolean().default(false),
  });

  // 手机号注册验证器
  const phoneSignUpSchema = z.object({
    countryCode: z.string().min(1, t('validators.user.countryCode.required')),
    phoneNumber: z.string().min(1, t('validators.user.phoneNumber.required')),
    code: z.string().length(6, t('validators.user.verificationCode.invalidLength', { length: 6 })),
  }).refine((data) => validatePhoneNumber(data.phoneNumber, data.countryCode), {
    message: t('validators.user.phoneNumber.invalid'),
    path: ["phoneNumber"],
  });

  // 手机号登录第一步验证器（发送验证码）
  const phoneLoginSchema = z.object({
    countryCode: z.string().min(1, t('validators.user.countryCode.required')),
    phone: z.string().min(1, t('validators.user.phoneNumber.required')),
  }).refine((data) => validatePhoneNumber(data.phone, data.countryCode), {
    message: t('validators.user.phoneNumber.invalid'),
    path: ["phone"],
  });

  // 手机号登录第二步验证器（验证验证码）
  const phoneVerifySchema = z.object({
    countryCode: z.string().min(1, t('validators.user.countryCode.required')),
    phone: z.string().min(1, t('validators.user.phoneNumber.required')),
    code: z.string().length(6, t('validators.user.verificationCode.invalidLength', { length: 6 })),
  });

  // 更新用户验证器 - 所有字段都是可选的
  const updateUserSchema = userSchema.partial();

  // 用户ID验证器
  const userIdSchema = z.object({
    id: z.string().min(1, t('validators.user.id.required')),
  });

  // 忘记密码验证器
  const forgetPasswordSchema = z.object({
    email: z.string().email(t('validators.user.email.invalid')),
  });

  // 重置密码验证器
  const resetPasswordSchema = z.object({
    password: z.string()
      .min(8, t('validators.user.password.minLength', { min: 8 }))
      .max(100, t('validators.user.password.maxLength', { max: 100 })),
    confirmPassword: z.string()
      .min(8, t('validators.user.password.minLength', { min: 8 }))
      .max(100, t('validators.user.password.maxLength', { max: 100 })),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validators.user.password.mismatch'),
    path: ["confirmPassword"],
  });

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, t('validators.user.currentPassword.required')),
    newPassword: z.string().min(8, t('validators.user.password.minLength', { min: 8 })),
    confirmPassword: z.string().min(1, t('validators.user.confirmPassword.required'))
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('validators.user.password.mismatch'),
    path: ["confirmPassword"],
  });

  // Delete account validation schema
  const deleteAccountSchema = z.object({
    confirm: z.boolean().refine(val => val === true, {
      message: t('validators.user.deleteAccount.confirmRequired')
    })
  });

  return {
    userSchema,
    emailSignUpSchema,
    signupFormSchema,
    emailSignInSchema,
    loginFormSchema,
    phoneSignUpSchema,
    phoneLoginSchema,
    phoneVerifySchema,
    updateUserSchema,
    userIdSchema,
    forgetPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    deleteAccountSchema,
  };
}

// 为了向后兼容，保留默认的英文版本验证器
export const {
  userSchema,
  emailSignUpSchema,
  signupFormSchema,
  emailSignInSchema,
  loginFormSchema,
  phoneSignUpSchema,
  phoneLoginSchema,
  phoneVerifySchema,
  updateUserSchema,
  userIdSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  deleteAccountSchema,
} = createValidators((key: string, params?: Record<string, any>) => {
  // 默认英文错误消息的简单实现
  const defaultMessages: Record<string, string> = {
    'validators.user.name.minLength': `Name must be at least ${params?.min || 2} characters`,
    'validators.user.name.maxLength': `Name must be less than ${params?.max || 50} characters`,
    'validators.user.email.invalid': 'Please enter a valid email address',
    'validators.user.image.invalidUrl': 'Please enter a valid URL',
    'validators.user.password.minLength': `Password must be at least ${params?.min || 8} characters`,
    'validators.user.password.maxLength': `Password must be less than ${params?.max || 100} characters`,
    'validators.user.password.mismatch': "Passwords don't match",
    'validators.user.countryCode.required': 'Please select country/region',
    'validators.user.phoneNumber.required': 'Please enter phone number',
    'validators.user.phoneNumber.invalid': 'Invalid phone number format',
    'validators.user.verificationCode.invalidLength': `Verification code must be ${params?.length || 6} characters`,
    'validators.user.id.required': 'User ID is required',
    'validators.user.currentPassword.required': 'Current password is required',
    'validators.user.confirmPassword.required': 'Please confirm your password',
    'validators.user.deleteAccount.confirmRequired': 'You must confirm account deletion',
  };

  return defaultMessages[key] || key;
});
