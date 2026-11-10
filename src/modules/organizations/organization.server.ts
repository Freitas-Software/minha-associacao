import 'server-only'
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
} from 'drizzle-orm'
import { db } from '@/db'
import {
  auditEvents,
  invites,
  memberships,
  organizationDocuments,
  organizations,
  provisioningGrants,
  registrationRequests,
  rolePermissions,
  roles,
  users,
} from '@/db/schema'
import { getDatabaseErrorConstraint, isDatabaseError } from '@/lib/errors'
import { recordAuditEvent } from '@/modules/audit/audit.server'
import {
  canGrantRole,
  getOrganizationAccess,
  hasEveryPermission,
  hasPermission,
  isPlatformAdmin,
} from '@/modules/authorization/authorize.server'
import {
  PERMISSION_CODES,
  PERMISSIONS,
} from '@/modules/authorization/permissions'
import { cpfSchema } from '@/modules/identity/registration.schema'
import { isValidCnpj, normalizeCnpj } from './cnpj'
import { lookupCnpj } from './cnpj.server'
import type {
  CloseOrganizationData,
  CreateRoleData,
  DeactivateMembershipData,
  UpdateOrganizationData,
  UpdateRoleData,
} from './organization.schema'
import { ORGANIZATION_DOCUMENT_LABELS } from './organization-document-policy'
import type { OrganizationReadiness } from './organization-readiness.server'
import { evaluateOrganizationReadiness } from './organization-readiness.server'

export type CreateOrganizationResult =
  | { status: 'created'; organizationId: string }
  | { status: 'forbidden' }
  | { status: 'invalid-cnpj' }
  | { status: 'invalid-document' }
  | { status: 'grantee-not-found' }
  | { status: 'duplicate-cnpj' }
  | { status: 'lookup-failed'; message: string }

export async function createOrganization(
  input: {
    actorUserId: string
    cnpj: string
    acronym: string
    granteeDocumentNumber: string
  },
  database: typeof db = db,
): Promise<CreateOrganizationResult> {
  if (!(await isPlatformAdmin(input.actorUserId, database))) {
    return { status: 'forbidden' }
  }

  const granteeDocument = cpfSchema.safeParse(input.granteeDocumentNumber)

  if (!granteeDocument.success) return { status: 'invalid-document' }

  const [grantee] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.documentNumber, granteeDocument.data))
    .limit(1)

  if (!grantee) return { status: 'grantee-not-found' }

  const cnpj = normalizeCnpj(input.cnpj)

  if (!isValidCnpj(cnpj)) return { status: 'invalid-cnpj' }

  const [existing] = await database
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.cnpj, cnpj))
    .limit(1)

  if (existing) return { status: 'duplicate-cnpj' }

  let lookup: Awaited<ReturnType<typeof lookupCnpj>>

  try {
    lookup = await lookupCnpj(cnpj)
  } catch (error) {
    return {
      status: 'lookup-failed',
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o CNPJ.',
    }
  }

  try {
    return await database.transaction(async tx => {
      const now = new Date()
      const [organization] = await tx
        .insert(organizations)
        .values({
          cnpj: lookup.cnpj,
          legalName: lookup.legalName,
          acronym: input.acronym,
          createdByUserId: input.actorUserId,
          cnpjVerifiedAt: now,
        })
        .returning({ id: organizations.id })

      if (!organization) {
        throw new Error('A criação da organização não retornou um ID.')
      }

      const [grant] = await tx
        .insert(provisioningGrants)
        .values({
          organizationId: organization.id,
          userId: grantee.id,
          createdByUserId: input.actorUserId,
        })
        .returning({ id: provisioningGrants.id })

      if (!grant) {
        throw new Error('A concessão temporária não retornou um ID.')
      }

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: organization.id,
        action: 'platform.organization_created',
        entityType: 'organization',
        entityId: organization.id,
        metadata: {
          cnpj: lookup.cnpj,
          cnaeFiscal: lookup.cnaeFiscal,
          granteeUserId: grantee.id,
        },
      })

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: organization.id,
        action: 'platform.provisioning_grant_created',
        entityType: 'provisioning_grant',
        entityId: grant.id,
        metadata: { userId: grantee.id },
      })

      return { status: 'created' as const, organizationId: organization.id }
    })
  } catch (error) {
    if (isDatabaseError(error)) return { status: 'duplicate-cnpj' }
    throw error
  }
}

export type UpdateOrganizationResult =
  | { status: 'updated' }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export async function updateOrganization(
  input: {
    actorUserId: string
    organizationId: string
    data: UpdateOrganizationData
  },
  database: typeof db = db,
): Promise<UpdateOrganizationResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationUpdate)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status === 'closed') {
      return { status: 'forbidden' as const }
    }

    const [updated] = await tx
      .update(organizations)
      .set({
        acronym: input.data.acronym,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id })

    if (!updated) return { status: 'not-found' as const }

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: updated.id,
      action: 'organization.updated',
      entityType: 'organization',
      entityId: updated.id,
      metadata: { acronym: input.data.acronym },
    })

    return { status: 'updated' as const }
  })
}

