import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { accounts } from './accounts'

export const sessions = pgTable(
  'sessions',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp('idle_expires_at', {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  table => [index('sessions_account_id_idx').on(table.accountId)],
)
