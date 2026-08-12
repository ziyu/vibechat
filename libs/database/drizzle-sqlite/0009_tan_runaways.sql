CREATE TABLE `room_user_preferences` (
	`user_id` text NOT NULL,
	`matrix_room_id` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `matrix_room_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_user_preferences_user_idx` ON `room_user_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `space_favorites` (
	`user_id` text NOT NULL,
	`space_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `space_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `space_favorites_space_idx` ON `space_favorites` (`space_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`notifications_enabled` integer DEFAULT true NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
