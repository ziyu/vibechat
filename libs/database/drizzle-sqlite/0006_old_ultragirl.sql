CREATE TABLE `blocks` (
	`blocker_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_user_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blocks_blocked_user_idx` ON `blocks` (`blocked_user_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`user_id` text NOT NULL,
	`contact_user_id` text NOT NULL,
	`remark` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `contact_user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contacts_contact_user_idx` ON `contacts` (`contact_user_id`);--> statement-breakpoint
CREATE TABLE `friend_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_requests_sender_recipient_idx` ON `friend_requests` (`sender_id`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `friend_requests_recipient_status_idx` ON `friend_requests` (`recipient_id`,`status`);