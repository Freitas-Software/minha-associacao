CREATE TABLE "registration_contact_conflicts" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(55) NOT NULL,
	"phone" varchar(11) NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "registration_requests" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
CREATE INDEX "registration_contact_conflicts_user_id_idx" ON "registration_contact_conflicts" ("user_id");--> statement-breakpoint
ALTER TABLE "registration_contact_conflicts" ADD CONSTRAINT "registration_contact_conflicts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "registration_contact_conflicts" ADD CONSTRAINT "registration_contact_conflicts_xWZO9Ey5B6nl_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "registration_contact_conflicts" ADD CONSTRAINT "registration_contact_conflicts_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");