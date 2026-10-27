import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { users } from './users'

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    action: varchar({ length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index('audit_events_organization_id_idx').on(table.organizationId),
    index('audit_events_created_at_idx').on(table.createdAt),
  ],
)
