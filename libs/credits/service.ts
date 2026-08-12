import { db } from '@libs/database';
import { creditTransaction, user } from '@libs/database/schema';
import { and, asc, count, desc, eq, like } from 'drizzle-orm';
import type { GetAllTransactionsOptions, GetTransactionsPaginatedResult } from './types';

/** Read-only ledger queries consumed by the Admin API. */
export class CreditLedgerQueryService {
  async getAllTransactionsPaginated(
    options: GetAllTransactionsOptions = {}
  ): Promise<GetTransactionsPaginatedResult> {
    const {
      page = 1,
      limit = 10,
      searchField,
      searchValue,
      type,
      userId,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = options;
    const offset = (page - 1) * limit;
    const conditions = [];

    if (searchValue && searchField) {
      if (searchField === 'id') conditions.push(eq(creditTransaction.id, searchValue));
      if (searchField === 'userId') conditions.push(eq(creditTransaction.userId, searchValue));
      if (searchField === 'userEmail') conditions.push(like(user.email, `%${searchValue}%`));
      if (searchField === 'userName') conditions.push(like(user.name, `%${searchValue}%`));
      if (searchField === 'description') conditions.push(like(creditTransaction.description, `%${searchValue}%`));
    }
    if (type) conditions.push(eq(creditTransaction.type, type));
    if (userId) conditions.push(eq(creditTransaction.userId, userId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db.select({ count: count() })
      .from(creditTransaction)
      .leftJoin(user, eq(creditTransaction.userId, user.id));
    const [countRow] = where ? await countQuery.where(where) : await countQuery;
    const total = countRow?.count || 0;

    const column = sortBy === 'id' ? creditTransaction.id
      : sortBy === 'userId' ? creditTransaction.userId
      : sortBy === 'userEmail' ? user.email
      : sortBy === 'type' ? creditTransaction.type
      : sortBy === 'amount' ? creditTransaction.amount
      : creditTransaction.createdAt;
    const orderBy = sortDirection === 'asc' ? asc(column) : desc(column);

    const dataQuery = db.select({
      id: creditTransaction.id,
      userId: creditTransaction.userId,
      type: creditTransaction.type,
      amount: creditTransaction.amount,
      balance: creditTransaction.balance,
      orderId: creditTransaction.orderId,
      description: creditTransaction.description,
      metadata: creditTransaction.metadata,
      createdAt: creditTransaction.createdAt,
      userEmail: user.email,
      userName: user.name,
    }).from(creditTransaction).leftJoin(user, eq(creditTransaction.userId, user.id));
    const transactions = where
      ? await dataQuery.where(where).orderBy(orderBy).limit(limit).offset(offset)
      : await dataQuery.orderBy(orderBy).limit(limit).offset(offset);

    return { transactions, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }
}

export const creditLedgerQueryService = new CreditLedgerQueryService();
