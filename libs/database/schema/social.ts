import { getDialect } from '../shared/dialect'
import * as pgSchema from './pg/social'
import * as sqliteSchema from './sqlite/social'

export type {
  Block,
  Contact,
  FriendRequest,
  NewBlock,
  NewContact,
  NewFriendRequest,
} from './pg/social'

const implementation = (
  (getDialect() === 'sqlite' || getDialect() === 'd1') ? sqliteSchema : pgSchema
) as typeof pgSchema

export const friendRequest = implementation.friendRequest
export const contact = implementation.contact
export const block = implementation.block
