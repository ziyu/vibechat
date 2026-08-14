CREATE TABLE `room_index` (
	`matrix_room_id` text PRIMARY KEY NOT NULL,
	`client_request_id` text NOT NULL,
	`space_id` text NOT NULL,
	`space_version_id` text NOT NULL,
	`creator_user_id` text NOT NULL,
	`instance_config_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_index_creator_request_idx` ON `room_index` (`creator_user_id`,`client_request_id`);--> statement-breakpoint
CREATE INDEX `room_index_creator_idx` ON `room_index` (`creator_user_id`);