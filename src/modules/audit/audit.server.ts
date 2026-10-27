import 'server-only'
import type { db } from '@/db'
import { auditEvents } from '@/db/schema'

type AuditDatabase = Pick<typeof db, 'insert'>

export type AuditEventInput = {
  actorUserId: string | null
  organizationId: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

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
