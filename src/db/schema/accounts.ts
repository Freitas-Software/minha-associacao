import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

export const accounts = pgTable('accounts', {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  login: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
})
