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
    description: 'Ver dados da organização',
    category: 'organization',
  },
  {
    code: PERMISSIONS.organizationUpdate,
    description: 'Editar dados da organização',
    category: 'organization',
  },
  {
    code: PERMISSIONS.organizationActivate,
    description: 'Ativar a organização',
    category: 'organization',
  },
  {
    code: PERMISSIONS.rolesRead,
    description: 'Ver cargos e permissões',
    category: 'roles',
  },
  {
    code: PERMISSIONS.rolesManage,
    description: 'Criar, editar e desativar cargos',
    category: 'roles',
  },
  {
    code: PERMISSIONS.membersRead,
    description: 'Ver vínculos de membros',
    category: 'members',
  },
  {
    code: PERMISSIONS.membersManage,
    description: 'Desativar e reativar vínculos de membros',
    category: 'members',
  },
  {
    code: PERMISSIONS.invitesManage,
    description: 'Criar e revogar convites',
    category: 'invites',
  },
  {
    code: PERMISSIONS.auditRead,
    description: 'Ver registros de auditoria',
    category: 'audit',
  },
]