export type CreateRoleResult =
  | { status: 'created'; roleId: string }
  | { status: 'forbidden' }
  | { status: 'invalid-default-role' }
  | { status: 'invalid-permission' }
  | { status: 'full-access-not-allowed' }
  | { status: 'permission-not-allowed' }
  | { status: 'default-role-exists' }
  | { status: 'role-name-exists' }

export async function createRole(
  input: {
    actorUserId: string
    organizationId: string
    role: CreateRoleData
  },
  database: typeof db = db,
): Promise<CreateRoleResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.rolesManage)) {
    return { status: 'forbidden' }
  }

  if (
    input.role.isDefault &&
    (input.role.isDirector || input.role.hasFullAccess)
  ) {
    return { status: 'invalid-default-role' }
  }

  const knownPermissions = new Set<string>(PERMISSION_CODES)

  if (input.role.permissionCodes.some(code => !knownPermissions.has(code))) {
    return { status: 'invalid-permission' }
  }

  if (input.role.hasFullAccess && !access.canGrantFullAccess) {
    return { status: 'full-access-not-allowed' }
  }

  if (!hasEveryPermission(access, input.role.permissionCodes)) {
    return { status: 'permission-not-allowed' }
  }

  try {
    return await database.transaction(async tx => {
      const [organization] = await tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
        .for('update')

      if (!organization || organization.status === 'closed') {
        return { status: 'forbidden' as const }
      }

      if (input.role.isDefault) {
        const [existingDefault] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(
            and(
              eq(roles.organizationId, input.organizationId),
              eq(roles.isDefault, true),
              eq(roles.isActive, true),
            ),
          )
          .limit(1)

        if (existingDefault) return { status: 'default-role-exists' as const }
      }

      const [role] = await tx
        .insert(roles)
        .values({
          organizationId: input.organizationId,
          name: input.role.name,
          isDirector: input.role.isDirector,
          hasFullAccess: input.role.hasFullAccess,
          isDefault: input.role.isDefault,
        })
        .returning({ id: roles.id })

      if (!role) throw new Error('A criação do cargo não retornou um ID.')

      if (!input.role.hasFullAccess && input.role.permissionCodes.length > 0) {
        await tx.insert(rolePermissions).values(
          input.role.permissionCodes.map(code => ({
            roleId: role.id,
            permissionCode: code,
          })),
        )
      }

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        action: 'role.created',
        entityType: 'role',
        entityId: role.id,
        metadata: {
          name: input.role.name,
          isDirector: input.role.isDirector,
          hasFullAccess: input.role.hasFullAccess,
          isDefault: input.role.isDefault,
        },
      })

      return { status: 'created' as const, roleId: role.id }
    })
  } catch (error) {
    const constraint = getDatabaseErrorConstraint(error)

    if (constraint?.includes('roles_organization_id_default_unique')) {
      return { status: 'default-role-exists' }
    }

    if (constraint?.includes('roles_organization_id_name_unique')) {
      return { status: 'role-name-exists' }
    }

    throw error
  }
}

export type ActivateOrganizationResult =
  | { status: 'activated' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-active' }
  | { status: 'not-provisioning' }
  | { status: 'missing-default-role' }
  | { status: 'missing-full-access-role' }
  | { status: 'missing-director-occupant' }
  | { status: 'missing-full-access-member' }
  | { status: 'missing-documents' }

export async function activateOrganization(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<ActivateOrganizationResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationActivate)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status === 'closed') {
      return { status: 'not-provisioning' as const }
    }
    if (organization.status === 'active') {
      return { status: 'already-active' as const }
    }

    const readiness = await evaluateOrganizationReadiness(organizationId, tx)

    if (!readiness.defaultRole) {
      return { status: 'missing-default-role' as const }
    }
    if (!readiness.fullAccessRole) {
      return { status: 'missing-full-access-role' as const }
    }
    if (!readiness.directorOccupied) {
      return { status: 'missing-director-occupant' as const }
    }
    if (!readiness.fullAccessMember) {
      return { status: 'missing-full-access-member' as const }
    }
    if (!readiness.requiredDocuments) {
      return { status: 'missing-documents' as const }
    }

    const now = new Date()

    await tx
      .update(organizations)
      .set({ status: 'active', activatedAt: now, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    const granteeDocuments = await tx
      .select({ documentNumber: users.documentNumber })
      .from(provisioningGrants)
      .innerJoin(users, eq(users.id, provisioningGrants.userId))
      .where(
        and(
          eq(provisioningGrants.organizationId, organizationId),
          isNull(provisioningGrants.revokedAt),
        ),
      )

    let revokedGranteeInvites = 0

    if (granteeDocuments.length > 0) {
      const revoked = await tx
        .update(invites)
        .set({ revokedAt: now })
        .where(
          and(
            eq(invites.organizationId, organizationId),
            isNull(invites.revokedAt),
            inArray(
              invites.documentNumber,
              granteeDocuments.map(grantee => grantee.documentNumber),
            ),
          ),
        )
        .returning({ id: invites.id })

      revokedGranteeInvites = revoked.length
    }

    await tx
      .update(provisioningGrants)
      .set({ revokedAt: now })
      .where(
        and(
          eq(provisioningGrants.organizationId, organizationId),
          isNull(provisioningGrants.revokedAt),
        ),
      )

    await recordAuditEvent(tx, {
      actorUserId,
      organizationId,
      action: 'organization.activated',
      entityType: 'organization',
      entityId: organizationId,
      metadata: { revokedGranteeInvites },
    })

    return { status: 'activated' as const }
  })
}

