import { AsyncLocalStorage } from 'node:async_hooks'
import * as fs from 'fs'
import * as path from 'path'
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres'
import { drizzle as sqliteDrizzle } from 'drizzle-orm/better-sqlite3'
import { drizzle as d1Drizzle } from 'drizzle-orm/d1'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import Database from 'better-sqlite3'
import { Pool, Client } from 'pg'
import { getDialect, isSqliteDialect } from './shared/dialect'
import type { Dialect } from './shared/dialect'
import { createRunD1Batch, type D1BatchCapable } from './shared/d1-batch'

// Re-export shared, dialect-independent constants and types
export * from './constants'
export { getDialect, isSqliteDialect, isD1Dialect, type Dialect } from './shared/dialect'
export { toSqlDate } from './shared/dialect'
export { type D1BatchCapable } from './shared/d1-batch'

// Type-only exports (always PG types, identical shape to SQLite at runtime)
export type { User, NewUser } from './schema/pg/user'
export type { CreditTransaction, NewCreditTransaction } from './schema/pg/credit-transaction'
export type { BlogPost, NewBlogPost } from './schema/pg/blog-post'
export type { Commission, NewCommission } from './schema/pg/commission'
export type { Withdrawal, NewWithdrawal } from './schema/pg/withdrawal'
export type { PricingPlan, NewPricingPlan } from './schema/pg/pricing-plan'
export type {
  IntegrationOutboxEvent,
  MatrixIdentity,
  MatrixSessionBinding,
  NewIntegrationOutboxEvent,
  NewMatrixIdentity,
  NewMatrixSessionBinding,
  NewUserProfile,
  UserProfile,
} from './schema/pg/identity'
export type { BlogPostStatus } from './constants'
export type { NewRoomIndex, RoomIndex } from './schema/pg/room'
export type {
  NewSpaceRuntimeInstanceStateRow,
  NewSpaceRuntimeLeaseRow,
  NewSpaceRuntimeOutboxRow,
  NewSpaceRuntimeProjectRow,
  NewSpaceRuntimeTurnRow,
  SpaceRuntimeInstanceStateRow,
  SpaceRuntimeLeaseRow,
  SpaceRuntimeOutboxRow,
  SpaceRuntimeProjectRow,
  SpaceRuntimeTurnRow,
} from './schema/pg/space-runtime-control'
export type {
  NewRoomUserPreference,
  NewSpaceFavorite,
  NewUserPreference,
  RoomUserPreference,
  SpaceFavorite,
  UserPreference,
} from './schema/pg/product-state'
export type {
  Block,
  Contact,
  FriendRequest,
  NewBlock,
  NewContact,
  NewFriendRequest,
} from './schema/pg/social'
export type { AiGenerationTask, NewAiGenerationTask } from './schema/pg/ai-generation-task'
export type {
  NewSpaceAgentAuditEventRow,
  NewSpaceAgentBindingRow,
  NewSpaceAgentDefinitionRow,
  NewSpaceAgentSessionRow,
  SpaceAgentAuditEventRow,
  SpaceAgentBindingRow,
  SpaceAgentDefinitionRow,
  SpaceAgentSessionRow,
} from './schema/pg/space-agent'

// Schema table exports (dialect-aware via proxy modules, Turbopack compatible)
export { user } from './schema/user'
export { account, session, verification } from './schema/auth'
export { order } from './schema/order'
export { subscription } from './schema/subscription'
export { creditTransaction } from './schema/credit-transaction'
export { commission } from './schema/commission'
export { withdrawal } from './schema/withdrawal'
export { blogPost } from './schema/blog-post'
export { pricingPlan } from './schema/pricing-plan'
export { roomIndex } from './schema/room'
export {
  spaceRuntimeInstanceState,
  spaceRuntimeLease,
  spaceRuntimeOutbox,
  spaceRuntimeProject,
  spaceRuntimeTurn,
} from './schema/space-runtime-control'
export { roomUserPreference, spaceFavorite, userPreference } from './schema/product-state'
export { block, contact, friendRequest } from './schema/social'
export { integrationOutbox, matrixIdentity, matrixSessionBinding, userProfile } from './schema/identity'
export { aiGenerationTask } from './schema/ai-generation-task'
export {
  spaceAgentAuditEvent,
  spaceAgentBinding,
  spaceAgentDefinition,
  spaceAgentSession,
} from './schema/space-agent'

