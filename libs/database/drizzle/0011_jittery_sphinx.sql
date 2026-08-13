UPDATE "user" SET "kyc_verified" = false WHERE "kyc_verified" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "kyc_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "kyc_verified" SET NOT NULL;
