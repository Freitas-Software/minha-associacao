import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { users } from './users'

export const organizationStatus = pgEnum('organization_status', [
  'provisioning',
  'active',
  'closed',
])

export const organizations = pgTable(
  'organizations',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    cnpj: varchar({ length: 14 }).notNull().unique(),
    legalName: varchar('legal_name', { length: 255 }).notNull(),
    acronym: varchar({ length: 32 }).notNull(),
    status: organizationStatus().notNull().default('provisioning'),
    cnpjVerifiedAt: timestamp('cnpj_verified_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [index('organizations_status_idx').on(table.status)],
)
