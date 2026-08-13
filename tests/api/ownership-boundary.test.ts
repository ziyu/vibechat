import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

const databasePath = `/tmp/vibechat-ownership-${process.pid}-${Date.now()}.sqlite`
let database: typeof import('@libs/database')

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  vi.resetModules()
  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' })
  await database.db.insert(database.user).values([
    { id: 'owner-a', name: 'Owner A', email: 'owner-a@example.com', emailVerified: true },
    { id: 'owner-b', name: 'Owner B', email: 'owner-b@example.com', emailVerified: true },
  ])
  await database.db.insert(database.order).values([
    { id: 'order-owner-a', userId: 'owner-a', amount: '9.99', currency: 'USD', planId: 'test-plan', status: 'pending', provider: 'stripe' },
    { id: 'order-owner-b', userId: 'owner-b', amount: '19.99', currency: 'USD', planId: 'test-plan', status: 'pending', provider: 'stripe' },
  ])
})

afterAll(() => {
  database.sqliteInstance?.close()
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`
    if (existsSync(path)) rmSync(path, { force: true })
  }
  delete process.env.SQLITE_DB_PATH
  delete process.env.DB_DIALECT
})

describe('user-owned billing records', () => {
  it('can be scoped to owner A without leaking owner B', async () => {
    const rows = await database.db.select().from(database.order).where(eq(database.order.userId, 'owner-a'))
    expect(rows.map((row) => row.id)).toEqual(['order-owner-a'])
  })

  it('can be scoped to owner B without leaking owner A', async () => {
    const rows = await database.db.select().from(database.order).where(eq(database.order.userId, 'owner-b'))
    expect(rows.map((row) => row.id)).toEqual(['order-owner-b'])
  })
})
