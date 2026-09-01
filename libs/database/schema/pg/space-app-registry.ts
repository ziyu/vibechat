import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const spaceAppManagedPackageRelease = pgTable(
  "space_app_managed_package_release",
  {
    releaseId: text("release_id").primaryKey(),
    packageName: text("package_name").notNull(),
    packageVersion: text("package_version").notNull(),
    integrity: text("integrity").notNull(),
    packageFormat: text("package_format").notNull(),
    projectFormatsJson: jsonb("project_formats_json").$type<string[]>().notNull(),
    objectKey: text("object_key").notNull(),
    objectHash: text("object_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("space_app_managed_package_name_version_idx").on(
      table.packageName,
      table.packageVersion,
    ),
  ],
);

export type SpaceAppManagedPackageReleaseRow =
  InferSelectModel<typeof spaceAppManagedPackageRelease>;
export type NewSpaceAppManagedPackageReleaseRow =
  InferInsertModel<typeof spaceAppManagedPackageRelease>;
