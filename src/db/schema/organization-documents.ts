import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { users } from './users'

export const organizationDocumentType = pgEnum('organization_document_type', [
  'statute',
  'election_minutes',
])

export const organizationDocuments = pgTable(
  'organization_documents',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    type: organizationDocumentType().notNull(),
    storageKey: text('storage_key').notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index('organization_documents_organization_id_idx').on(
      table.organizationId,
    ),
  ],
)
