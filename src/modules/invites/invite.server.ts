import 'server-only'
import {
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '@/db'
import {
  inviteRedemptions,
  invites,
  memberships,
  organizations,
  rolePermissions,
  roles,
  users,
} from '@/db/schema'
import { recordAuditEvent } from '@/modules/audit/audit.server'
import {
  canGrantRole,
  getOrganizationAccess,
  hasEveryPermission,
  hasPermission,
} from '@/modules/authorization/authorize.server'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import {
  INVITE_INDIVIDUAL_TTL_MS,
  INVITE_RESEND_INTERVAL_MS,
  INVITE_SHARED_TTL_MS,
} from './invite-policy'
import { createInviteToken, hashInviteToken } from './invite-token'

export type InviteType = 'individual' | 'shared'

export type CreateInviteInput = {
  actorUserId: string
  organizationId: string
  type: InviteType
  roleId?: string | null
  documentNumber?: string | null
  maxUses?: number | null
  expiresAt: Date
}

export type CreateInviteResult =
  | { status: 'created'; inviteId: string; token: string }
  | { status: 'forbidden' }
  | { status: 'invalid-role' }
  | { status: 'role-not-allowed' }
  | { status: 'invalid-document' }
  | { status: 'invalid-expiry' }
  | { status: 'invalid-max-uses' }

function normalizeDocument(value: string): string {
  return value.replaceAll(/\D/g, '')
}

export async function createInvite(
  input: CreateInviteInput,
  database: typeof db = db,
): Promise<CreateInviteResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.invitesManage)) {
    return { status: 'forbidden' }
  }

  const now = new Date()

  if (input.expiresAt.getTime() <= now.getTime()) {
    return { status: 'invalid-expiry' }
  }

  const documentNumber =
    input.type === 'individual'
      ? normalizeDocument(input.documentNumber ?? '')
      : null

  if (input.type === 'individual' && !/^\d{11}$/.test(documentNumber ?? '')) {
    return { status: 'invalid-document' }
  }

  const maxUses = input.type === 'individual' ? 1 : (input.maxUses ?? null)

  if (maxUses !== null && maxUses <= 0) {
    return { status: 'invalid-max-uses' }
  }

  let role: {
    id: string
    isDirector: boolean
    hasFullAccess: boolean
  } | null = null

  if (input.roleId) {
    const [found] = await database
      .select({
        id: roles.id,
        name: roles.name,
        isDirector: roles.isDirector,
        hasFullAccess: roles.hasFullAccess,
      })
      .from(roles)
      .where(
        and(
          eq(roles.id, input.roleId),
          eq(roles.organizationId, input.organizationId),
          eq(roles.isActive, true),
        ),
      )
      .limit(1)

    if (!found) return { status: 'invalid-role' }

    role = found
  } else if (input.type === 'individual') {
    return { status: 'invalid-role' }
  }

  if (input.type === 'shared' && role?.hasFullAccess) {
    return { status: 'invalid-role' }
  }

  if (input.type === 'shared' && role?.isDirector) {
    return { status: 'invalid-role' }
  }

  let roleToGrant: { id: string; hasFullAccess: boolean } | null = role

  if (!input.roleId && input.type === 'shared') {
    const [defaultRole] = await database
      .select({ id: roles.id, hasFullAccess: roles.hasFullAccess })
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, input.organizationId),
          eq(roles.isDefault, true),
          eq(roles.isActive, true),
        ),
      )
      .limit(1)

    roleToGrant = defaultRole ?? null
  }

  if (roleToGrant && !(await canGrantRole(access, roleToGrant, database))) {
    return { status: 'role-not-allowed' }
  }

  const generated = createInviteToken()

  return database.transaction(async tx => {
    const [invite] = await tx
      .insert(invites)
      .values({
        organizationId: input.organizationId,
        roleId: input.roleId ?? null,
        type: input.type,
        documentNumber,
        tokenHash: generated.tokenHash,
        maxUses,
        expiresAt: input.expiresAt,
        createdByUserId: input.actorUserId,
        createdByMembershipId: access.membershipId,
      })
      .returning({ id: invites.id })

    if (!invite) {
      throw new Error('A criação do convite não retornou um ID.')
    }

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: 'invite.created',
      entityType: 'invite',
      entityId: invite.id,
      metadata: {
        type: input.type,
        roleId: input.roleId ?? null,
        maxUses,
      },
    })

    return {
      status: 'created' as const,
      inviteId: invite.id,
      token: generated.token,
    }
  })
}

