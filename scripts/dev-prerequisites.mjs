import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export function verifyBetterSqlite3(Database) {
  const sqlite = new Database(':memory:')
  try {
    const result = sqlite.prepare('select 1 as value').get()
    if (result?.value !== 1) {
      throw new Error('better-sqlite3 returned an invalid probe result')
    }
  } finally {
    sqlite.close()
  }
}

export async function readExpectedSqliteSchema(snapshotDirectory) {
  const snapshotFiles = (await readdir(snapshotDirectory))
    .filter((filename) => /^\d+_snapshot\.json$/.test(filename))
    .sort()
  const latestSnapshot = snapshotFiles.at(-1)
  if (!latestSnapshot) {
    throw new Error(`No SQLite schema snapshot found in ${snapshotDirectory}`)
  }

  const value = JSON.parse(
    await readFile(join(snapshotDirectory, latestSnapshot), 'utf8'),
  )
  if (!value.tables || typeof value.tables !== 'object') {
    throw new Error(`SQLite schema snapshot ${latestSnapshot} has no tables`)
  }

  const tables = new Map()
  for (const [tableName, table] of Object.entries(value.tables)) {
    const columns = table?.columns
    if (!columns || typeof columns !== 'object') {
      throw new Error(
        `SQLite schema snapshot ${latestSnapshot} has no columns for ${tableName}`,
      )
    }
    tables.set(tableName, new Set(Object.keys(columns)))
  }
  return { latestSnapshot, tables }
}

export function inspectSqliteSchema(Database, databasePath, expectedTables) {
  const sqlite = new Database(databasePath)
  try {
    const tableNames = new Set(
      sqlite
        .prepare(
          "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
        )
        .all()
        .map((row) => row.name),
    )
    const columns = new Map()
    for (const tableName of expectedTables.keys()) {
      if (!tableNames.has(tableName)) continue
      columns.set(
        tableName,
        new Set(
          sqlite
            .prepare('select name from pragma_table_info(?)')
            .all(tableName)
            .map((row) => row.name),
        ),
      )
    }
    return { tableNames, columns }
  } finally {
    sqlite.close()
  }
}

export function missingSqliteSchema(expectedTables, actualSchema) {
  const missing = []
  for (const [tableName, expectedColumns] of expectedTables) {
    if (!actualSchema.tableNames.has(tableName)) {
      missing.push(tableName)
      continue
    }
    const actualColumns = actualSchema.columns.get(tableName) || new Set()
    for (const columnName of expectedColumns) {
      if (!actualColumns.has(columnName)) {
        missing.push(`${tableName}.${columnName}`)
      }
    }
  }
  return missing
}
