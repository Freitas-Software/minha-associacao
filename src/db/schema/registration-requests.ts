import {
  date,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { users } from './users'

export const registrationRequests = pgTable(
  'registration_requests',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id').references(() => users.id),
    name: varchar({ length: 255 }).notNull(),
    documentNumber: varchar('document_number', {
      length: 11,
    }).notNull(),
    email: varchar({ length: 55 }).notNull(),
    phone: varchar({ length: 11 }).notNull(),
    birthDate: date('birth_date').notNull(),
    tokenHash: varchar('token_hash', {
      length: 64,
    })
      .notNull()
      .unique(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp('consumed_at', {
      withTimezone: true,
    }),
    invalidatedAt: timestamp('invalidated_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  table => [
    index('registration_requests_document_number_idx').on(table.documentNumber),
  ],
)
