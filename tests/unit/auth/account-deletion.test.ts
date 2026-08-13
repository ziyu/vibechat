import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const databasePath = `/tmp/vibechat-account-deletion-${process.pid}-${Date.now()}.sqlite`
let database: typeof import('@libs/database')
let guard: typeof import('@libs/auth/account-deletion')

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  vi.resetModules()
  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' })
  await database.db.insert(database.user).values([
    { id: 'deletable-user', name: 'Deletable', email: 'deletable@example.com', emailVerified: true },
    { id: 'subscribed-user', name: 'Subscribed', email: 'subscribed@example.com', emailVerified: true },
  ])
  guard = await import('@libs/auth/account-deletion')
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

describe('account deletion billing guard', () => {
  it('allows an account without an active external recurring subscription', async () => {
    await expect(guard.assertAccountDeletionAllowed('deletable-user')).resolves.toBeUndefined()
  })

  it('blocks deletion while an external recurring subscription is active', async () => {
    const now = Date.now()
    await database.db.insert(database.subscription).values({
      id: 'active-external-subscription',
      userId: 'subscribed-user',
      planId: 'monthly',
      status: 'active',
      paymentType: 'recurring',
      stripeSubscriptionId: 'sub_external_1',
      periodStart: new Date(now - 60_000),
      periodEnd: new Date(now + 86_400_000),
    })
    await expect(guard.assertAccountDeletionAllowed('subscribed-user')).rejects.toMatchObject({
      body: expect.objectContaining({ code: 'ACTIVE_SUBSCRIPTION' }),
    })
  })
})
