import { getDialect } from "../shared/dialect";
import * as pgSchema from "./pg/space-app-registry";
import * as sqliteSchema from "./sqlite/space-app-registry";

export type {
  NewSpaceAppManagedPackageReleaseRow,
  SpaceAppManagedPackageReleaseRow,
} from "./pg/space-app-registry";

const implementation = (
  (getDialect() === "sqlite" || getDialect() === "d1") ? sqliteSchema : pgSchema
) as typeof pgSchema;

export const spaceAppManagedPackageRelease =
  implementation.spaceAppManagedPackageRelease;
