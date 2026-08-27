CREATE TABLE "space_agent_audit_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"space_instance_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"definition_id" text,
	"session_id" text,
	"turn_id" text,
	"event_type" text NOT NULL,
	"policy_snapshot_hash" text,
	"result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_agent_binding" (
	"binding_id" text PRIMARY KEY NOT NULL,
	"space_instance_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"definition_version" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"permission_policy_id" text NOT NULL,
	"tool_policy_id" text NOT NULL,
	"budget_policy_json" jsonb NOT NULL,
	"policy_snapshot_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_agent_definition" (
	"definition_id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" text NOT NULL,
	"adapter_key" text NOT NULL,
	"adapter_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"capabilities_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_policy_id" text NOT NULL,
	"pricing_policy_id" text NOT NULL,
	"usage_schema_version" text NOT NULL,
	"max_budget_credits" integer NOT NULL,
	"max_concurrency" integer NOT NULL,
	"data_region_policy_json" jsonb NOT NULL,
	"display_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_agent_session" (
	"session_id" text PRIMARY KEY NOT NULL,
	"space_instance_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"definition_version" text NOT NULL,
	"adapter_key" text NOT NULL,
	"adapter_version" text NOT NULL,
	"generation" integer NOT NULL,
	"provider_session_ref" text,
	"summary_ref" text,
	"summary_hash" text,
	"region" text NOT NULL,
	"restore_status" text DEFAULT 'ready' NOT NULL,
	"last_turn_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "agent_definition_id" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "agent_definition_version" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "adapter_key" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "adapter_version" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "session_generation" integer;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "policy_snapshot_hash" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "reservation_transaction_id" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "payload_schema_version" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "result_schema_version" text;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "result_json" jsonb;--> statement-breakpoint
ALTER TABLE "space_runtime_turn" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "space_agent_audit_space_created_idx" ON "space_agent_audit_event" USING btree ("space_instance_id","created_at");--> statement-breakpoint
CREATE INDEX "space_agent_audit_turn_idx" ON "space_agent_audit_event" USING btree ("turn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_agent_binding_space_agent_idx" ON "space_agent_binding" USING btree ("space_instance_id","agent_id");--> statement-breakpoint
CREATE INDEX "space_agent_binding_default_idx" ON "space_agent_binding" USING btree ("space_instance_id","is_default","status");--> statement-breakpoint
CREATE UNIQUE INDEX "space_agent_definition_agent_version_idx" ON "space_agent_definition" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "space_agent_definition_status_idx" ON "space_agent_definition" USING btree ("agent_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "space_agent_session_generation_idx" ON "space_agent_session" USING btree ("space_instance_id","agent_id","generation");--> statement-breakpoint
CREATE INDEX "space_agent_session_lookup_idx" ON "space_agent_session" USING btree ("space_instance_id","agent_id","updated_at");--> statement-breakpoint
INSERT INTO "space_agent_definition" (
	"definition_id", "agent_id", "version", "adapter_key", "adapter_version",
	"provider", "model", "capabilities_json", "tool_policy_id", "pricing_policy_id",
	"usage_schema_version", "max_budget_credits", "max_concurrency", "data_region_policy_json",
	"display_name", "description", "status", "availability", "created_at", "updated_at"
) VALUES (
	'agent-definition-pi-v1', 'pi', '1.0.0', 'pi', '0.2.7',
	'pi', 'configured', '["conversation","project_patch"]'::jsonb,
	'space-agent-tools-default', 'space-agent-pricing-default',
	'vibechat.agent-usage/v1', 1000, 1, '{"mode":"any","regions":[]}'::jsonb,
	'Pi', 'Default VibeChat project Agent', 'active', 'available',
	'2026-08-27T00:00:00.000Z'::timestamptz, '2026-08-27T00:00:00.000Z'::timestamptz
) ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "space_agent_binding" (
	"binding_id", "space_instance_id", "agent_id", "definition_id", "definition_version",
	"is_default", "permission_policy_id", "tool_policy_id", "budget_policy_json",
	"policy_snapshot_hash", "status", "created_at", "updated_at"
)
SELECT
	'space-agent-binding:' || "space_instance_id" || ':pi',
	"space_instance_id", 'pi', 'agent-definition-pi-v1', '1.0.0', true,
	'space-agent-permissions-default', 'space-agent-tools-default',
	'{"maxCreditsPerTurn":1000,"maxInputTokens":128000,"maxOutputTokens":16000}'::jsonb,
	'sha256:12d800847af14ba6bbf311eaf86cd75b05b546bd0cfe2c299acedf733d8dd0e3',
	'active', now(), now()
FROM "room_index"
WHERE "space_instance_id" IS NOT NULL AND "default_agent_id" = 'pi'
ON CONFLICT DO NOTHING;
