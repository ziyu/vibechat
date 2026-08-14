import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const databasePath = `/tmp/vibechat-referral-${process.pid}-${Date.now()}.sqlite`
let database: typeof import('@libs/database')
let referral: typeof import('@libs/affiliate/referral')

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  process.env.AFFILIATE_ENABLED = 'true'
  process.env.AFFILIATE_REFERRER_SIGNUP_BONUS = '10'
  process.env.AFFILIATE_REFEREE_SIGNUP_BONUS = '10'
  vi.resetModules()
  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' })
  await database.db.insert(database.user).values([
    { id: 'referrer', name: 'Referrer', email: 'referrer@example.com', emailVerified: true, referralCode: 'REFCODE1' },
    { id: 'referee', name: 'Referee', email: 'referee@example.com', emailVerified: true },
  ])
  referral = await import('@libs/affiliate/referral')
})

afterAll(() => {
  database.sqliteInstance?.close()
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`
    if (existsSync(path)) rmSync(path, { force: true })
  }
  delete process.env.SQLITE_DB_PATH
  delete process.env.DB_DIALECT
  delete process.env.AFFILIATE_ENABLED
})

describe('referral attribution', () => {
  it('attributes and grants each signup bonus exactly once on retries', async () => {
    const first = await referral.applyReferralCodeToUser({ userId: 'referee', referralCode: 'REFCODE1' })
    const repeated = await referral.applyReferralCodeToUser({ userId: 'referee', referralCode: 'REFCODE1' })
    expect(first).toMatchObject({ applied: true, bonusGranted: true })
    expect(repeated).toMatchObject({ applied: true, bonusGranted: true })

    const users = await database.db.select().from(database.user)
    expect(users.find((entry) => entry.id === 'referee')).toMatchObject({ referredByCode: 'REFCODE1', creditBalance: '10.0' })
    expect(users.find((entry) => entry.id === 'referrer')).toMatchObject({ creditBalance: '10.0' })
    const credits = await database.db.select().from(database.creditTransaction)
    expect(credits.filter((entry) => entry.id.startsWith('referral:'))).toHaveLength(2)
  })

  it('rejects self-referral', async () => {
    await expect(referral.applyReferralCodeToUser({ userId: 'referrer', referralCode: 'REFCODE1' }))
      .resolves.toEqual({ applied: false, reason: 'self_referral' })
  })
})