export type CloseOrganizationResult =
  | { status: 'closed'; revokedInvites: number }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'not-active' }
  | { status: 'already-closed' }

export async function closeOrganization(
  input: {
    actorUserId: string
    organizationId: string
    reason: CloseOrganizationData['reason']
  },
  database: typeof db = db,
): Promise<CloseOrganizationResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationClose)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status === 'closed') {
      return { status: 'already-closed' as const }
    }
    if (organization.status !== 'active') {
      return { status: 'not-active' as const }
    }

    const now = new Date()

    const revokedInvites = await tx
      .update(invites)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invites.organizationId, input.organizationId),
          isNull(invites.revokedAt),
        ),
      )
      .returning({ id: invites.id })

    await tx
      .update(organizations)
      .set({ status: 'closed', closedAt: now, updatedAt: now })
      .where(eq(organizations.id, input.organizationId))

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: 'organization.closed',
      entityType: 'organization',
      entityId: input.organizationId,
      metadata: {
        reason: input.reason,
        revokedInvites: revokedInvites.length,
      },
    })

    return {
      status: 'closed' as const,
      revokedInvites: revokedInvites.length,
    }
  })
}

export type ReopenOrganizationResult =
  | { status: 'reopened' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'not-closed' }

export async function reopenOrganization(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<ReopenOrganizationResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationClose)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status !== 'closed') {
      return { status: 'not-closed' as const }
    }

    const now = new Date()

    await tx
      .update(organizations)
      .set({ status: 'active', closedAt: null, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    await recordAuditEvent(tx, {
      actorUserId,
      organizationId,
      action: 'organization.reopened',
      entityType: 'organization',
      entityId: organizationId,
    })

    return { status: 'reopened' as const }
  })
}

export type DeactivateMembershipResult =
  | { status: 'deactivated' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-inactive' }
  | { status: 'role-not-allowed' }
  | { status: 'last-full-access-member' }

export async function deactivateMembership(
  input: {
    actorUserId: string
    membershipId: string
    reason: DeactivateMembershipData['reason']
  },
  database: typeof db = db,
): Promise<DeactivateMembershipResult> {
  const [target] = await database
    .select({
      id: memberships.id,
      organizationId: memberships.organizationId,
      status: memberships.status,
    })
    .from(memberships)
    .where(eq(memberships.id, input.membershipId))
    .limit(1)

  if (!target) return { status: 'not-found' }

  const access = await getOrganizationAccess(
    input.actorUserId,
    target.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.membersManage)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, target.organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status === 'closed') {
      return { status: 'forbidden' as const }
    }

    const [membership] = await tx
      .select({
        id: memberships.id,
        status: memberships.status,
        roleId: memberships.roleId,
        currentHasFullAccess: roles.hasFullAccess,
      })
      .from(memberships)
      .innerJoin(
        roles,
        and(
          eq(roles.id, memberships.roleId),
          eq(roles.organizationId, memberships.organizationId),
        ),
      )
      .where(eq(memberships.id, input.membershipId))
      .limit(1)
      .for('update')

    if (!membership) return { status: 'not-found' as const }
    if (membership.status === 'inactive') {
      return { status: 'already-inactive' as const }
    }

    if (
      !(await canGrantRole(
        access,
        {
          id: membership.roleId,
          hasFullAccess: membership.currentHasFullAccess,
        },
        tx,
      ))
    ) {
      return { status: 'role-not-allowed' as const }
    }

    if (membership.currentHasFullAccess) {
      const others = await tx
        .select({ id: memberships.id })
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
            eq(memberships.organizationId, target.organizationId),
            eq(memberships.status, 'active'),
            eq(roles.isActive, true),
            eq(roles.hasFullAccess, true),
            ne(memberships.id, membership.id),
          ),
        )
        .limit(1)

      if (others.length === 0) {
        return { status: 'last-full-access-member' as const }
      }
    }

    const now = new Date()

    await tx
      .update(memberships)
      .set({
        status: 'inactive',
        deactivatedAt: now,
        deactivatedByUserId: input.actorUserId,
        deactivationReason: input.reason,
        updatedAt: now,
      })
      .where(eq(memberships.id, membership.id))

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: target.organizationId,
      action: 'membership.deactivated',
      entityType: 'membership',
      entityId: membership.id,
      metadata: { reason: input.reason },
    })

    return { status: 'deactivated' as const }
  })
}

export type ListRolesResult = Awaited<ReturnType<typeof listRoles>>

