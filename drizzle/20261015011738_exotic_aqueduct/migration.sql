ALTER TABLE "accounts" ADD COLUMN "login" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_login_key" UNIQUE("login");