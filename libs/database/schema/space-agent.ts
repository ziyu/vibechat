import { getDialect } from '../shared/dialect'
import * as pgSchema from './pg/space-agent'
import * as sqliteSchema from './sqlite/space-agent'

export type {
  NewSpaceAgentAuditEventRow,
  NewSpaceAgentBindingRow,
  NewSpaceAgentDefinitionRow,
  NewSpaceAgentSessionRow,
  SpaceAgentAuditEventRow,
  SpaceAgentBindingRow,
  SpaceAgentDefinitionRow,
  SpaceAgentSessionRow,
} from './pg/space-agent'

const implementation = (
  (getDialect() === 'sqlite' || getDialect() === 'd1') ? sqliteSchema : pgSchema
) as typeof pgSchema

export const spaceAgentDefinition = implementation.spaceAgentDefinition
export const spaceAgentBinding = implementation.spaceAgentBinding
export const spaceAgentSession = implementation.spaceAgentSession
export const spaceAgentAuditEvent = implementation.spaceAgentAuditEvent
