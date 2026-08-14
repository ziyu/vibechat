import { getDialect } from '../shared/dialect'
import * as pgSchema from './pg/room'
import * as sqliteSchema from './sqlite/room'

export type { NewRoomIndex, RoomIndex } from './pg/room'

const implementation = (
  (getDialect() === 'sqlite' || getDialect() === 'd1') ? sqliteSchema : pgSchema
) as typeof pgSchema

export const roomIndex = implementation.roomIndex