export async function listRoles(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
) {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.rolesRead)) {
    return { status: 'forbidden' as const }
  }

  const roleRows = await database
    .select({
      id: roles.id,
      name: roles.name,
      isDirector: roles.isDirector,
      hasFullAccess: roles.hasFullAccess,
      isDefault: roles.isDefault,
      isActive: roles.isActive,
    })
    .from(roles)
    .where(eq(roles.organizationId, organizationId))

  const permissionRows = await database
    .select({
      roleId: rolePermissions.roleId,
      code: rolePermissions.permissionCode,
    })
    .from(rolePermissions)
    .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
    .where(eq(roles.organizationId, organizationId))

  return {
    status: 'ok' as const,
    roles: roleRows.map(role => ({
      ...role,
      permissionCodes: permissionRows
        .filter(permission => permission.roleId === role.id)
        .map(permission => permission.code),
    })),
  }
}

export async function listUserOrganizations(
  userId: string,
  database: typeof db = db,
) {
  const membershipRows = await database
    .select({
      id: organizations.id,
      legalName: organizations.legalName,
      acronym: organizations.acronym,
      status: organizations.status,
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .innerJoin(
      roles,
      and(
        eq(roles.id, memberships.roleId),
        eq(roles.organizationId, memberships.organizationId),
      ),
    )
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, 'active'),
        eq(roles.isActive, true),
      ),
    )
    .orderBy(organizations.legalName)

  const grantRows = await database
    .select({
      id: organizations.id,
      legalName: organizations.legalName,
      acronym: organizations.acronym,
      status: organizations.status,
    })
    .from(provisioningGrants)
    .innerJoin(
      organizations,
      eq(organizations.id, provisioningGrants.organizationId),
    )
    .where(
      and(
        eq(provisioningGrants.userId, userId),
        isNull(provisioningGrants.revokedAt),
        eq(organizations.status, 'provisioning'),
      ),
    )
    .orderBy(organizations.legalName)

  const byOrganization = new Map<string, (typeof membershipRows)[number]>()

  for (const organization of membershipRows) {
    byOrganization.set(organization.id, organization)
  }

  for (const organization of grantRows) {
    if (byOrganization.has(organization.id)) continue

    byOrganization.set(organization.id, {
      ...organization,
      roleName: 'Acesso temporário de configuração',
    })
  }

  return [...byOrganization.values()].sort((first, second) =>
    first.legalName.localeCompare(second.legalName, 'pt-BR'),
  )
}

export type OrganizationSummary =
  | {
      status: 'ok'
      organization: {
        id: string
        cnpj: string
        legalName: string
        acronym: string
        status: 'provisioning' | 'active' | 'closed'
        closedAt: Date | null
      }
      access: {
        roleId: string | null
        hasFullAccess: boolean
        canGrantFullAccess: boolean
        provisioningGrantId: string | null
        permissions: string[]
      }
    }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export async function getOrganizationSummary(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<OrganizationSummary> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access) return { status: 'forbidden' }

  const [organization] = await database
    .select({
      id: organizations.id,
      cnpj: organizations.cnpj,
      legalName: organizations.legalName,
      acronym: organizations.acronym,
      status: organizations.status,
      closedAt: organizations.closedAt,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!organization) return { status: 'not-found' }

  return {
    status: 'ok',
    organization,
    access: {
      roleId: access.roleId,
      hasFullAccess: access.hasFullAccess,
      canGrantFullAccess: access.canGrantFullAccess,
      provisioningGrantId: access.provisioningGrantId,
      permissions: [...access.permissions],
    },
  }
}

export type OrganizationOverviewDirector = {
  name: string
  roleName: string
  hasFullAccess: boolean
  joinedAt: Date
}

export type OrganizationOverviewEvent = {
  id: string
  action: string
  entityType: string
  actorName: string | null
  createdAt: Date
}

export type OrganizationOverviewDocument = {
  id: string
  type: string
  label: string
  uploadedByName: string
  createdAt: Date
}

