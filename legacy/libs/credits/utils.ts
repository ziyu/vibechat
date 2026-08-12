/**
 * Utility functions for credits library
 */

/**
 * Transaction type codes for database storage
 * These codes are language-agnostic and can be used for i18n at display time
 */
export const TransactionTypeCode = {
  PURCHASE: 'purchase',
  BONUS: 'bonus',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  REFERRAL_SIGNUP_BONUS: 'referral_signup_bonus',
  REFERRAL_REFERRER_BONUS: 'referral_referrer_bonus',
} as const;

export type TransactionTypeCode = typeof TransactionTypeCode[keyof typeof TransactionTypeCode];
