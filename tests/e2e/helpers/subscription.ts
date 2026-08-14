import { config } from 'dotenv'
import { resolve } from 'node:path'
import { executeLocalD1, getE2eDialect, sqlString } from './d1'

config({ path: resolve(__dirname, '../../../.env') })

/** Seed a deterministic active entitlement for route-guard E2E coverage. */
export async function seedActiveSubscription(userId: string): Promise<void> {
  const id = `e2e-subscription-${userId}`
  const start = new Date()
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  const dialect = getE2eDialect()

  if (dialect === 'd1') {
    await executeLocalD1(
      `INSERT INTO subscription (id, user_id, plan_id, status, payment_type, period_start, period_end, cancel_at_period_end, created_at, updated_at)
       VALUES (${sqlString(id)}, ${sqlString(userId)}, 'monthly', 'active', 'recurring', ${Math.floor(start.getTime() / 1000)}, ${Math.floor(end.getTime() / 1000)}, 0, ${Math.floor(start.getTime() / 1000)}, ${Math.floor(start.getTime() / 1000)})`,
    )
    return
  }

  if (dialect === 'sqlite') {
    const Database = (await import('better-sqlite3')).default
    const db = new Database(resolve(__dirname, '../../..', process.env.SQLITE_DB_PATH || './data/local.sqlite'))
    try {
      db.prepare(
        `INSERT INTO subscription (id, user_id, plan_id, status, payment_type, period_start, period_end, cancel_at_period_end, created_at, updated_at)
         VALUES (?, ?, 'monthly', 'active', 'recurring', ?, ?, 0, ?, ?)`,
      ).run(id, userId, Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000), Math.floor(start.getTime() / 1000), Math.floor(start.getTime() / 1000))
    } finally {
      db.close()
    }
    return
  }

  const { Pool } = await import('pg')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set — cannot seed a subscription.')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(
      `INSERT INTO subscription (id, user_id, plan_id, status, payment_type, period_start, period_end, cancel_at_period_end, created_at, updated_at)
       VALUES ($1, $2, 'monthly', 'active', 'recurring', $3, $4, false, $3, $3)`,
      [id, userId, start, end],
    )
  } finally {
    await pool.end()
  }
}
