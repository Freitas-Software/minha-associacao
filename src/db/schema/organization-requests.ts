import { sql } from 'drizzle-orm'
import {
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { users } from './users'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const organizationRequestStatus = pgEnum('organization_request_status', [
  'pending',
  'approved',
  'rejected',
])

export const organizationRequests = pgTable(
  'organization_requests',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    requesterUserId: uuid('requester_user_id')
      .notNull()
      .references(() => users.id),
    cnpj: varchar({ length: 14 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }).notNull(),
    acronym: varchar({ length: 32 }).notNull(),
    status: organizationRequestStatus().notNull().default('pending'),
    documentName: varchar('document_name', { length: 255 }).notNull(),
    documentType: varchar('document_type', { length: 100 }).notNull(),
    documentSize: integer('document_size').notNull(),
    documentData: bytea('document_data').notNull(),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: varchar('rejection_reason', { length: 500 }),
    organizationId: uuid('organization_id').references(() => organizations.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex('organization_requests_pending_cnpj_unique')
      .on(table.cnpj)
      .where(sql`${table.status} = 'pending'`),
    index('organization_requests_requester_user_id_idx').on(
      table.requesterUserId,
    ),
    index('organization_requests_status_idx').on(table.status),
    check(
      'organization_requests_document_size_check',
      sql`${table.documentSize} > 0 and ${table.documentSize} <= 3145728`,
    ),
  ],
)
