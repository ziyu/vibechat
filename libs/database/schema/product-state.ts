import { getDialect } from "../shared/dialect";
import * as pgSchema from "./pg/product-state";
import * as sqliteSchema from "./sqlite/product-state";

export type {
  NewRoomUserPreference,
  NewSpaceFavorite,
  NewUserPreference,
  RoomUserPreference,
  SpaceFavorite,
  UserPreference,
} from "./pg/product-state";

const implementation = (
  (getDialect() === "sqlite" || getDialect() === "d1") ? sqliteSchema : pgSchema
) as typeof pgSchema;

export const userPreference = implementation.userPreference;
export const roomUserPreference = implementation.roomUserPreference;
export const spaceFavorite = implementation.spaceFavorite;
