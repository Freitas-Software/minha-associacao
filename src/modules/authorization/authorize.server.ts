import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import {
  memberships,
  organizations,
  platformAdmins,
  rolePermissions,
  roles,
} from '@/db/schema'
import { PERMISSION_CATALOG, type PermissionCode } from './permissions'

export type OrganizationAccess = {
  membershipId: string
  organizationId: string
  userId: string
  roleId: string
  organizationStatus: 'provisioning' | 'active'
  hasFullAccess: boolean
  permissions: ReadonlySet<PermissionCode>
}

export async function getOrganizationAccess(
  userId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<OrganizationAccess | null> {
  const [row] = await database
    .select({
      membershipId: memberships.id,
      roleId: roles.id,
      roleIsActive: roles.isActive,
      hasFullAccess: roles.hasFullAccess,
      organizationStatus: organizations.status,
    })
    .from(memberships)
    .innerJoin(
      roles,
      and(
        eq(roles.id, memberships.roleId),
        eq(roles.organizationId, memberships.organizationId),
      ),
    )
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1)

  if (!row?.roleIsActive) return null

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

  return {
    membershipId: row.membershipId,
    organizationId,
    userId,
    roleId: row.roleId,
    organizationStatus: row.organizationStatus,
    hasFullAccess: row.hasFullAccess,
    permissions,
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
  if (role.hasFullAccess) return access.hasFullAccess

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
