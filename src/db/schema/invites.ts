import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { memberships } from './memberships'
import { organizations } from './organizations'
import { roles } from './roles'
import { users } from './users'

export const inviteType = pgEnum('invite_type', ['individual', 'shared'])

export const invites = pgTable(
  'invites',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    roleId: uuid('role_id'),
    type: inviteType().notNull(),
    documentNumber: varchar('document_number', { length: 11 }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    maxUses: integer('max_uses'),
    usesCount: integer('uses_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdByMembershipId: uuid('created_by_membership_id').references(
      () => memberships.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    foreignKey({
      columns: [table.roleId, table.organizationId],
      foreignColumns: [roles.id, roles.organizationId],
      name: 'invites_role_organization_fk',
    }),
    index('invites_organization_id_idx').on(table.organizationId),
    index('invites_document_number_idx').on(table.documentNumber),
    check(
      'invites_type_document_check',
      sql`(${table.type} = 'individual' and ${table.documentNumber} is not null) or (${table.type} = 'shared' and ${table.documentNumber} is null)`,
    ),
    check(
      'invites_uses_check',
      sql`${table.usesCount} >= 0 and (${table.maxUses} is null or (${table.maxUses} > 0 and ${table.usesCount} <= ${table.maxUses}))`,
    ),
  ],
)

export const inviteRedemptions = pgTable(
  'invite_redemptions',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    inviteId: uuid('invite_id')
      .notNull()
      .references(() => invites.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index('invite_redemptions_invite_id_idx').on(table.inviteId),
    index('invite_redemptions_user_id_idx').on(table.userId),
  ],
)
