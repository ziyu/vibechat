import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const databasePath = `/tmp/vibechat-new-user-grant-${process.pid}-${Date.now()}.sqlite`
const previousNewUserGrant = process.env.CREDITS_NEW_USER_GRANT
let database: typeof import('@libs/database')
let grants: typeof import('@libs/credits/new-user-grant')

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  delete process.env.CREDITS_NEW_USER_GRANT
  vi.resetModules()
  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' })
  await database.db.insert(database.user).values({
    id: 'new-user',
    name: 'New User',
    email: 'new-user@example.com',
    emailVerified: true,
  })
  grants = await import('@libs/credits/new-user-grant')
})

afterAll(() => {
  database.sqliteInstance?.close()
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`
    if (existsSync(path)) rmSync(path, { force: true })
  }
  if (previousNewUserGrant === undefined) {
    delete process.env.CREDITS_NEW_USER_GRANT
  } else {
    process.env.CREDITS_NEW_USER_GRANT = previousNewUserGrant
  }
  delete process.env.SQLITE_DB_PATH
  delete process.env.DB_DIALECT
})

describe('new user credit grant', () => {
  it('grants the configured welcome balance and ledger entry exactly once', async () => {
    const first = await grants.grantNewUserCredits('new-user')
    const repeated = await grants.grantNewUserCredits('new-user')

    expect(first.id).toBe('signup:welcome:new-user')
    expect(repeated.id).toBe(first.id)

    const [storedUser] = await database.db.select().from(database.user)
    expect(Number(storedUser.creditBalance)).toBe(1000)

    const transactions = await database.db.select().from(database.creditTransaction)
    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({
      id: 'signup:welcome:new-user',
      type: 'bonus',
      amount: '1000',
      description: 'new_user_bonus',
    })
  })
})
