ALTER TABLE `room_index` ADD `space_instance_id` text;--> statement-breakpoint
ALTER TABLE `room_index` ADD `project_id` text;--> statement-breakpoint
ALTER TABLE `room_index` ADD `default_agent_id` text DEFAULT 'pi' NOT NULL;--> statement-breakpoint
ALTER TABLE `room_index` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `room_index` SET
  `space_instance_id` = 'legacy-' || lower(substr(hex(`matrix_room_id`), 1, 40)),
  `project_id` = 'project-' || lower(substr(hex(`matrix_room_id`), 1, 40)),
  `updated_at` = `created_at`
WHERE `space_instance_id` IS NULL OR `project_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `room_index_space_instance_idx` ON `room_index` (`space_instance_id`);