export type OrganizationOverview =
  | {
      status: 'ok'
      summary: Extract<OrganizationSummary, { status: 'ok' }>
      counts: {
        activeMembers: number | null
        inactiveMembers: number | null
        activeRoles: number | null
        fullAccessRoles: number | null
        activeInvites: number | null
        pendingPreRegistrations: number | null
        documents: number | null
      }
      directors: OrganizationOverviewDirector[] | null
      recentEvents: OrganizationOverviewEvent[] | null
      documents: OrganizationOverviewDocument[] | null
      readiness: OrganizationReadiness | null
    }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export async function getOrganizationOverview(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<OrganizationOverview> {
  const summary = await getOrganizationSummary(
    actorUserId,
    organizationId,
    database,
  )

  if (summary.status === 'not-found') return { status: 'not-found' }

  if (summary.status !== 'ok') return { status: 'forbidden' }

  const permissions = new Set(summary.access.permissions)
  const can = (permission: string) => permissions.has(permission)
  const now = new Date()

  const [
    membershipCounts,
    roleCounts,
    activeInvites,
    pendingPreRegistrations,
    directors,
    recentEvents,
    documents,
    readiness,
  ] = await Promise.all([
    can(PERMISSIONS.membersRead)
      ? database
          .select({
            status: memberships.status,
            total: count(),
          })
          .from(memberships)
          .where(eq(memberships.organizationId, organizationId))
          .groupBy(memberships.status)
      : Promise.resolve(null),
    can(PERMISSIONS.rolesRead)
      ? Promise.all([
          database
            .select({ total: count() })
            .from(roles)
            .where(
              and(
                eq(roles.organizationId, organizationId),
                eq(roles.isActive, true),
              ),
            ),
          database
            .select({ total: count() })
            .from(roles)
            .where(
              and(
                eq(roles.organizationId, organizationId),
                eq(roles.isActive, true),
                eq(roles.hasFullAccess, true),
              ),
            ),
        ])
      : Promise.resolve(null),
    can(PERMISSIONS.invitesManage)
      ? database
          .select({ total: count() })
          .from(invites)
          .where(
            and(
              eq(invites.organizationId, organizationId),
              isNull(invites.revokedAt),
              gt(invites.expiresAt, now),
              or(
                isNull(invites.maxUses),
                lt(invites.usesCount, invites.maxUses),
              ),
            ),
          )
      : Promise.resolve(null),
    can(PERMISSIONS.membersManage)
      ? database
          .select({ total: count() })
          .from(registrationRequests)
          .innerJoin(
            roles,
            and(
              eq(roles.id, registrationRequests.roleId),
              eq(roles.organizationId, registrationRequests.organizationId),
            ),
          )
          .where(
            and(
              eq(registrationRequests.organizationId, organizationId),
              isNull(registrationRequests.consumedAt),
              isNull(registrationRequests.invalidatedAt),
            ),
          )
      : Promise.resolve(null),
    can(PERMISSIONS.membersRead)
      ? database
          .select({
            name: users.name,
            roleName: roles.name,
            hasFullAccess: roles.hasFullAccess,
            joinedAt: memberships.joinedAt,
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
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
              eq(roles.isDirector, true),
            ),
          )
          .orderBy(roles.name, users.name)
      : Promise.resolve(null),
    can(PERMISSIONS.auditRead)
      ? database
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            entityType: auditEvents.entityType,
            actorName: users.name,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .leftJoin(users, eq(users.id, auditEvents.actorUserId))
          .where(eq(auditEvents.organizationId, organizationId))
          .orderBy(desc(auditEvents.createdAt))
          .limit(5)
      : Promise.resolve(null),
    can(PERMISSIONS.organizationRead)
      ? database
          .select({
            id: organizationDocuments.id,
            type: organizationDocuments.type,
            uploadedByName: users.name,
            createdAt: organizationDocuments.createdAt,
          })
          .from(organizationDocuments)
          .innerJoin(
            users,
            eq(users.id, organizationDocuments.uploadedByUserId),
          )
          .where(eq(organizationDocuments.organizationId, organizationId))
          .orderBy(desc(organizationDocuments.createdAt))
      : Promise.resolve(null),
    summary.organization.status === 'provisioning'
      ? evaluateOrganizationReadiness(organizationId, database)
      : Promise.resolve(null),
  ])

  const activeMembers =
    membershipCounts?.find(membership => membership.status === 'active')
      ?.total ?? 0
  const inactiveMembers =
    membershipCounts?.find(membership => membership.status === 'inactive')
      ?.total ?? 0

  return {
    status: 'ok',
    summary,
    counts: {
      activeMembers: membershipCounts ? activeMembers : null,
      inactiveMembers: membershipCounts ? inactiveMembers : null,
      activeRoles: roleCounts ? roleCounts[0][0].total : null,
      fullAccessRoles: roleCounts ? roleCounts[1][0].total : null,
      activeInvites: activeInvites ? activeInvites[0].total : null,
      pendingPreRegistrations: pendingPreRegistrations
        ? pendingPreRegistrations[0].total
        : null,
      documents: documents ? documents.length : null,
    },
    directors,
    recentEvents,
    documents: documents
      ? documents.map(document => ({
          ...document,
          label: ORGANIZATION_DOCUMENT_LABELS[document.type],
        }))
      : null,
    readiness,
  }
}

export type OrganizationMembershipListItem = {
  membershipId: string
  userId: string
  name: string
  email: string
  documentNumber: string
  roleId: string
  roleName: string
  status: 'active' | 'inactive'
  joinedAt: Date
  deactivatedAt: Date | null
  deactivationReason: string | null
}

export type ListOrganizationMembershipsResult =
  | { status: 'ok'; memberships: OrganizationMembershipListItem[] }
  | { status: 'forbidden' }

export type ListOrganizationMembershipsOptions = {
  query?: string
  limit?: number
  offset?: number
}

export async function listOrganizationMemberships(
  actorUserId: string,
  organizationId: string,
  options: ListOrganizationMembershipsOptions = {},
  database: typeof db = db,
): Promise<ListOrganizationMembershipsResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.membersRead)) {
    return { status: 'forbidden' }
  }

  const query = options.query?.trim()
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const offset = Math.max(options.offset ?? 0, 0)
  const searchCondition = query
    ? or(
        ilike(users.name, `%${query}%`),
        ilike(users.email, `%${query}%`),
        ilike(users.documentNumber, `%${query}%`),
      )
    : undefined

  const rows = await database
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      documentNumber: users.documentNumber,
      roleId: roles.id,
      roleName: roles.name,
      status: memberships.status,
      joinedAt: memberships.joinedAt,
      deactivatedAt: memberships.deactivatedAt,
      deactivationReason: memberships.deactivationReason,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(
      roles,
      and(
        eq(roles.id, memberships.roleId),
        eq(roles.organizationId, memberships.organizationId),
      ),
    )
    .where(and(eq(memberships.organizationId, organizationId), searchCondition))
    .orderBy(users.name)
    .limit(limit)
    .offset(offset)

  return { status: 'ok', memberships: rows }
}