export type ResendInviteResult =
  | { status: 'resent'; inviteId: string; token: string }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-revoked' }
  | { status: 'rate-limited' }
  | { status: 'invalid-role' }
  | { status: 'role-not-allowed' }

export async function resendInvite(
  input: {
    actorUserId: string
    inviteId: string
  },
  database: typeof db = db,
): Promise<ResendInviteResult> {
  const [invite] = await database
    .select({
      id: invites.id,
      organizationId: invites.organizationId,
      roleId: invites.roleId,
      type: invites.type,
      documentNumber: invites.documentNumber,
      maxUses: invites.maxUses,
      revokedAt: invites.revokedAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .where(eq(invites.id, input.inviteId))
    .limit(1)

  if (!invite) return { status: 'not-found' }

  const access = await getOrganizationAccess(
    input.actorUserId,
    invite.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.invitesManage)) {
    return { status: 'forbidden' }
  }

  if (invite.revokedAt) return { status: 'already-revoked' }

  const now = new Date()

  if (now.getTime() - invite.createdAt.getTime() < INVITE_RESEND_INTERVAL_MS) {
    return { status: 'rate-limited' }
  }

  if (invite.roleId) {
    const [role] = await database
      .select({
        id: roles.id,
        isDirector: roles.isDirector,
        hasFullAccess: roles.hasFullAccess,
      })
      .from(roles)
      .where(
        and(
          eq(roles.id, invite.roleId),
          eq(roles.organizationId, invite.organizationId),
          eq(roles.isActive, true),
        ),
      )
      .limit(1)

    if (!role) return { status: 'invalid-role' }
    if (invite.type === 'shared' && (role.isDirector || role.hasFullAccess)) {
      return { status: 'invalid-role' }
    }
    if (!(await canGrantRole(access, role, database))) {
      return { status: 'role-not-allowed' }
    }
  }

  if (!invite.roleId && invite.type === 'shared') {
    const [defaultRole] = await database
      .select({ id: roles.id, hasFullAccess: roles.hasFullAccess })
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, invite.organizationId),
          eq(roles.isDefault, true),
          eq(roles.isActive, true),
        ),
      )
      .limit(1)

    if (defaultRole && !(await canGrantRole(access, defaultRole, database))) {
      return { status: 'role-not-allowed' }
    }
  }

  const generated = createInviteToken()
  const expiresAt = new Date(
    now.getTime() +
      (invite.type === 'individual'
        ? INVITE_INDIVIDUAL_TTL_MS
        : INVITE_SHARED_TTL_MS),
  )

  return database.transaction(async tx => {
    const [current] = await tx
      .select({
        id: invites.id,
        revokedAt: invites.revokedAt,
      })
      .from(invites)
      .where(eq(invites.id, invite.id))
      .limit(1)
      .for('update')

    if (!current) return { status: 'not-found' as const }
    if (current.revokedAt) return { status: 'already-revoked' as const }

    const [resent] = await tx
      .insert(invites)
      .values({
        organizationId: invite.organizationId,
        roleId: invite.roleId,
        type: invite.type,
        documentNumber: invite.documentNumber,
        tokenHash: generated.tokenHash,
        maxUses: invite.maxUses,
        expiresAt,
        createdByUserId: input.actorUserId,
        createdByMembershipId: access.membershipId,
      })
      .returning({ id: invites.id })

    if (!resent) throw new Error('O reenvio do convite não retornou um ID.')

    await tx
      .update(invites)
      .set({ revokedAt: now })
      .where(eq(invites.id, invite.id))

    await recordAuditEvent(tx, {
      actorUserId: input.actorUserId,
      organizationId: invite.organizationId,
      action: 'invite.resent',
      entityType: 'invite',
      entityId: resent.id,
      metadata: {
        previousInviteId: invite.id,
        type: invite.type,
      },
    })

    return {
      status: 'resent' as const,
      inviteId: resent.id,
      token: generated.token,
    }
  })
}

