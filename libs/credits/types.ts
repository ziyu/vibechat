import type { CreditTransaction } from '@libs/database/schema/credit-transaction';

export type CreditTransactionType = 'purchase' | 'consumption' | 'refund' | 'bonus' | 'adjustment';

export interface AddCreditsParams {
  userId: string;
  amount: number;
  type: Exclude<CreditTransactionType, 'consumption'>;
  orderId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  /** Stable internal ID used to make webhook, bonus, and refund retries idempotent. */
  transactionId?: string;
}

export interface ConsumeCreditsParams {
  userId: string;
  amount: number;
  description?: string;
  metadata?: Record<string, unknown>;
  /** Stable internal ID used to make usage retries idempotent. */
  transactionId?: string;
}

export interface ConsumeCreditsResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  idempotent?: boolean;
  error?: string;
}

export interface GetTransactionsOptions {
  limit?: number;
  offset?: number;
  page?: number;
  type?: CreditTransactionType;
}

export interface GetAllTransactionsOptions {
  page?: number;
  limit?: number;
  searchField?: string;
  searchValue?: string;
  type?: CreditTransactionType;
  userId?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface GetTransactionsPaginatedResult {
  transactions: Array<CreditTransaction & { userEmail?: string | null; userName?: string | null }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AIUsageMetadata {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  messageCount?: number;
}

export interface CalculateConsumptionParams {
  totalTokens: number;
  model: string;
  provider: string;
  type?: 'aiChat' | 'aiImage' | 'aiVideo';
}
