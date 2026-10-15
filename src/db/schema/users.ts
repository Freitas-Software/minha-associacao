import { date, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { accounts } from './accounts'

export const users = pgTable('users', {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  accountId: uuid().references(() => accounts.id),
  name: varchar({ length: 255 }).notNull(),
  documentNumber: varchar('document_number', { length: 11 }).notNull().unique(),
  email: varchar({ length: 55 }).notNull().unique(),
  phone: varchar({ length: 11 }).notNull().unique(),
  birthDate: date('birth_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
