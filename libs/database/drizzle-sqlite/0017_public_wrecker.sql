PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_room_index` (
	`matrix_room_id` text PRIMARY KEY NOT NULL,
	`space_instance_id` text,
	`project_id` text,
	`default_agent_id` text DEFAULT 'pi' NOT NULL,
	`client_request_id` text NOT NULL,
	`space_id` text,
	`space_version_id` text,
	`creator_user_id` text NOT NULL,
	`participant_user_ids_json` text DEFAULT '[]' NOT NULL,
	`instance_config_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_room_index`("matrix_room_id", "space_instance_id", "project_id", "default_agent_id", "client_request_id", "space_id", "space_version_id", "creator_user_id", "participant_user_ids_json", "instance_config_json", "status", "created_at", "updated_at") SELECT "matrix_room_id", "space_instance_id", "project_id", "default_agent_id", "client_request_id", "space_id", "space_version_id", "creator_user_id", "participant_user_ids_json", "instance_config_json", "status", "created_at", "updated_at" FROM `room_index`;--> statement-breakpoint
DROP TABLE `room_index`;--> statement-breakpoint
ALTER TABLE `__new_room_index` RENAME TO `room_index`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `room_index_space_instance_idx` ON `room_index` (`space_instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `room_index_creator_request_idx` ON `room_index` (`creator_user_id`,`client_request_id`);--> statement-breakpoint
CREATE INDEX `room_index_creator_idx` ON `room_index` (`creator_user_id`);