ALTER TABLE "room_index" ADD COLUMN "space_instance_id" text;--> statement-breakpoint
ALTER TABLE "room_index" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "room_index" ADD COLUMN "default_agent_id" text DEFAULT 'pi' NOT NULL;--> statement-breakpoint
ALTER TABLE "room_index" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "room_index" SET
  "space_instance_id" = 'legacy-' || lower(substr(encode(convert_to("matrix_room_id", 'UTF8'), 'hex'), 1, 40)),
  "project_id" = 'project-' || lower(substr(encode(convert_to("matrix_room_id", 'UTF8'), 'hex'), 1, 40)),
  "updated_at" = "created_at"
WHERE "space_instance_id" IS NULL OR "project_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_index_space_instance_idx" ON "room_index" USING btree ("space_instance_id");