// Build a schema object for drizzle() initialization from proxy exports.
// Proxy modules return the correct dialect's tables at runtime.
import { user as _user } from './schema/user'
import { account as _account, session as _session, verification as _verification } from './schema/auth'
import { order as _order } from './schema/order'
import { subscription as _subscription } from './schema/subscription'
import { creditTransaction as _creditTransaction } from './schema/credit-transaction'
import { commission as _commission } from './schema/commission'
import { withdrawal as _withdrawal } from './schema/withdrawal'
import { blogPost as _blogPost } from './schema/blog-post'
import { pricingPlan as _pricingPlan } from './schema/pricing-plan'
import { roomIndex as _roomIndex } from './schema/room'
import {
  spaceRuntimeInstanceState as _spaceRuntimeInstanceState,
  spaceRuntimeLease as _spaceRuntimeLease,
  spaceRuntimeOutbox as _spaceRuntimeOutbox,
  spaceRuntimeProject as _spaceRuntimeProject,
  spaceRuntimeTurn as _spaceRuntimeTurn,
} from './schema/space-runtime-control'
import {
  roomUserPreference as _roomUserPreference,
  spaceFavorite as _spaceFavorite,
  userPreference as _userPreference,
} from './schema/product-state'
import { block as _block, contact as _contact, friendRequest as _friendRequest } from './schema/social'
import {
  integrationOutbox as _integrationOutbox,
  matrixIdentity as _matrixIdentity,
  matrixSessionBinding as _matrixSessionBinding,
  userProfile as _userProfile,
} from './schema/identity'
import { aiGenerationTask as _aiGenerationTask } from './schema/ai-generation-task'
import {
  spaceAgentAuditEvent as _spaceAgentAuditEvent,
  spaceAgentBinding as _spaceAgentBinding,
  spaceAgentDefinition as _spaceAgentDefinition,
  spaceAgentSession as _spaceAgentSession,
} from './schema/space-agent'

const _schema = {
  user: _user, account: _account, session: _session, verification: _verification,
  order: _order, subscription: _subscription, creditTransaction: _creditTransaction,
  commission: _commission, withdrawal: _withdrawal,
  blogPost: _blogPost, pricingPlan: _pricingPlan,
  roomIndex: _roomIndex,
  spaceRuntimeInstanceState: _spaceRuntimeInstanceState,
  spaceRuntimeProject: _spaceRuntimeProject,
  spaceRuntimeTurn: _spaceRuntimeTurn,
  spaceRuntimeLease: _spaceRuntimeLease,
  spaceRuntimeOutbox: _spaceRuntimeOutbox,
  userPreference: _userPreference, roomUserPreference: _roomUserPreference,
  spaceFavorite: _spaceFavorite,
  block: _block, contact: _contact, friendRequest: _friendRequest,
  userProfile: _userProfile, matrixIdentity: _matrixIdentity,
  matrixSessionBinding: _matrixSessionBinding, integrationOutbox: _integrationOutbox,
  aiGenerationTask: _aiGenerationTask,
  spaceAgentDefinition: _spaceAgentDefinition,
  spaceAgentBinding: _spaceAgentBinding,
  spaceAgentSession: _spaceAgentSession,
  spaceAgentAuditEvent: _spaceAgentAuditEvent,
}

// ---------------------------------------------------------------------------
// Runtime dialect selection
//
// All driver dependencies (pg, better-sqlite3, drizzle adapters) are imported
// statically at the top. Only the initialization code (Pool creation, DB file
// open, etc.) is guarded by the dialect check — unused imports are harmless.
//
// better-sqlite3 must be in serverExternalPackages (Next.js) so Turbopack
// externalizes the native addon instead of trying to bundle it.
// ---------------------------------------------------------------------------

const _dialect = getDialect()

let _runD1Batch: ReturnType<typeof createRunD1Batch> = async () => {
  throw new Error('[db] runD1Batch requires DB_DIALECT=d1')
}
type D1NativeStatement = { sql: string; params?: unknown[] }
let _runNativeD1Batch: (statements: readonly D1NativeStatement[]) => Promise<any[]> = async () => {
  throw new Error('[db] runNativeD1Batch requires DB_DIALECT=d1')
}
let _db: any
let _pool: any
let _isWorkersRuntime = false
let _getConnectionString: () => string = () => ''
let _withRequestClient: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => fn()
let _withFreshRequestClient: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => fn()
let _query: any = {}
let _sqliteInstance: any
let _withD1: any
let _setHyperdriveBinding: (binding: any) => void = () => {}

