import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const spaceAppManagedPackageRelease = sqliteTable(
  "space_app_managed_package_release",
  {
    releaseId: text("release_id").primaryKey(),
    packageName: text("package_name").notNull(),
    packageVersion: text("package_version").notNull(),
    integrity: text("integrity").notNull(),
    packageFormat: text("package_format").notNull(),
    projectFormatsJson: text("project_formats_json", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    objectKey: text("object_key").notNull(),
    objectHash: text("object_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
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