export type ValidInvite = {
  id: string
  organizationId: string
  roleId: string | null
  type: InviteType
  documentNumber: string | null
  maxUses: number | null
  usesCount: number
  expiresAt: Date
  organization: {
    legalName: string
    acronym: string
  }
  role: {
    id: string
    name: string
    isDirector: boolean
    hasFullAccess: boolean
  } | null
}

export async function validateInviteToken(
  token: string,
  database: typeof db = db,
): Promise<ValidInvite | null> {
  const now = new Date()
  const tokenHash = hashInviteToken(token)

  const [invite] = await database
    .select({
      id: invites.id,
      organizationId: invites.organizationId,
      roleId: invites.roleId,
      type: invites.type,
      documentNumber: invites.documentNumber,
      maxUses: invites.maxUses,
      usesCount: invites.usesCount,
      expiresAt: invites.expiresAt,
      organizationName: organizations.legalName,
      organizationAcronym: organizations.acronym,
    })
    .from(invites)
    .innerJoin(organizations, eq(organizations.id, invites.organizationId))
    .where(
      and(
        eq(invites.tokenHash, tokenHash),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, now),
        or(isNull(invites.maxUses), lt(invites.usesCount, invites.maxUses)),
      ),
    )
    .limit(1)

  if (!invite) return null

  let role: ValidInvite['role'] = null

  if (invite.roleId) {
    const [found] = await database
      .select({
        id: roles.id,
        name: roles.name,
        isDirector: roles.isDirector,
        hasFullAccess: roles.hasFullAccess,
      })
      .from(roles)
      .where(
        and(
          eq(roles.id, invite.roleId),
          eq(roles.organizationId, invite.organizationId),
          eq(roles.isActive, true),
        ),
      )
      .limit(1)

    if (!found) return null
    role = found
  }

  if (invite.type === 'shared' && role?.hasFullAccess) return null
  if (invite.type === 'shared' && role?.isDirector) return null

  const { organizationName, organizationAcronym, ...inviteData } = invite

  return {
    ...inviteData,
    type: invite.type as InviteType,
    organization: {
      legalName: organizationName,
      acronym: organizationAcronym,
    },
    role,
  }
}

export type AcceptInviteResult =
  | { status: 'accepted'; membershipId: string }
  | { status: 'already-member' }
  | { status: 'invalid' }
  | { status: 'forbidden' }
  | { status: 'account-unverified' }
  | { status: 'invalid-role' }

