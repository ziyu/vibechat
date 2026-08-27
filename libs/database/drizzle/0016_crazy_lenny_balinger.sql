WITH "ranked_default_bindings" AS (
	SELECT "binding_id", row_number() OVER (
		PARTITION BY "space_instance_id"
		ORDER BY "updated_at" DESC, "binding_id" ASC
	) AS "position"
	FROM "space_agent_binding"
	WHERE "is_default" = true
)
UPDATE "space_agent_binding" AS "binding"
SET "is_default" = false
FROM "ranked_default_bindings" AS "ranked"
WHERE "binding"."binding_id" = "ranked"."binding_id"
	AND "ranked"."position" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "space_agent_binding_one_default_idx" ON "space_agent_binding" USING btree ("space_instance_id") WHERE "space_agent_binding"."is_default" = true;
