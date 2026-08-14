/**
 * E2E Test Constants
 *
 * Shared constants for all E2E test specs.
 * Product routes are locale-neutral. Locale setup belongs in the individual test.
 */

/** Test user credentials for signup/signin flows */
export const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

/**
 * Generate a unique test email for each test run.
 * Prevents conflicts when tests create accounts.
 *
 * Always prefixes with `e2e-` so global-teardown.ts can match
 * all test users via `email LIKE 'e2e-%@example.com'`.
 */
export function uniqueEmail(prefix = 'test'): string {
  const slug = prefix.startsWith('e2e-') ? prefix.slice(4) : prefix;
  return `e2e-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Well-known canonical product paths */
export const PAGES = {
  home: '/',
  signin: '/signin',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  pricing: '/pricing',
  paymentSuccess: '/payment-success',
  paymentCancel: '/payment-cancel',
  ai: '/ai',
  imageGenerate: '/image-generate',
  videoGenerate: '/video-generate',
  upload: '/upload',
  premiumFeatures: '/premium-features',
  admin: '/admin',
  adminUsers: '/admin/users',
  adminSubscriptions: '/admin/subscriptions',
  adminOrders: '/admin/orders',
  adminCredits: '/admin/credits',
  adminBlog: '/admin/blog',
  adminBlogNew: '/admin/blog/new',
  adminCommissions: '/admin/commissions',
  adminWithdrawals: '/admin/withdrawals',
  adminPricing: '/admin/pricing',
  adminPricingNew: '/admin/pricing/new',
  blog: '/blog',
} as const;

/** Pre-existing admin account (not created by tests, not cleaned up) */
export const ADMIN_USER = {
  email: 'admin@example.com',
  password: 'admin123',
} as const;

/** API endpoints used in auth helpers */
export const API = {
  signUp: '/api/auth/sign-up/email',
  signIn: '/api/auth/sign-in/email',
  signOut: '/api/auth/sign-out',
  getSession: '/api/auth/get-session',
  paymentInitiate: '/api/payment/initiate',
  affiliateStats: '/api/affiliate/stats',
  affiliateReferrals: '/api/affiliate/referrals',
  affiliateCommissions: '/api/affiliate/commissions',
  affiliateClaim: '/api/affiliate/claim',
  withdrawalRequest: '/api/withdrawal/request',
  withdrawalHistory: '/api/withdrawal/history',
  adminPricingPlans: '/api/admin/pricing-plans',
  adminPricingImport: '/api/admin/pricing-plans/import',
} as const;

/** Timeouts for various operations */
export const TIMEOUTS = {
  /** Page navigation + hydration (Nuxt first-load compile may be slower) */
  navigation: 30_000,
  /** Auth API calls (cold boot compilation can be slow in dev mode) */
  auth: 30_000,
  /** Stripe Checkout interactions (external page, may be slower) */
  stripe: 30_000,
} as const;
