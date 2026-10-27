import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { accounts } from './accounts'

export const passwordResetRequests = pgTable(
  'password_reset_requests',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    email: varchar({ length: 55 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index('password_reset_requests_account_id_idx').on(table.accountId),
  ],
)
