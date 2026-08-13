CREATE TABLE "ai_generation_task" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_task_id" text,
	"consume_transaction_id" text NOT NULL,
	"credit_cost" numeric NOT NULL,
	"status" text NOT NULL,
	"result" jsonb,
	"error_message" text,
	"refunded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_generation_task" ADD CONSTRAINT "ai_generation_task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_generation_task_user_idx" ON "ai_generation_task" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_generation_task_provider_idx" ON "ai_generation_task" USING btree ("provider","provider_task_id");