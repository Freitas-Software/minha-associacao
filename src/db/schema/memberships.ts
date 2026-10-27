import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { roles } from './roles'
import { users } from './users'

export const membershipStatus = pgEnum('membership_status', [
  'active',
  'inactive',
])

export const memberships = pgTable(
  'memberships',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id').notNull(),
    status: membershipStatus().notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    deactivatedByUserId: uuid('deactivated_by_user_id').references(
      () => users.id,
    ),
    deactivationReason: varchar('deactivation_reason', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    unique('memberships_organization_id_user_id_unique').on(
      table.organizationId,
      table.userId,
    ),
    foreignKey({
      columns: [table.roleId, table.organizationId],
      foreignColumns: [roles.id, roles.organizationId],
      name: 'memberships_role_organization_fk',
    }),
    index('memberships_organization_id_idx').on(table.organizationId),
    index('memberships_user_id_idx').on(table.userId),
    index('memberships_role_id_idx').on(table.roleId),
  ],
)
