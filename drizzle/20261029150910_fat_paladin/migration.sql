CREATE TYPE "organization_document_type" AS ENUM('statute', 'election_minutes');--> statement-breakpoint
CREATE TABLE "organization_documents" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"type" "organization_document_type" NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provisioning_grants" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "organization_documents_organization_id_idx" ON "organization_documents" ("organization_id");--> statement-breakpoint
CREATE INDEX "provisioning_grants_organization_id_idx" ON "provisioning_grants" ("organization_id");--> statement-breakpoint
CREATE INDEX "provisioning_grants_user_id_idx" ON "provisioning_grants" ("user_id");--> statement-breakpoint
ALTER TABLE "organization_documents" ADD CONSTRAINT "organization_documents_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "organization_documents" ADD CONSTRAINT "organization_documents_uploaded_by_user_id_users_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "provisioning_grants" ADD CONSTRAINT "provisioning_grants_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "provisioning_grants" ADD CONSTRAINT "provisioning_grants_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "provisioning_grants" ADD CONSTRAINT "provisioning_grants_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");