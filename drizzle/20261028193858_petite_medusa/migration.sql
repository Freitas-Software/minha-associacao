CREATE TABLE "email_change_requests" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"new_email" varchar(55) NOT NULL,
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_change_requests_user_id_idx" ON "email_change_requests" ("user_id");--> statement-breakpoint
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");