export async function acceptInvite(
  userId: string,
  token: string,
  database: typeof db = db,
): Promise<AcceptInviteResult> {
  const [user] = await database
    .select({
      id: users.id,
      documentNumber: users.documentNumber,
      accountId: users.accountId,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.accountId || !user.emailVerifiedAt) {
    return { status: 'account-unverified' }
  }

  const tokenHash = hashInviteToken(token)

  return database.transaction(async tx => {
    const now = new Date()

    const [invite] = await tx
      .select({
        id: invites.id,
        organizationId: invites.organizationId,
        roleId: invites.roleId,
        type: invites.type,
        documentNumber: invites.documentNumber,
        maxUses: invites.maxUses,
        usesCount: invites.usesCount,
        expiresAt: invites.expiresAt,
        revokedAt: invites.revokedAt,
      })
      .from(invites)
      .where(eq(invites.tokenHash, tokenHash))
      .limit(1)
      .for('update')

    if (
      !invite ||
      invite.revokedAt !== null ||
      invite.expiresAt.getTime() <= now.getTime()
    ) {
      return { status: 'invalid' as const }
    }

    if (
      invite.type === 'individual' &&
      normalizeDocument(invite.documentNumber ?? '') !==
        normalizeDocument(user.documentNumber)
    ) {
      return { status: 'forbidden' as const }
    }

    const [existingMembership] = await tx
      .select({ id: memberships.id, status: memberships.status })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, invite.organizationId),
          eq(memberships.userId, user.id),
        ),
      )
      .limit(1)
      .for('update')

    if (existingMembership?.status === 'active') {
      return { status: 'already-member' as const }
    }

    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
      return { status: 'invalid' as const }
    }

    let roleId = invite.roleId

    if (roleId) {
      const [role] = await tx
        .select({
          id: roles.id,
          isDirector: roles.isDirector,
          hasFullAccess: roles.hasFullAccess,
        })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, invite.organizationId),
            eq(roles.isActive, true),
          ),
        )
        .limit(1)

      if (!role) return { status: 'invalid-role' as const }

      if (invite.type === 'shared' && (role.isDirector || role.hasFullAccess)) {
        return { status: 'invalid-role' as const }
      }
    } else {
      const [defaultRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, invite.organizationId),
            eq(roles.isDefault, true),
            eq(roles.isActive, true),
          ),
        )
        .limit(1)

      if (!defaultRole) return { status: 'invalid-role' as const }

      roleId = defaultRole.id
    }

    const [consumed] = await tx
      .update(invites)
      .set({ usesCount: sql`${invites.usesCount} + 1` })
      .where(
        and(
          eq(invites.id, invite.id),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
          or(isNull(invites.maxUses), lt(invites.usesCount, invites.maxUses)),
        ),
      )
      .returning({ id: invites.id })

    if (!consumed) return { status: 'invalid' as const }

    let membershipId: string

    if (existingMembership) {
      const [reactivated] = await tx
        .update(memberships)
        .set({
          status: 'active',
          roleId,
          deactivatedAt: null,
          deactivatedByUserId: null,
          deactivationReason: null,
          updatedAt: now,
        })
        .where(eq(memberships.id, existingMembership.id))
        .returning({ id: memberships.id })

      if (!reactivated) {
        throw new Error('A reativação do vínculo não retornou um ID.')
      }

      membershipId = reactivated.id
    } else {
      const [created] = await tx
        .insert(memberships)
        .values({
          organizationId: invite.organizationId,
          userId: user.id,
          roleId,
          status: 'active',
          joinedAt: now,
        })
        .returning({ id: memberships.id })

      if (!created) {
        throw new Error('A criação do vínculo não retornou um ID.')
      }

      membershipId = created.id
    }

    await tx.insert(inviteRedemptions).values({
      inviteId: invite.id,
      userId: user.id,
      membershipId,
      redeemedAt: now,
    })

    await recordAuditEvent(tx, {
      actorUserId: user.id,
      organizationId: invite.organizationId,
      action: existingMembership
        ? 'membership.reactivated'
        : 'membership.activated',
      entityType: 'membership',
      entityId: membershipId,
      metadata: { inviteId: invite.id },
    })

    return { status: 'accepted' as const, membershipId }
  })
}

export type RevokeInviteResult =
  | { status: 'revoked' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'already-revoked' }

export async function revokeInvite(
  actorUserId: string,
  inviteId: string,
  database: typeof db = db,
): Promise<RevokeInviteResult> {
  const [invite] = await database
    .select({
      id: invites.id,
      organizationId: invites.organizationId,
      revokedAt: invites.revokedAt,
    })
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1)

  if (!invite) return { status: 'not-found' }

  const access = await getOrganizationAccess(
    actorUserId,
    invite.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.invitesManage)) {
    return { status: 'forbidden' }
  }

  if (invite.revokedAt) return { status: 'already-revoked' }

  const now = new Date()

  await database.transaction(async tx => {
    await tx
      .update(invites)
      .set({ revokedAt: now })
      .where(eq(invites.id, invite.id))

    await recordAuditEvent(tx, {
      actorUserId,
      organizationId: invite.organizationId,
      action: 'invite.revoked',
      entityType: 'invite',
      entityId: invite.id,
    })
  })

  return { status: 'revoked' }
}

