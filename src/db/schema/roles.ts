import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { organizations } from './organizations'
import { permissions } from './permissions'

export const roles = pgTable(
  'roles',
  {
    id: uuid()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: varchar({ length: 100 }).notNull(),
    isDirector: boolean('is_director').notNull().default(false),
    hasFullAccess: boolean('has_full_access').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    unique('roles_organization_id_name_unique').on(
      table.organizationId,
      table.name,
    ),
    unique('roles_id_organization_id_unique').on(
      table.id,
      table.organizationId,
    ),
    uniqueIndex('roles_organization_id_default_unique')
      .on(table.organizationId)
      .where(sql`${table.isDefault} and ${table.isActive}`),
    check(
      'roles_default_not_privileged',
      sql`not (${table.isDefault} and (${table.isDirector} or ${table.hasFullAccess}))`,
    ),
  ],
)

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    permissionCode: varchar('permission_code', { length: 100 })
      .notNull()
      .references(() => permissions.code),
  },
  table => [
    primaryKey({
      columns: [table.roleId, table.permissionCode],
    }),
  ],
)
