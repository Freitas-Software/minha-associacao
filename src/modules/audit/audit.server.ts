import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { auditEvents, users } from '@/db/schema'
import {
  getOrganizationAccess,
  hasPermission,
} from '@/modules/authorization/authorize.server'
import { PERMISSIONS } from '@/modules/authorization/permissions'

type AuditDatabase = Pick<typeof db, 'insert'>

export type AuditEventInput = {
  actorUserId: string | null
  organizationId: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export type AuditEventListItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorName: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export type ListAuditEventsResult =
  | { status: 'ok'; events: AuditEventListItem[] }
  | { status: 'forbidden' }

export async function recordAuditEvent(
  database: AuditDatabase,
  input: AuditEventInput,
): Promise<void> {
  await database.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  })
}

export type ListAuditEventsOptions = {
  limit?: number
  offset?: number
  action?: string
}

export async function listAuditEvents(
  actorUserId: string,
  organizationId: string,
  options: ListAuditEventsOptions = {},
  database: typeof db = db,
): Promise<ListAuditEventsResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.auditRead)) {
    return { status: 'forbidden' }
  }

  const safeLimit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const offset = Math.max(options.offset ?? 0, 0)

  const events = await database
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      actorName: users.name,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(
      and(
        eq(auditEvents.organizationId, organizationId),
        options.action ? eq(auditEvents.action, options.action) : undefined,
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(safeLimit)
    .offset(offset)

  return { status: 'ok', events }
}
