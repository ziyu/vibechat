import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  inspectSqliteSchema,
  missingSqliteSchema,
  readExpectedSqliteSchema,
  verifyBetterSqlite3,
} from '../../../scripts/dev-prerequisites.mjs'

describe('development prerequisites', () => {
  it('loads the latest SQLite snapshot and reports missing schema entries', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vibechat-sqlite-schema-'))
    await writeFile(
      join(directory, '0001_snapshot.json'),
      JSON.stringify({ tables: { old_table: { columns: { id: {} } } } }),
    )
    await writeFile(
      join(directory, '0002_snapshot.json'),
      JSON.stringify({
        tables: {
          user: { columns: { id: {}, email: {} } },
          space_runtime_turn: { columns: { turn_id: {} } },
        },
      }),
    )

    const expected = await readExpectedSqliteSchema(directory)
    const databasePath = join(directory, 'local.sqlite')
    const sqlite = new Database(databasePath)
    sqlite.exec('create table user (id text primary key)')
    sqlite.close()

    const actual = inspectSqliteSchema(Database, databasePath, expected.tables)
    expect(expected.latestSnapshot).toBe('0002_snapshot.json')
    expect(missingSqliteSchema(expected.tables, actual)).toEqual([
      'user.email',
      'space_runtime_turn',
    ])
  })

  it('verifies the active better-sqlite3 native binding', () => {
    expect(() => verifyBetterSqlite3(Database)).not.toThrow()
  })
})
