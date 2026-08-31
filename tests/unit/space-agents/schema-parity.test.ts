import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as pgAgents from '../../../libs/database/schema/pg/space-agent'
import { spaceRuntimeTurn as pgTurn } from '../../../libs/database/schema/pg/space-runtime-control'
import * as sqliteAgents from '../../../libs/database/schema/sqlite/space-agent'
import { spaceRuntimeTurn as sqliteTurn } from '../../../libs/database/schema/sqlite/space-runtime-control'

describe('Space Agent schema parity', () => {
  it.each([
    ['definition', pgAgents.spaceAgentDefinition, sqliteAgents.spaceAgentDefinition],
    ['binding', pgAgents.spaceAgentBinding, sqliteAgents.spaceAgentBinding],
    ['session', pgAgents.spaceAgentSession, sqliteAgents.spaceAgentSession],
    ['audit', pgAgents.spaceAgentAuditEvent, sqliteAgents.spaceAgentAuditEvent],
    ['runtime turn', pgTurn, sqliteTurn],
  ])('keeps %s columns aligned across PostgreSQL and SQLite/D1', (_, pgTable, sqliteTable) => {
    expect(Object.keys(getTableColumns(sqliteTable))).toEqual(Object.keys(getTableColumns(pgTable)))
  })
})