// ──────────────────────────── SQLite ────────────────────────────────
if (_dialect === 'sqlite') {

  function getSqlitePath(): string {
    if (process.env.SQLITE_DB_PATH) {
      return path.resolve(process.env.SQLITE_DB_PATH)
    }
    let dir = process.cwd()
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
        return path.resolve(dir, 'data', 'local.sqlite')
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return path.resolve(process.cwd(), 'data', 'local.sqlite')
  }

  const dbPath = getSqlitePath()
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  console.log('[db] using SQLite file:', dbPath)
  console.log('[db] query strategy:', 'better-sqlite3 (synchronous)')

  _db = sqliteDrizzle(sqlite, { schema: _schema })
  _sqliteInstance = sqlite
  _getConnectionString = () => dbPath
  _query = {
    user: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.user).where(params.where).limit(1)
        return result[0]
      },
    },
    order: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.order).where(params.where).limit(1)
        return result[0]
      },
    },
    commission: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.commission).where(params.where).limit(1)
        return result[0]
      },
    },
  }

// ──────────────────────────── D1 ───────────────────────────────────
} else if (_dialect === 'd1') {

  const d1Store = new AsyncLocalStorage<any>()

  function getD1Db(): DrizzleD1Database<typeof _schema> {
    const binding = d1Store.getStore()
    if (!binding) {
      throw new Error(
        '[db/d1] D1 binding not available. ' +
        'Wrap your handler with withD1(binding, fn) before accessing the database.'
      )
    }
    return d1Drizzle(binding, { schema: _schema })
  }

  _db = new Proxy({} as DrizzleD1Database<typeof _schema>, {
    get(_, prop) { return Reflect.get(getD1Db(), prop) },
  })
  _runD1Batch = createRunD1Batch(_db as unknown as D1BatchCapable)
  _runNativeD1Batch = async (statements) => {
    const binding = d1Store.getStore()
    if (!binding) throw new Error('[db] D1 binding is unavailable outside a request context')
    return binding.batch(statements.map(({ sql, params = [] }) => binding.prepare(sql).bind(...params)))
  }
  _isWorkersRuntime = true
  _withD1 = async <T>(binding: any, fn: () => Promise<T>): Promise<T> => d1Store.run(binding, fn)
  _query = {
    user: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.user).where(params.where).limit(1)
        return result[0]
      },
    },
    order: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.order).where(params.where).limit(1)
        return result[0]
      },
    },
    commission: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.commission).where(params.where).limit(1)
        return result[0]
      },
    },
  }

