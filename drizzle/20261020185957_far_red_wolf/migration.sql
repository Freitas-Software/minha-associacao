CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY,
	"account_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" ("account_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");