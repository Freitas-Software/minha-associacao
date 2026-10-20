CREATE TABLE "registration_requests" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"document_number" varchar(11) NOT NULL,
	"email" varchar(55) NOT NULL,
	"phone" varchar(11) NOT NULL,
	"birth_date" date NOT NULL,
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "registration_requests_document_number_idx" ON "registration_requests" ("document_number");--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");