import { pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

export const permissions = pgTable('permissions', {
  code: varchar({ length: 100 }).primaryKey(),
  description: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