export type UpdateRoleResult =
  | { status: 'updated' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid-default-role' }
  | { status: 'invalid-permission' }
  | { status: 'full-access-not-allowed' }
  | { status: 'permission-not-allowed' }
  | { status: 'default-role-exists' }
  | { status: 'role-name-exists' }
  | { status: 'role-in-use' }
  | { status: 'default-role-required' }
  | { status: 'full-access-required' }

export async function updateRole(
  input: {
    actorUserId: string
    organizationId: string
    roleId: string
    role: UpdateRoleData
  },
  database: typeof db = db,
): Promise<UpdateRoleResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.rolesManage)) {
    return { status: 'forbidden' }
  }

  if (
    input.role.isDefault &&
    (input.role.isDirector || input.role.hasFullAccess)
  ) {
    return { status: 'invalid-default-role' }
  }

  const knownPermissions = new Set<string>(PERMISSION_CODES)

  if (input.role.permissionCodes.some(code => !knownPermissions.has(code))) {
    return { status: 'invalid-permission' }
  }

  try {
    return await database.transaction(async tx => {
      const [organization] = await tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
        .for('update')

      if (!organization) return { status: 'not-found' as const }
      if (organization.status === 'closed') {
        return { status: 'forbidden' as const }
      }

      const [role] = await tx
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, input.roleId),
            eq(roles.organizationId, input.organizationId),
          ),
        )
        .limit(1)
        .for('update')

      if (!role) return { status: 'not-found' as const }

      if (role.hasFullAccess && !access.canGrantFullAccess) {
        return { status: 'full-access-not-allowed' as const }
      }

      if (!(await canGrantRole(access, role, tx))) {
        return { status: 'permission-not-allowed' as const }
      }

      if (input.role.hasFullAccess && !access.canGrantFullAccess) {
        return { status: 'full-access-not-allowed' as const }
      }

      if (!hasEveryPermission(access, input.role.permissionCodes)) {
        return { status: 'permission-not-allowed' as const }
      }

      const now = new Date()
      const deactivating = role.isActive && !input.role.isActive
      const reactivating = !role.isActive && input.role.isActive
      const remainsActive = role.isActive && input.role.isActive

      if (deactivating) {
        const [membership] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              eq(memberships.organizationId, input.organizationId),
              eq(memberships.roleId, role.id),
              eq(memberships.status, 'active'),
            ),
          )
          .limit(1)

        if (membership) return { status: 'role-in-use' as const }

        const [activeInvite] = await tx
          .select({ id: invites.id })
          .from(invites)
          .where(
            and(
              eq(invites.organizationId, input.organizationId),
              eq(invites.roleId, role.id),
              isNull(invites.revokedAt),
              gt(invites.expiresAt, now),
              or(
                isNull(invites.maxUses),
                lt(invites.usesCount, invites.maxUses),
              ),
            ),
          )
          .limit(1)

        if (activeInvite) return { status: 'role-in-use' as const }

        if (role.isDefault) {
          return { status: 'default-role-required' as const }
        }
      }

      if ((remainsActive || reactivating) && input.role.isDefault) {
        const [otherDefault] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(
            and(
              eq(roles.organizationId, input.organizationId),
              eq(roles.isDefault, true),
              eq(roles.isActive, true),
              ne(roles.id, role.id),
            ),
          )
          .limit(1)

        if (otherDefault) return { status: 'default-role-exists' as const }
      }

      if (
        role.isDefault &&
        !input.role.isDefault &&
        access.organizationStatus === 'active'
      ) {
        return { status: 'default-role-required' as const }
      }

      if (role.isDefault && input.role.isDefault && deactivating) {
        return { status: 'default-role-required' as const }
      }

      if (
        remainsActive &&
        role.hasFullAccess &&
        !input.role.hasFullAccess &&
        access.organizationStatus === 'active'
      ) {
        const [activeMember] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              eq(memberships.organizationId, input.organizationId),
              eq(memberships.roleId, role.id),
              eq(memberships.status, 'active'),
            ),
          )
          .limit(1)

        if (activeMember) {
          const [otherFullAccess] = await tx
            .select({ id: memberships.id })
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
                eq(memberships.organizationId, input.organizationId),
                eq(memberships.status, 'active'),
                eq(roles.isActive, true),
                eq(roles.hasFullAccess, true),
                ne(memberships.roleId, role.id),
              ),
            )
            .limit(1)

          if (!otherFullAccess) {
            return { status: 'full-access-required' as const }
          }
        }
      }

      const [updated] = await tx
        .update(roles)
        .set({
          name: input.role.name,
          isDirector: input.role.isDirector,
          hasFullAccess: input.role.hasFullAccess,
          isDefault: input.role.isDefault,
          isActive: input.role.isActive,
          updatedAt: now,
        })
        .where(eq(roles.id, role.id))
        .returning({ id: roles.id })

      if (!updated) {
        throw new Error('A atualização do cargo não retornou um ID.')
      }

      await tx
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))

      if (!input.role.hasFullAccess && input.role.permissionCodes.length > 0) {
        await tx.insert(rolePermissions).values(
          input.role.permissionCodes.map(code => ({
            roleId: role.id,
            permissionCode: code,
          })),
        )
      }

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        action: 'role.updated',
        entityType: 'role',
        entityId: role.id,
        metadata: {
          name: input.role.name,
          isDirector: input.role.isDirector,
          hasFullAccess: input.role.hasFullAccess,
          isDefault: input.role.isDefault,
          isActive: input.role.isActive,
        },
      })

      return { status: 'updated' as const }
    })
  } catch (error) {
    const constraint = getDatabaseErrorConstraint(error)

    if (constraint?.includes('roles_organization_id_default_unique')) {
      return { status: 'default-role-exists' }
    }

    if (constraint?.includes('roles_organization_id_name_unique')) {
      return { status: 'role-name-exists' }
    }

    throw error
  }
}

