CREATE TABLE "space_app_managed_package_release" (
	"release_id" text PRIMARY KEY NOT NULL,
	"package_name" text NOT NULL,
	"package_version" text NOT NULL,
	"integrity" text NOT NULL,
	"package_format" text NOT NULL,
	"project_formats_json" jsonb NOT NULL,
	"object_key" text NOT NULL,
	"object_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "space_app_managed_package_name_version_idx" ON "space_app_managed_package_release" USING btree ("package_name","package_version");