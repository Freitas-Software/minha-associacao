import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPermission, type OrganizationAccess } from './authorize.server'
import {
  CLOSED_ORGANIZATION_PERMISSION_CODES,
  PERMISSION_CATALOG,
  PERMISSION_CODES,
  PERMISSIONS,
} from './permissions'

function accessWith(
  overrides: Partial<OrganizationAccess>,
): OrganizationAccess {
  return {
    membershipId: 'membership',
    organizationId: 'organization',
    userId: 'user',
    roleId: 'role',
    organizationStatus: 'active',
    hasFullAccess: false,
    canGrantFullAccess: false,
    provisioningGrantId: null,
    permissions: new Set(),
    ...overrides,
  }
}

test('permission catalog has unique stable codes', () => {
  const codes = PERMISSION_CATALOG.map(item => item.code)

  assert.equal(codes.length, PERMISSION_CODES.length)
  assert.equal(new Set(codes).size, codes.length)
  assert.deepEqual([...codes].sort(), [...PERMISSION_CODES].sort())
})

test('full access grants every catalog permission', () => {
  const access = accessWith({ hasFullAccess: true })

  for (const code of PERMISSION_CODES) {
    assert.equal(hasPermission(access, code), true)
  }
})

test('closed organizations keep only read and closure permissions', () => {
  const closedPermissions = [...CLOSED_ORGANIZATION_PERMISSION_CODES]

  for (const code of closedPermissions) {
    assert.ok(PERMISSION_CODES.includes(code))
  }

  assert.ok(closedPermissions.includes(PERMISSIONS.organizationRead))
  assert.ok(closedPermissions.includes(PERMISSIONS.organizationClose))
  assert.ok(closedPermissions.includes(PERMISSIONS.auditRead))
  assert.ok(!closedPermissions.includes(PERMISSIONS.organizationUpdate))
  assert.ok(!closedPermissions.includes(PERMISSIONS.organizationActivate))
  assert.ok(!closedPermissions.includes(PERMISSIONS.rolesManage))
  assert.ok(!closedPermissions.includes(PERMISSIONS.membersManage))
  assert.ok(!closedPermissions.includes(PERMISSIONS.invitesManage))
})

test('explicit permissions grant only their own codes', () => {
  const access = accessWith({
    permissions: new Set([PERMISSIONS.rolesManage]),
  })

  assert.equal(hasPermission(access, PERMISSIONS.rolesManage), true)
  assert.equal(hasPermission(access, PERMISSIONS.membersManage), false)
})