export type ChangeDefaultRoleResult =
  | { status: 'changed'; previousRoleId: string | null }
  | { status: 'unchanged' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid-role' }
  | { status: 'invalid-default-role' }
  | { status: 'role-not-allowed' }

export async function changeDefaultRole(
  input: {
    actorUserId: string
    organizationId: string
    roleId: string
  },
  database: typeof db = db,
): Promise<ChangeDefaultRoleResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.rolesManage)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status === 'closed') {
      return { status: 'forbidden' as const }
    }

    const [role] = await tx
      .select({
        id: roles.id,
        isDirector: roles.isDirector,
        hasFullAccess: roles.hasFullAccess,
        isDefault: roles.isDefault,
        isActive: roles.isActive,
      })
      .from(roles)
      .where(
        and(
          eq(roles.id, input.roleId),
          eq(roles.organizationId, input.organizationId),
        ),
      )
      .limit(1)
      .for('update')

    if (!role?.isActive) return { status: 'invalid-role' as const }
    if (role.isDefault) return { status: 'unchanged' as const }
    if (role.isDirector || role.hasFullAccess) {
      return { status: 'invalid-default-role' as const }
    }

    if (!(await canGrantRole(access, role, tx))) {
      return { status: 'role-not-allowed' as const }
    }

    const [currentDefault] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, input.organizationId),
          eq(roles.isDefault, true),
        ),
      )
      .limit(1)
      .for('update')

    const now = new Date()

    if (currentDefault) {
      await tx
        .update(roles)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(roles.id, currentDefault.id))
    }

    await tx
      .update(roles)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(roles.id, role.id))

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: 'role.default_changed',
      entityType: 'role',
      entityId: role.id,
      metadata: {
        fromRoleId: currentDefault?.id ?? null,
        toRoleId: role.id,
      },
    })

    return {
      status: 'changed' as const,
      previousRoleId: currentDefault?.id ?? null,
    }
  })
}

export type AssignableRole = {
  id: string
  name: string
  hasFullAccess: boolean
}

export type ListAssignableRolesResult =
  | { status: 'ok'; roles: AssignableRole[] }
  | { status: 'forbidden' }

export async function listAssignableRoles(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<ListAssignableRolesResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.membersManage)) {
    return { status: 'forbidden' }
  }

  const rows = await database
    .select({
      id: roles.id,
      name: roles.name,
      hasFullAccess: roles.hasFullAccess,
    })
    .from(roles)
    .where(
      and(eq(roles.organizationId, organizationId), eq(roles.isActive, true)),
    )
    .orderBy(roles.name)

  const permissionRows = await database
    .select({
      roleId: rolePermissions.roleId,
      code: rolePermissions.permissionCode,
    })
    .from(rolePermissions)
    .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
    .where(eq(roles.organizationId, organizationId))

  return {
    status: 'ok',
    roles: rows.filter(role => {
      if (!access.canGrantFullAccess && role.hasFullAccess) return false

      return hasEveryPermission(
        access,
        permissionRows
          .filter(permission => permission.roleId === role.id)
          .map(permission => permission.code),
      )
    }),
  }
}

export type UpdateMembershipRoleResult =
  | { status: 'updated' }
  | { status: 'unchanged' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'inactive-membership' }
  | { status: 'invalid-role' }
  | { status: 'role-not-allowed' }
  | { status: 'last-full-access-member' }

