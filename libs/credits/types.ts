import type { CreditTransaction } from '@libs/database/schema/credit-transaction';

export type CreditTransactionType = 'purchase' | 'consumption' | 'refund' | 'bonus' | 'adjustment';

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
