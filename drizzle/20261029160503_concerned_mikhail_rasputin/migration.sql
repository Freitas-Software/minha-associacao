ALTER TYPE "organization_status" ADD VALUE 'closed';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description", "category") VALUES
	('organization.close', 'Close and reopen the organization', 'organization')
ON CONFLICT ("code") DO NOTHING;