export async function updateMembershipRole(
  input: {
    actorUserId: string
    membershipId: string
    roleId: string
  },
  database: typeof db = db,
): Promise<UpdateMembershipRoleResult> {
  const [target] = await database
    .select({
      organizationId: memberships.organizationId,
    })
    .from(memberships)
    .where(eq(memberships.id, input.membershipId))
    .limit(1)

  if (!target) return { status: 'not-found' }

  const access = await getOrganizationAccess(
    input.actorUserId,
    target.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.membersManage)) {
    return { status: 'forbidden' }
  }

  return database.transaction(async tx => {
    const [organization] = await tx
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, target.organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }
    if (organization.status === 'closed') {
      return { status: 'forbidden' as const }
    }

    const [membership] = await tx
      .select({
        id: memberships.id,
        status: memberships.status,
        roleId: memberships.roleId,
        currentHasFullAccess: roles.hasFullAccess,
      })
      .from(memberships)
      .innerJoin(
        roles,
        and(
          eq(roles.id, memberships.roleId),
          eq(roles.organizationId, memberships.organizationId),
        ),
      )
      .where(eq(memberships.id, input.membershipId))
      .limit(1)
      .for('update')

    if (!membership) return { status: 'not-found' as const }

    if (membership.status === 'inactive') {
      return { status: 'inactive-membership' as const }
    }

    if (
      !(await canGrantRole(
        access,
        {
          id: membership.roleId,
          hasFullAccess: membership.currentHasFullAccess,
        },
        tx,
      ))
    ) {
      return { status: 'role-not-allowed' as const }
    }

    const [newRole] = await tx
      .select({
        id: roles.id,
        hasFullAccess: roles.hasFullAccess,
      })
      .from(roles)
      .where(
        and(
          eq(roles.id, input.roleId),
          eq(roles.organizationId, target.organizationId),
          eq(roles.isActive, true),
        ),
      )
      .limit(1)

    if (!newRole) return { status: 'invalid-role' as const }

    if (newRole.id === membership.roleId) {
      return { status: 'unchanged' as const }
    }

    if (!(await canGrantRole(access, newRole, tx))) {
      return { status: 'role-not-allowed' as const }
    }

    if (membership.currentHasFullAccess && !newRole.hasFullAccess) {
      const [otherFullAccess] = await tx
        .select({ id: memberships.id })
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
            eq(memberships.organizationId, target.organizationId),
            eq(memberships.status, 'active'),
            eq(roles.isActive, true),
            eq(roles.hasFullAccess, true),
            ne(memberships.id, membership.id),
          ),
        )
        .limit(1)

      if (!otherFullAccess) {
        return { status: 'last-full-access-member' as const }
      }
    }

    await tx
      .update(memberships)
      .set({ roleId: newRole.id, updatedAt: new Date() })
      .where(eq(memberships.id, membership.id))

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: target.organizationId,
      action: 'membership.role_changed',
      entityType: 'membership',
      entityId: membership.id,
      metadata: {
        fromRoleId: membership.roleId,
        toRoleId: newRole.id,
      },
    })

    return { status: 'updated' as const }
  })
}

export type PendingPreRegistration = {
  id: string
  name: string
  email: string
  roleName: string
  createdAt: Date
  expiresAt: Date
}

export type ListPendingPreRegistrationsResult =
  | { status: 'ok'; requests: PendingPreRegistration[] }
  | { status: 'forbidden' }

export async function listPendingPreRegistrations(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<ListPendingPreRegistrationsResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.membersManage)) {
    return { status: 'forbidden' }
  }

  const requests = await database
    .select({
      id: registrationRequests.id,
      name: registrationRequests.name,
      email: registrationRequests.email,
      roleName: roles.name,
      createdAt: registrationRequests.createdAt,
      expiresAt: registrationRequests.expiresAt,
    })
    .from(registrationRequests)
    .innerJoin(
      roles,
      and(
        eq(roles.id, registrationRequests.roleId),
        eq(roles.organizationId, registrationRequests.organizationId),
      ),
    )
    .where(
      and(
        eq(registrationRequests.organizationId, organizationId),
        isNull(registrationRequests.consumedAt),
        isNull(registrationRequests.invalidatedAt),
      ),
    )
    .orderBy(desc(registrationRequests.createdAt))
    .limit(50)

  return { status: 'ok', requests }
}

export type AdminOrganizationListItem = {
  id: string
  cnpj: string
  legalName: string
  acronym: string
  status: 'provisioning' | 'active' | 'closed'
  createdAt: Date
  activatedAt: Date | null
}

export type ListAdminOrganizationsResult =
  | { status: 'ok'; organizations: AdminOrganizationListItem[] }
  | { status: 'forbidden' }

export async function listAdminOrganizations(
  adminUserId: string,
  options: {
    status?: 'provisioning' | 'active' | 'closed'
    limit?: number
    offset?: number
  } = {},
  database: typeof db = db,
): Promise<ListAdminOrganizationsResult> {
  if (!(await isPlatformAdmin(adminUserId, database))) {
    return { status: 'forbidden' }
  }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const offset = Math.max(options.offset ?? 0, 0)

  const conditions = options.status
    ? eq(organizations.status, options.status)
    : undefined

  const organizationsList = await database
    .select({
      id: organizations.id,
      cnpj: organizations.cnpj,
      legalName: organizations.legalName,
      acronym: organizations.acronym,
      status: organizations.status,
      createdAt: organizations.createdAt,
      activatedAt: organizations.activatedAt,
    })
    .from(organizations)
    .where(conditions)
    .orderBy(desc(organizations.createdAt))
    .limit(limit)
    .offset(offset)

  return { status: 'ok', organizations: organizationsList }
}
