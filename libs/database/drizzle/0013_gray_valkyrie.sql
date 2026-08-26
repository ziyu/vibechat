CREATE TABLE "space_runtime_instance_state" (
	"space_instance_id" text PRIMARY KEY NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_runtime_lease" (
	"space_instance_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"fencing_token" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_runtime_outbox" (
	"event_id" text PRIMARY KEY NOT NULL,
	"space_instance_id" text NOT NULL,
	"event_type" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"owner_id" text,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_runtime_project" (
	"project_id" text PRIMARY KEY NOT NULL,
	"space_instance_id" text NOT NULL,
	"source_object_key" text,
	"source_hash" text,
	"artifact_object_key" text,
	"artifact_hash" text,
	"ready_revision_id" text,
	"published_revision_id" text,
	"release_id" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_runtime_turn" (
	"turn_id" text PRIMARY KEY NOT NULL,
	"space_instance_id" text NOT NULL,
	"external_request_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload_json" jsonb NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"owner_id" text,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "space_runtime_lease_expiry_idx" ON "space_runtime_lease" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "space_runtime_outbox_dedupe_idx" ON "space_runtime_outbox" USING btree ("event_type","dedupe_key");--> statement-breakpoint
CREATE INDEX "space_runtime_outbox_pending_idx" ON "space_runtime_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "space_runtime_project_instance_idx" ON "space_runtime_project" USING btree ("space_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_runtime_turn_request_idx" ON "space_runtime_turn" USING btree ("space_instance_id","external_request_id");--> statement-breakpoint
CREATE INDEX "space_runtime_turn_queue_idx" ON "space_runtime_turn" USING btree ("space_instance_id","status","created_at");