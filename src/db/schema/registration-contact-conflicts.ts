import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { users } from './users'

export const registrationContactConflicts = pgTable(
  'registration_contact_conflicts',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: varchar({ length: 55 }).notNull(),
    phone: varchar({ length: 11 }).notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolved_at', {
      withTimezone: true,
    }),
  },
  table => [
    index('registration_contact_conflicts_user_id_idx').on(table.userId),
  ],
)