export type InviteManagementData =
  | {
      status: 'ok'
      organization: {
        id: string
        legalName: string
        acronym: string
        status: 'provisioning' | 'active'
      }
      roles: Array<{
        id: string
        name: string
        isDirector: boolean
        hasFullAccess: boolean
        isDefault: boolean
      }>
      invites: Array<{
        id: string
        type: InviteType
        roleName: string | null
        documentNumber: string | null
        maxUses: number | null
        usesCount: number
        expiresAt: Date
        revokedAt: Date | null
        createdAt: Date
      }>
    }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export type InviteManagementFilter =
  | 'active'
  | 'expired'
  | 'exhausted'
  | 'revoked'

export type InviteManagementOptions = {
  status?: InviteManagementFilter
  query?: string
  limit?: number
  offset?: number
}

export async function getInviteManagementData(
  actorUserId: string,
  organizationId: string,
  options: InviteManagementOptions = {},
  database: typeof db = db,
): Promise<InviteManagementData> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.invitesManage)) {
    return { status: 'forbidden' }
  }

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

  const roleRows = await database
    .select({
      id: roles.id,
      name: roles.name,
      isDirector: roles.isDirector,
      hasFullAccess: roles.hasFullAccess,
      isDefault: roles.isDefault,
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

  const grantableRoleRows = roleRows.filter(role => {
    if (!access.hasFullAccess && role.hasFullAccess) return false

    return hasEveryPermission(
      access,
      permissionRows
        .filter(permission => permission.roleId === role.id)
        .map(permission => permission.code),
    )
  })

  const now = new Date()
  const search = options.query?.trim()
  const documentDigits = search?.replaceAll(/\D/g, '') ?? ''
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
  const offset = Math.max(options.offset ?? 0, 0)

  const statusCondition =
    options.status === 'revoked'
      ? isNotNull(invites.revokedAt)
      : options.status === 'expired'
        ? and(isNull(invites.revokedAt), lte(invites.expiresAt, now))
        : options.status === 'exhausted'
          ? and(
              isNull(invites.revokedAt),
              gt(invites.expiresAt, now),
              isNotNull(invites.maxUses),
              gte(invites.usesCount, invites.maxUses),
            )
          : options.status === 'active'
            ? and(
                isNull(invites.revokedAt),
                gt(invites.expiresAt, now),
                or(
                  isNull(invites.maxUses),
                  lt(invites.usesCount, invites.maxUses),
                ),
              )
            : undefined

  const searchCondition = search
    ? or(
        ilike(roles.name, `%${search}%`),
        ...(documentDigits
          ? [ilike(invites.documentNumber, `%${documentDigits}%`)]
          : []),
      )
    : undefined

  const inviteRows = await database
    .select({
      id: invites.id,
      type: invites.type,
      roleName: roles.name,
      documentNumber: invites.documentNumber,
      maxUses: invites.maxUses,
      usesCount: invites.usesCount,
      expiresAt: invites.expiresAt,
      revokedAt: invites.revokedAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .leftJoin(
      roles,
      and(
        eq(roles.id, invites.roleId),
        eq(roles.organizationId, invites.organizationId),
      ),
    )
    .where(
      and(
        eq(invites.organizationId, organizationId),
        statusCondition,
        searchCondition,
      ),
    )
    .orderBy(desc(invites.createdAt))
    .limit(limit)
    .offset(offset)

  return {
    status: 'ok',
    organization,
    roles: grantableRoleRows,
    invites: inviteRows.map(invite => ({
      ...invite,
      type: invite.type as InviteType,
    })),
  }
}
