CREATE TABLE `space_runtime_project_revision` (
	`space_instance_id` text NOT NULL,
	`project_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`parent_revision_id` text,
	`source_object_key` text NOT NULL,
	`source_hash` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`fencing_token` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`space_instance_id`, `revision_id`)
);
--> statement-breakpoint
CREATE INDEX `space_runtime_project_revision_history_idx` ON `space_runtime_project_revision` (`space_instance_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `space_runtime_project_revision` (
	`space_instance_id`,
	`project_id`,
	`revision_id`,
	`parent_revision_id`,
	`source_object_key`,
	`source_hash`,
	`metadata_json`,
	`fencing_token`,
	`created_at`
)
SELECT
	`space_instance_id`,
	`project_id`,
	`ready_revision_id`,
	NULL,
	`source_object_key`,
	`source_hash`,
	`metadata_json`,
	`fencing_token`,
	`updated_at`
FROM `space_runtime_project`
WHERE `ready_revision_id` IS NOT NULL
	AND `source_object_key` IS NOT NULL
	AND `source_hash` IS NOT NULL
ON CONFLICT (`space_instance_id`, `revision_id`) DO NOTHING;
