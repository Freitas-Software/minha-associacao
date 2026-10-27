export const PERMISSIONS = {
  organizationRead: 'organization.read',
  organizationUpdate: 'organization.update',
  organizationActivate: 'organization.activate',
  rolesRead: 'roles.read',
  rolesManage: 'roles.manage',
  membersRead: 'members.read',
  membersManage: 'members.manage',
  invitesManage: 'invites.manage',
  auditRead: 'audit.read',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const PERMISSION_CODES = [
  PERMISSIONS.organizationRead,
  PERMISSIONS.organizationUpdate,
  PERMISSIONS.organizationActivate,
  PERMISSIONS.rolesRead,
  PERMISSIONS.rolesManage,
  PERMISSIONS.membersRead,
  PERMISSIONS.membersManage,
  PERMISSIONS.invitesManage,
  PERMISSIONS.auditRead,
] as const satisfies readonly PermissionCode[]

export const PERMISSION_CATALOG: ReadonlyArray<{
  code: PermissionCode
  description: string
  category: string
}> = [
  {
    code: PERMISSIONS.organizationRead,
    description: 'View organization data',
    category: 'organization',
  },
  {
    code: PERMISSIONS.organizationUpdate,
    description: 'Edit organization data',
    category: 'organization',
  },
  {
    code: PERMISSIONS.organizationActivate,
    description: 'Activate the organization',
    category: 'organization',
  },
  {
    code: PERMISSIONS.rolesRead,
    description: 'View roles and permissions',
    category: 'roles',
  },
  {
    code: PERMISSIONS.rolesManage,
    description: 'Create, update and deactivate roles',
    category: 'roles',
  },
  {
    code: PERMISSIONS.membersRead,
    description: 'View memberships',
    category: 'members',
  },
  {
    code: PERMISSIONS.membersManage,
    description: 'Deactivate and reactivate memberships',
    category: 'members',
  },
  {
    code: PERMISSIONS.invitesManage,
    description: 'Create and revoke invitations',
    category: 'invites',
  },
  {
    code: PERMISSIONS.auditRead,
    description: 'View audit events',
    category: 'audit',
  },
]
