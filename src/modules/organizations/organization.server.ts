import 'server-only'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { memberships, organizations, rolePermissions, roles } from '@/db/schema'
import { getDatabaseErrorConstraint, isDatabaseError } from '@/lib/errors'
import { recordAuditEvent } from '@/modules/audit/audit.server'
import {
  getOrganizationAccess,
  hasPermission,
  isPlatformAdmin,
} from '@/modules/authorization/authorize.server'
import {
  PERMISSION_CODES,
  PERMISSIONS,
} from '@/modules/authorization/permissions'
import { isValidCnpj, normalizeCnpj } from './cnpj'
import { lookupCnpj } from './cnpj.server'
import type {
  CreateRoleData,
  DeactivateMembershipData,
} from './organization.schema'

export type CreateOrganizationResult =
  | { status: 'created'; organizationId: string }
  | { status: 'forbidden' }
  | { status: 'invalid-cnpj' }
  | { status: 'duplicate-cnpj' }
  | { status: 'lookup-failed'; message: string }

export async function createOrganization(
  input: { actorUserId: string; cnpj: string; acronym: string },
  database: typeof db = db,
): Promise<CreateOrganizationResult> {
  if (!(await isPlatformAdmin(input.actorUserId, database))) {
    return { status: 'forbidden' }
  }

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

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: organization.id,
        action: 'organization.created',
        entityType: 'organization',
        entityId: organization.id,
        metadata: { cnpj: lookup.cnpj },
      })

      return { status: 'created' as const, organizationId: organization.id }
    })
  } catch (error) {
    if (isDatabaseError(error)) return { status: 'duplicate-cnpj' }
    throw error
  }
}

export type CreateRoleResult =
  | { status: 'created'; roleId: string }
  | { status: 'forbidden' }
  | { status: 'invalid-default-role' }
  | { status: 'invalid-permission' }
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

  try {
    return await database.transaction(async tx => {
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
  | { status: 'missing-default-role' }
  | { status: 'missing-full-access-role' }
  | { status: 'missing-director-occupant' }
  | { status: 'missing-full-access-member' }

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
    if (organization.status === 'active') {
      return { status: 'already-active' as const }
    }

    const activeRoles = await tx
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

    if (defaultRoles.length !== 1) {
      return { status: 'missing-default-role' as const }
    }

    const fullAccessRoles = activeRoles.filter(role => role.hasFullAccess)

    if (fullAccessRoles.length === 0) {
      return { status: 'missing-full-access-role' as const }
    }

    const activeMembers = await tx
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

    const directorRolesWithoutOccupant = activeRoles.filter(
      role =>
        role.isDirector &&
        !activeMembers.some(member => member.roleId === role.id),
    )

    if (directorRolesWithoutOccupant.length > 0) {
      return { status: 'missing-director-occupant' as const }
    }

    if (!activeMembers.some(member => member.hasFullAccess)) {
      return { status: 'missing-full-access-member' as const }
    }

    const now = new Date()

    await tx
      .update(organizations)
      .set({ status: 'active', activatedAt: now, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    await recordAuditEvent(tx, {
      actorUserId,
      organizationId,
      action: 'organization.activated',
      entityType: 'organization',
      entityId: organizationId,
    })

    return { status: 'activated' as const }
  })
}

export type DeactivateMembershipResult =
  | { status: 'deactivated' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-inactive' }
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
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, target.organizationId))
      .limit(1)
      .for('update')

    if (!organization) return { status: 'not-found' as const }

    const [membership] = await tx
      .select({
        id: memberships.id,
        status: memberships.status,
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
      .where(eq(memberships.id, input.membershipId))
      .limit(1)
      .for('update')

    if (!membership) return { status: 'not-found' as const }
    if (membership.status === 'inactive') {
      return { status: 'already-inactive' as const }
    }

    if (membership.hasFullAccess) {
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
  return database
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
}

export type OrganizationSummary =
  | {
      status: 'ok'
      organization: {
        id: string
        legalName: string
        acronym: string
        status: 'provisioning' | 'active'
      }
      access: {
        roleId: string
        hasFullAccess: boolean
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
      legalName: organizations.legalName,
      acronym: organizations.acronym,
      status: organizations.status,
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
      permissions: [...access.permissions],
    },
  }
}
