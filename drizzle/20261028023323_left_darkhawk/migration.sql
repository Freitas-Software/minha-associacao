CREATE TYPE "invite_type" AS ENUM('individual', 'shared');--> statement-breakpoint
CREATE TABLE "invite_redemptions" (
	"id" uuid PRIMARY KEY,
	"invite_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"role_id" uuid,
	"type" "invite_type" NOT NULL,
	"document_number" varchar(11),
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_type_document_check" CHECK (("type" = 'individual' and "document_number" is not null) or ("type" = 'shared' and "document_number" is null)),
	CONSTRAINT "invites_uses_check" CHECK ("uses_count" >= 0 and ("max_uses" is null or ("max_uses" > 0 and "uses_count" <= "max_uses")))
);
--> statement-breakpoint
CREATE INDEX "invite_redemptions_invite_id_idx" ON "invite_redemptions" ("invite_id");--> statement-breakpoint
CREATE INDEX "invite_redemptions_user_id_idx" ON "invite_redemptions" ("user_id");--> statement-breakpoint
CREATE INDEX "invites_organization_id_idx" ON "invites" ("organization_id");--> statement-breakpoint
CREATE INDEX "invites_document_number_idx" ON "invites" ("document_number");--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD CONSTRAINT "invite_redemptions_invite_id_invites_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id");--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD CONSTRAINT "invite_redemptions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD CONSTRAINT "invite_redemptions_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_membership_id_memberships_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_role_organization_fk" FOREIGN KEY ("role_id","organization_id") REFERENCES "roles"("id","organization_id");