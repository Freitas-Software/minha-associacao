CREATE TYPE "organization_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "organization_requests" (
	"id" uuid PRIMARY KEY,
	"requester_user_id" uuid NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"acronym" varchar(32) NOT NULL,
	"status" "organization_request_status" DEFAULT 'pending'::"organization_request_status" NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"document_size" integer NOT NULL,
	"document_data" bytea NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" varchar(500),
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_requests_document_size_check" CHECK ("document_size" > 0 and "document_size" <= 3145728)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_requests_pending_cnpj_unique" ON "organization_requests" ("cnpj") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_requests_requester_user_id_idx" ON "organization_requests" ("requester_user_id");--> statement-breakpoint
CREATE INDEX "organization_requests_status_idx" ON "organization_requests" ("status");--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_requester_user_id_users_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");