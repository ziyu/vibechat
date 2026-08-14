CREATE TABLE "room_index" (
	"matrix_room_id" text PRIMARY KEY NOT NULL,
	"client_request_id" text NOT NULL,
	"space_id" text NOT NULL,
	"space_version_id" text NOT NULL,
	"creator_user_id" text NOT NULL,
	"instance_config_json" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "room_index" ADD CONSTRAINT "room_index_creator_user_id_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_index_creator_request_idx" ON "room_index" USING btree ("creator_user_id","client_request_id");--> statement-breakpoint
CREATE INDEX "room_index_creator_idx" ON "room_index" USING btree ("creator_user_id");