import { existsSync, rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const databasePath = `/tmp/vibechat-product-state-${process.pid}-${Date.now()}.sqlite`
let repository: import('@libs/product-state').DatabaseProductStateRepository
let database: typeof import('@libs/database')

beforeAll(async () => {
  process.env.DB_DIALECT = 'sqlite'
  process.env.SQLITE_DB_PATH = databasePath
  vi.resetModules()

  database = await import('@libs/database')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const { DatabaseProductStateRepository } = await import('@libs/product-state/database-repository')
  migrate(database.db as never, { migrationsFolder: 'libs/database/drizzle-sqlite' })
  await database.db.insert(database.user).values([
    { id: 'product-user-a', name: 'Product A', email: 'product-a@example.com', emailVerified: true },
    { id: 'product-user-b', name: 'Product B', email: 'product-b@example.com', emailVerified: true },
  ])
  repository = new DatabaseProductStateRepository()
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

describe('DatabaseProductStateRepository on SQLite', () => {
  it('persists user and room preferences with account isolation', async () => {
    const now = new Date('2026-08-12T08:00:00.000Z')
    await repository.upsertPreferences('product-user-a', {
      notificationsEnabled: false,
      theme: 'dark',
      locale: 'zh-CN',
    }, now)
    await repository.upsertRoomPreference('product-user-a', {
      matrixRoomId: '!shared-room:localhost',
      pinned: true,
      muted: true,
    }, now)

    await expect(repository.getSnapshot('product-user-a')).resolves.toEqual({
      preferences: { notificationsEnabled: false, theme: 'dark', locale: 'zh-CN' },
      roomPreferences: [{ matrixRoomId: '!shared-room:localhost', pinned: true, muted: true }],
      favoriteSpaceIds: [],
    })
    await expect(repository.getSnapshot('product-user-b')).resolves.toEqual({
      preferences: { notificationsEnabled: true, theme: 'system', locale: 'en' },
      roomPreferences: [],
      favoriteSpaceIds: [],
    })
  })

  it('keeps favorites idempotent and counts them across users', async () => {
    const now = new Date('2026-08-12T08:00:00.000Z')
    await repository.setSpaceFavorite('product-user-a', 'space-campfire', true, now)
    await repository.setSpaceFavorite('product-user-a', 'space-campfire', true, now)
    await repository.setSpaceFavorite('product-user-b', 'space-campfire', true, now)
    await expect(repository.getSpaceFavoriteCounts()).resolves.toEqual({ 'space-campfire': 2 })

    await repository.setSpaceFavorite('product-user-a', 'space-campfire', false, now)
    await expect(repository.getSnapshot('product-user-a')).resolves.toMatchObject({ favoriteSpaceIds: [] })
    await expect(repository.getSpaceFavoriteCounts()).resolves.toEqual({ 'space-campfire': 1 })
  })
})
