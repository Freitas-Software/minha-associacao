CREATE TABLE "password_reset_requests" (
	"id" uuid PRIMARY KEY,
	"account_id" uuid NOT NULL,
	"email" varchar(55) NOT NULL,
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "password_reset_requests_account_id_idx" ON "password_reset_requests" ("account_id");--> statement-breakpoint
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");