PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`phone_number` text,
	`phone_number_verified` integer DEFAULT false,
	`stripe_customer_id` text,
	`creem_customer_id` text,
	`dodo_customer_id` text,
	`credit_balance` text DEFAULT '0' NOT NULL,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` text,
	`referral_code` text,
	`referred_by_code` text,
	`commission_balance` text DEFAULT '0' NOT NULL,
	`kyc_verified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "role", "created_at", "updated_at", "phone_number", "phone_number_verified", "stripe_customer_id", "creem_customer_id", "dodo_customer_id", "credit_balance", "banned", "ban_reason", "ban_expires", "referral_code", "referred_by_code", "commission_balance", "kyc_verified") SELECT "id", "name", "email", "email_verified", "image", "role", "created_at", "updated_at", "phone_number", "phone_number_verified", "stripe_customer_id", "creem_customer_id", "dodo_customer_id", "credit_balance", "banned", "ban_reason", "ban_expires", "referral_code", "referred_by_code", "commission_balance", COALESCE("kyc_verified", false) FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_referral_code_unique` ON `user` (`referral_code`);
