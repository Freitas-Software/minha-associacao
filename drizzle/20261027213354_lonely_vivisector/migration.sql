CREATE TYPE "membership_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "organization_status" AS ENUM('provisioning', 'active');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY,
	"actor_user_id" uuid,
	"organization_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'active'::"membership_status" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	"deactivated_by_user_id" uuid,
	"deactivation_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY,
	"cnpj" varchar(14) NOT NULL UNIQUE,
	"legal_name" varchar(255) NOT NULL,
	"acronym" varchar(32) NOT NULL,
	"status" "organization_status" DEFAULT 'provisioning'::"organization_status" NOT NULL,
	"cnpj_verified_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"code" varchar(100) PRIMARY KEY,
	"description" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" uuid PRIMARY KEY,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid,
	"permission_code" varchar(100),
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_director" boolean DEFAULT false NOT NULL,
	"has_full_access" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_organization_id_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "roles_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "roles_default_not_privileged" CHECK (not ("is_default" and ("is_director" or "has_full_access")))
);
--> statement-breakpoint
CREATE INDEX "audit_events_organization_id_idx" ON "audit_events" ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" ("created_at");--> statement-breakpoint
CREATE INDEX "memberships_organization_id_idx" ON "memberships" ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_role_id_idx" ON "memberships" ("role_id");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_organization_id_default_unique" ON "roles" ("organization_id") WHERE "is_default" and "is_active";--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_deactivated_by_user_id_users_id_fkey" FOREIGN KEY ("deactivated_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_organization_fk" FOREIGN KEY ("role_id","organization_id") REFERENCES "roles"("id","organization_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_granted_by_user_id_users_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permissions"("code");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
INSERT INTO "permissions" ("code", "description", "category") VALUES
	('organization.read', 'View organization data', 'organization'),
	('organization.update', 'Edit organization data', 'organization'),
	('organization.activate', 'Activate the organization', 'organization'),
	('roles.read', 'View roles and permissions', 'roles'),
	('roles.manage', 'Create, update and deactivate roles', 'roles'),
	('members.read', 'View memberships', 'members'),
	('members.manage', 'Deactivate and reactivate memberships', 'members'),
	('invites.manage', 'Create and revoke invitations', 'invites'),
	('audit.read', 'View audit events', 'audit')
ON CONFLICT ("code") DO NOTHING;