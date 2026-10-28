import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { users } from './users'

export const emailChangeRequests = pgTable(
  'email_change_requests',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    newEmail: varchar('new_email', { length: 55 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [index('email_change_requests_user_id_idx').on(table.userId)],
)
