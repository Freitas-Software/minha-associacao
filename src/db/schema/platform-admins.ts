import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const platformAdmins = pgTable('platform_admins', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  grantedByUserId: uuid('granted_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})
