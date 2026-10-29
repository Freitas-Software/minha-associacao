import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { users } from './users'

export const provisioningGrants = pgTable(
  'provisioning_grants',
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
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  table => [
    index('provisioning_grants_organization_id_idx').on(table.organizationId),
    index('provisioning_grants_user_id_idx').on(table.userId),
  ],
)
