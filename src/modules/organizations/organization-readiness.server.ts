import 'server-only'
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { invites, memberships, organizationDocuments, roles } from '@/db/schema'

type ReadinessDatabase = Pick<typeof db, 'select'>

export type OrganizationReadiness = {
  defaultRole: boolean
  fullAccessRole: boolean
  directorOccupied: boolean
  fullAccessMember: boolean
  requiredDocuments: boolean
}

export async function evaluateOrganizationReadiness(
  organizationId: string,
  database: ReadinessDatabase = db,
): Promise<OrganizationReadiness> {
  const activeRoles = await database
    .select({
      id: roles.id,
      isDirector: roles.isDirector,
      hasFullAccess: roles.hasFullAccess,
      isDefault: roles.isDefault,
    })
    .from(roles)
    .where(
      and(eq(roles.organizationId, organizationId), eq(roles.isActive, true)),
    )

  const defaultRoles = activeRoles.filter(role => role.isDefault)
  const [defaultRole] = defaultRoles
  const hasDefaultRole =
    defaultRoles.length === 1 &&
    defaultRole !== undefined &&
    !defaultRole.isDirector &&
    !defaultRole.hasFullAccess
  const hasFullAccessRole = activeRoles.some(role => role.hasFullAccess)

  const activeMembers = await database
    .select({
      roleId: memberships.roleId,
      hasFullAccess: roles.hasFullAccess,
    })
    .from(memberships)
    .innerJoin(
      roles,
      and(
        eq(roles.id, memberships.roleId),
        eq(roles.organizationId, memberships.organizationId),
      ),
    )
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
        eq(roles.isActive, true),
      ),
    )

  const now = new Date()

  const validDirectorInvites = await database
    .select({ roleId: invites.roleId })
    .from(invites)
    .where(
      and(
        eq(invites.organizationId, organizationId),
        eq(invites.type, 'individual'),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, now),
        or(isNull(invites.maxUses), lt(invites.usesCount, invites.maxUses)),
      ),
    )

  const hasUnoccupiedDirectorRole = activeRoles.some(
    role =>
      role.isDirector &&
      !activeMembers.some(member => member.roleId === role.id) &&
      !validDirectorInvites.some(invite => invite.roleId === role.id),
  )

  const hasFullAccessMember = activeMembers.some(member => member.hasFullAccess)

  const documentRows = await database
    .select({ type: organizationDocuments.type })
    .from(organizationDocuments)
    .where(eq(organizationDocuments.organizationId, organizationId))

  const documentTypes = new Set(documentRows.map(document => document.type))

  return {
    defaultRole: hasDefaultRole,
    fullAccessRole: hasFullAccessRole,
    directorOccupied: !hasUnoccupiedDirectorRole,
    fullAccessMember: hasFullAccessMember,
    requiredDocuments:
      documentTypes.has('statute') && documentTypes.has('election_minutes'),
  }
}
