import { getDialect } from "../shared/dialect";
import * as pgSchema from "./pg/identity";
import * as sqliteSchema from "./sqlite/identity";

export type {
  IntegrationOutboxEvent,
  MatrixIdentity,
  MatrixSessionBinding,
  NewIntegrationOutboxEvent,
  NewMatrixIdentity,
  NewMatrixSessionBinding,
  NewUserProfile,
  UserProfile,
} from "./pg/identity";

const _impl = ((getDialect() === "sqlite" || getDialect() === "d1") ? sqliteSchema : pgSchema) as typeof pgSchema;

export const userProfile = _impl.userProfile;
export const matrixIdentity = _impl.matrixIdentity;
export const matrixSessionBinding = _impl.matrixSessionBinding;
export const integrationOutbox = _impl.integrationOutbox;
