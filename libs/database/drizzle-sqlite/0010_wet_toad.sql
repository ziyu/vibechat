CREATE TABLE `ai_generation_task` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`provider_task_id` text,
	`consume_transaction_id` text NOT NULL,
	`credit_cost` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`error_message` text,
	`refunded` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_generation_task_user_idx` ON `ai_generation_task` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_generation_task_provider_idx` ON `ai_generation_task` (`provider`,`provider_task_id`);