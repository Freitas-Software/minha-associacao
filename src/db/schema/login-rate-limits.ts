import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

export const loginRateLimits = pgTable('login_rate_limits', {
  key: varchar({ length: 64 }).primaryKey(),
  count: integer().notNull(),
  windowStartedAt: timestamp('window_started_at', {
    withTimezone: true,
  }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
