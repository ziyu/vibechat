CREATE TABLE `integration_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_outbox_event_aggregate_idx` ON `integration_outbox` (`event_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `integration_outbox_pending_idx` ON `integration_outbox` (`processed_at`,`available_at`);--> statement-breakpoint
CREATE TABLE `matrix_identities` (
	`user_id` text PRIMARY KEY NOT NULL,
	`matrix_user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`provisioned_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matrix_identities_matrix_user_id_idx` ON `matrix_identities` (`matrix_user_id`);--> statement-breakpoint
CREATE TABLE `matrix_session_bindings` (
	`auth_session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`matrix_user_id` text NOT NULL,
	`matrix_device_id` text NOT NULL,
	`matrix_access_token_ciphertext` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matrix_session_bindings_device_idx` ON `matrix_session_bindings` (`matrix_user_id`,`matrix_device_id`);--> statement-breakpoint
CREATE INDEX `matrix_session_bindings_user_idx` ON `matrix_session_bindings` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_username_idx` ON `user_profiles` (`username`);