import { getDialect } from "../shared/dialect";
import * as pgSchema from "./pg/space-runtime-control";
import * as sqliteSchema from "./sqlite/space-runtime-control";

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
} from "./pg/space-runtime-control";

const implementation = (
  (getDialect() === "sqlite" || getDialect() === "d1") ? sqliteSchema : pgSchema
) as typeof pgSchema;

export const spaceRuntimeInstanceState = implementation.spaceRuntimeInstanceState;
export const spaceRuntimeProject = implementation.spaceRuntimeProject;
export const spaceRuntimeTurn = implementation.spaceRuntimeTurn;
export const spaceRuntimeLease = implementation.spaceRuntimeLease;
export const spaceRuntimeOutbox = implementation.spaceRuntimeOutbox;
