CREATE TABLE "integration_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "matrix_identities" (
	"user_id" text PRIMARY KEY NOT NULL,
	"matrix_user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provisioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matrix_session_bindings" (
	"auth_session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"matrix_user_id" text NOT NULL,
	"matrix_device_id" text NOT NULL,
	"matrix_access_token_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matrix_identities" ADD CONSTRAINT "matrix_identities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrix_session_bindings" ADD CONSTRAINT "matrix_session_bindings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_outbox_event_aggregate_idx" ON "integration_outbox" USING btree ("event_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "integration_outbox_pending_idx" ON "integration_outbox" USING btree ("processed_at","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "matrix_identities_matrix_user_id_idx" ON "matrix_identities" USING btree ("matrix_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matrix_session_bindings_device_idx" ON "matrix_session_bindings" USING btree ("matrix_user_id","matrix_device_id");--> statement-breakpoint
CREATE INDEX "matrix_session_bindings_user_idx" ON "matrix_session_bindings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_username_idx" ON "user_profiles" USING btree ("username");