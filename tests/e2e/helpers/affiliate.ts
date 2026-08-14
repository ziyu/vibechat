import { config } from 'dotenv'
import { resolve } from 'node:path'
import { executeLocalD1, getE2eDialect, sqlString } from './d1'

config({ path: resolve(__dirname, '../../../.env') })

/** Seeds only the balance prerequisite; all withdrawal state transitions still use public/Admin APIs. */
export async function setCommissionBalance(userId: string, amount: number): Promise<void> {
  const dialect = getE2eDialect()
  if (dialect === 'd1') {
    await executeLocalD1(
      `UPDATE user SET commission_balance = ${sqlString(String(amount))} WHERE id = ${sqlString(userId)}`,
    )
    return
  }
  if (dialect === 'sqlite') {
    const Database = (await import('better-sqlite3')).default
    const databasePath = resolve(
      __dirname,
      '../../..',
      process.env.SQLITE_DB_PATH || './data/local.sqlite',
    )
    const database = new Database(databasePath)
    try {
      database.prepare('UPDATE user SET commission_balance = ? WHERE id = ?').run(String(amount), userId)
    } finally {
      database.close()
    }
    return
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set — cannot seed commission balance.')
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    await pool.query('UPDATE "user" SET commission_balance = $1 WHERE id = $2', [amount, userId])
  } finally {
    await pool.end()
  }
}
