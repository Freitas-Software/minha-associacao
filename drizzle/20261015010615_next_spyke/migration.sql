CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accountId" uuid;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_accountId_accounts_id_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id");