// ──────────────────────────── PostgreSQL (default) ──────────────────
} else {

  _isWorkersRuntime = typeof (globalThis as any).WebSocketPair !== 'undefined'

  // Hyperdrive binding must be injected from the app layer via setHyperdriveBinding(),
  // because CF Workers bindings are only accessible through `import { env } from 'cloudflare:workers'`
  // — they are NOT available on globalThis in ES Module Workers.
  let hyperdriveBinding: any = null
  _setHyperdriveBinding = (binding: any) => { hyperdriveBinding = binding }

  _getConnectionString = function getConnectionString(): string {
    if (process.env.CF_FORCE_DIRECT_DB === '1' && process.env.DATABASE_URL) {
      return process.env.DATABASE_URL
    }
    if (hyperdriveBinding?.connectionString) {
      return hyperdriveBinding.connectionString as string
    }
    return process.env.DATABASE_URL!
  }

  function getConnectionTarget(cs: string): string {
    try {
      const url = new URL(cs)
      return `${url.protocol}//${url.hostname}:${url.port || '5432'}${url.pathname}`
    } catch { return 'invalid-connection-string' }
  }

  const requestClientStore = new AsyncLocalStorage<Client>()

  const CF_QUERY_TIMEOUT = 12000
  const CF_CONNECT_TIMEOUT = 15000

  function createEphemeralClient(): Client {
    return new Client({
      connectionString: _getConnectionString(),
      query_timeout: CF_QUERY_TIMEOUT,
      connectionTimeoutMillis: CF_CONNECT_TIMEOUT,
    })
  }

  const poolInstance = new Pool({
    connectionString: _getConnectionString(),
    connectionTimeoutMillis: _isWorkersRuntime ? CF_CONNECT_TIMEOUT : 3000,
    query_timeout: _isWorkersRuntime ? CF_QUERY_TIMEOUT : 5000,
    idleTimeoutMillis: _isWorkersRuntime ? 1500 : 10000,
    max: _isWorkersRuntime ? 12 : 5,
    maxUses: _isWorkersRuntime ? 1 : undefined,
    maxLifetimeSeconds: _isWorkersRuntime ? 12 : undefined,
  })

  poolInstance.on('error', (error) => {
    console.error('[db] pool error:', error)
  })

  _pool = _isWorkersRuntime
    ? (new Proxy(poolInstance, {
        get(target, prop) {
          if (prop === 'query') {
            return async (...args: unknown[]) => {
              const reqClient = requestClientStore.getStore()
              if (reqClient) return (reqClient.query as Function)(...args)
              const c = createEphemeralClient()
              try {
                await c.connect()
                return await (c.query as Function)(...args)
              } finally {
                c.end().catch(() => {})
              }
            }
          }
          if (prop === 'connect') {
            return async () => {
              const reqClient = requestClientStore.getStore()
              if (reqClient) {
                return new Proxy(reqClient, {
                  get(t, p) {
                    if (p === 'release') return () => {}
                    return Reflect.get(t, p, t)
                  },
                  set(t, p, v) {
                    return Reflect.set(t, p, v, t)
                  },
                })
              }
              const c = createEphemeralClient()
              await c.connect()
              ;(c as any).release = (err?: unknown) => { c.end().catch(() => {}) }
              return c
            }
          }
          return Reflect.get(target, prop, target)
        },
      }) as unknown as Pool)
    : poolInstance

  console.log('[db] using connection target:', getConnectionTarget(_getConnectionString()))
  console.log(
    '[db] connection source:',
    process.env.CF_FORCE_DIRECT_DB === '1' && process.env.DATABASE_URL
      ? 'DATABASE_URL(forced)'
      : (hyperdriveBinding?.connectionString ? 'HYPERDRIVE' : 'DATABASE_URL(initial)'),
  )
  console.log('[db] query strategy:', _isWorkersRuntime ? 'request-scoped-client' : 'shared-pool')

  _db = pgDrizzle(_pool, { schema: _schema })

  _withRequestClient = async function withRequestClient<T>(fn: () => Promise<T>): Promise<T> {
    if (!_isWorkersRuntime) return fn()
    if (requestClientStore.getStore()) return fn()
    const client = createEphemeralClient()
    try {
      await client.connect()
      return await requestClientStore.run(client, fn)
    } finally {
      client.end().catch(() => {})
    }
  }

  _withFreshRequestClient = async function withFreshRequestClient<T>(fn: () => Promise<T>): Promise<T> {
    if (!_isWorkersRuntime) return fn()
    const client = createEphemeralClient()
    try {
      await client.connect()
      return await requestClientStore.run(client, fn)
    } finally {
      client.end().catch(() => {})
    }
  }

  _query = {
    user: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.user).where(params.where).limit(1)
        return result[0]
      },
    },
    order: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.order).where(params.where).limit(1)
        return result[0]
      },
    },
    commission: {
      findFirst: async (params: { where: any }) => {
        const result = await _db.select().from(_schema.commission).where(params.where).limit(1)
        return result[0]
      },
    },
  }
}

// ──────────────────────────── Public API ────────────────────────────

// Cast to NodePgDatabase for consumer type safety. PG is the primary dialect
// and the Drizzle ORM API surface (select/insert/update/delete/transaction)
// is identical across all adapters at the TypeScript level.
export const db = _db as NodePgDatabase<typeof _schema>
export const pool = _pool
export const isWorkersRuntime: boolean = _isWorkersRuntime
export const getConnectionString = _getConnectionString
export const withRequestClient = _withRequestClient
export const withFreshRequestClient = _withFreshRequestClient
export const query = _query

export const withD1 = _withD1 as
  | (<T>(binding: any, fn: () => Promise<T>) => Promise<T>)
  | undefined

/**
 * Inject the Hyperdrive binding from the CF Workers env.
 * Call this before any PG query in Workers runtime so that
 * getConnectionString() returns the Hyperdrive connection string.
 * No-op for non-PG dialects.
 */
export const setHyperdriveBinding = _setHyperdriveBinding

export const runD1Batch = _runD1Batch
export const runNativeD1Batch = _runNativeD1Batch

export const sqliteInstance = _sqliteInstance as any | undefined
