import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import {
  memberships,
  organizations,
  platformAdmins,
  provisioningGrants,
  rolePermissions,
  roles,
} from '@/db/schema'
import {
  CLOSED_ORGANIZATION_PERMISSION_CODES,
  PERMISSION_CATALOG,
  type PermissionCode,
} from './permissions'

export type OrganizationAccess = {
  membershipId: string | null
  provisioningGrantId: string | null
  organizationId: string
  userId: string
  roleId: string | null
  organizationStatus: 'provisioning' | 'active' | 'closed'
  hasFullAccess: boolean
  canGrantFullAccess: boolean
  permissions: ReadonlySet<PermissionCode>
}

export async function getOrganizationAccess(
  userId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<OrganizationAccess | null> {
  const [organization] = await database
    .select({ status: organizations.status })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!organization) return null

  const [row] = await database
    .select({
      membershipId: memberships.id,
      roleId: roles.id,
      roleIsActive: roles.isActive,
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
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1)

  if (row?.roleIsActive) {
    let permissions: Set<PermissionCode>

    if (row.hasFullAccess) {
      permissions = new Set(PERMISSION_CATALOG.map(item => item.code))
    } else {
      const rows = await database
        .select({ code: rolePermissions.permissionCode })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, row.roleId))

      permissions = new Set(rows.map(item => item.code as PermissionCode))
    }

    const isClosed = organization.status === 'closed'

    return {
      membershipId: row.membershipId,
      provisioningGrantId: null,
      organizationId,
      userId,
      roleId: row.roleId,
      organizationStatus: organization.status,
      hasFullAccess: isClosed ? false : row.hasFullAccess,
      canGrantFullAccess: isClosed ? false : row.hasFullAccess,
      permissions: isClosed
        ? new Set(
            [...permissions].filter(code =>
              CLOSED_ORGANIZATION_PERMISSION_CODES.has(code),
            ),
          )
        : permissions,
    }
  }

  if (organization.status !== 'provisioning') return null

  const [grant] = await database
    .select({ id: provisioningGrants.id })
    .from(provisioningGrants)
    .where(
      and(
        eq(provisioningGrants.organizationId, organizationId),
        eq(provisioningGrants.userId, userId),
        isNull(provisioningGrants.revokedAt),
      ),
    )
    .limit(1)

  if (!grant) return null

  return {
    membershipId: null,
    provisioningGrantId: grant.id,
    organizationId,
    userId,
    roleId: null,
    organizationStatus: organization.status,
    hasFullAccess: false,
    canGrantFullAccess: true,
    permissions: new Set(PERMISSION_CATALOG.map(item => item.code)),
  }
}

export function hasPermission(
  access: OrganizationAccess,
  permission: PermissionCode,
): boolean {
  return access.hasFullAccess || access.permissions.has(permission)
}

export function hasEveryPermission(
  access: OrganizationAccess,
  permissions: readonly string[],
): boolean {
  return (
    access.hasFullAccess ||
    permissions.every(permission =>
      access.permissions.has(permission as PermissionCode),
    )
  )
}

type RoleAuthorityDatabase = Pick<typeof db, 'select'>

export async function canGrantRole(
  access: OrganizationAccess,
  role: { id: string; hasFullAccess: boolean },
  database: RoleAuthorityDatabase = db,
): Promise<boolean> {
  if (role.hasFullAccess) return access.canGrantFullAccess

  const permissions = await database
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, role.id))

  return hasEveryPermission(
    access,
    permissions.map(permission => permission.code),
  )
}

export async function isPlatformAdmin(
  userId: string,
  database: typeof db = db,
): Promise<boolean> {
  const [row] = await database
    .select({ userId: platformAdmins.userId })
    .from(platformAdmins)
    .where(
      and(eq(platformAdmins.userId, userId), isNull(platformAdmins.revokedAt)),
    )
    .limit(1)

  return Boolean(row)
}
