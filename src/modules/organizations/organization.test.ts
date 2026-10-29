import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { listAuditEvents } from '@/modules/audit/audit.server'
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
} from '@/modules/authorization/permissions'
import {
  activateOrganization,
  createOrganization,
  createRole,
  deactivateMembership,
  listAdminOrganizations,
  listAssignableRoles,
  listOrganizationMemberships,
  listPendingPreRegistrations,
  listRoles,
  updateMembershipRole,
  updateOrganization,
  updateRole,
} from './organization.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

const VALID_CNPJ = '11222333000181'

test('organization domain on PostgreSQL, using temporary tables', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const database = drizzle({ client: pool, relations: defineRelations(schema) })

  try {
    await pool.query(`
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid,
        name varchar(255) NOT NULL,
        document_number varchar(11) NOT NULL UNIQUE,
        email varchar(55) NOT NULL UNIQUE,
        email_verified_at timestamptz,
        phone varchar(11) NOT NULL UNIQUE,
        birth_date date NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE organizations (
        id uuid PRIMARY KEY,
        cnpj varchar(14) NOT NULL UNIQUE,
        legal_name varchar(255) NOT NULL,
        acronym varchar(32) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'provisioning',
        cnpj_verified_at timestamptz,
        created_by_user_id uuid NOT NULL,
        activated_at timestamptz,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE TEMP TABLE platform_admins (
        user_id uuid PRIMARY KEY,
        granted_by_user_id uuid,
        created_at timestamptz DEFAULT now() NOT NULL,
        revoked_at timestamptz
      );
      CREATE TEMP TABLE roles (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        name varchar(100) NOT NULL,
        is_director boolean DEFAULT false NOT NULL,
        has_full_access boolean DEFAULT false NOT NULL,
        is_default boolean DEFAULT false NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT roles_organization_id_name_unique UNIQUE (organization_id, name),
        CONSTRAINT roles_id_organization_id_unique UNIQUE (id, organization_id)
      );
      CREATE UNIQUE INDEX roles_organization_id_default_unique
        ON roles (organization_id) WHERE is_default and is_active;
      CREATE TEMP TABLE permissions (
        code varchar(100) PRIMARY KEY,
        description varchar(255) NOT NULL,
        category varchar(50) NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE TEMP TABLE role_permissions (
        role_id uuid NOT NULL,
        permission_code varchar(100) NOT NULL,
        PRIMARY KEY (role_id, permission_code)
      );
      CREATE TEMP TABLE memberships (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        joined_at timestamptz DEFAULT now() NOT NULL,
        deactivated_at timestamptz,
        deactivated_by_user_id uuid,
        deactivation_reason varchar(500),
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT memberships_organization_id_user_id_unique UNIQUE (organization_id, user_id)
      );
      CREATE TEMP TABLE invites (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        role_id uuid,
        type varchar(20) NOT NULL,
        document_number varchar(11),
        token_hash varchar(64) NOT NULL UNIQUE,
        max_uses integer,
        uses_count integer DEFAULT 0 NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_by_user_id uuid NOT NULL,
        created_by_membership_id uuid,
        created_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE TEMP TABLE audit_events (
        id uuid PRIMARY KEY,
        actor_user_id uuid,
        organization_id uuid,
        action varchar(100) NOT NULL,
        entity_type varchar(50) NOT NULL,
        entity_id varchar(100),
        metadata jsonb DEFAULT '{}' NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE TEMP TABLE registration_requests (
        id uuid PRIMARY KEY,
        organization_id uuid,
        role_id uuid,
        name varchar(255) NOT NULL,
        email varchar(55) NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        invalidated_at timestamptz
      )
    `)

    for (const permission of PERMISSION_CATALOG) {
      await pool.query(
        'INSERT INTO pg_temp.permissions (code, description, category) VALUES ($1, $2, $3)',
        [permission.code, permission.description, permission.category],
      )
    }

    let userCounter = 0
    let organizationCounter = 0

    async function createUser(label: string) {
      userCounter += 1
      const id = randomUUID()
      const suffix = String(userCounter).padStart(6, '0')

      await pool.query(
        `INSERT INTO pg_temp.users
          (id, name, document_number, email, phone, birth_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          label,
          `9${suffix}0000`,
          `${label}.${suffix}@example.test`,
          `119${suffix}00`,
          '1990-01-01',
        ],
      )

      return id
    }

    async function createPlatformAdmin(userId: string) {
      await pool.query(
        'INSERT INTO pg_temp.platform_admins (user_id) VALUES ($1)',
        [userId],
      )
    }

    async function createOrganizationRow(
      createdByUserId: string,
      status = 'provisioning',
    ) {
      organizationCounter += 1
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.organizations
          (id, cnpj, legal_name, acronym, status, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          String(organizationCounter).padStart(14, '0'),
          `Organization ${organizationCounter}`,
          `ORG${organizationCounter}`,
          status,
          createdByUserId,
        ],
      )

      return id
    }

    async function createRoleRow(
      organizationId: string,
      input: {
        name: string
        isDirector?: boolean
        hasFullAccess?: boolean
        isDefault?: boolean
      },
    ) {
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
          (id, organization_id, name, is_director, has_full_access, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          organizationId,
          input.name,
          input.isDirector ?? false,
          input.hasFullAccess ?? false,
          input.isDefault ?? false,
        ],
      )

      return id
    }

    async function createMembershipRow(
      organizationId: string,
      userId: string,
      roleId: string,
      status = 'active',
    ) {
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.memberships
          (id, organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, organizationId, userId, roleId, status],
      )

      return id
    }

    async function reset() {
      await pool.query(
        `TRUNCATE pg_temp.users, pg_temp.organizations, pg_temp.platform_admins,
          pg_temp.roles, pg_temp.role_permissions, pg_temp.memberships,
          pg_temp.invites, pg_temp.audit_events,
          pg_temp.registration_requests`,
      )
    }

    await t.test('creates organizations only for platform admins', async () => {
      await reset()

      const adminId = await createUser('admin')
      const outsiderId = await createUser('outsider')
      await createPlatformAdmin(adminId)

      assert.deepEqual(
        await createOrganization(
          { actorUserId: outsiderId, cnpj: VALID_CNPJ, acronym: 'ORG' },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await createOrganization(
          { actorUserId: adminId, cnpj: '11222333000180', acronym: 'ORG' },
          database,
        ),
        { status: 'invalid-cnpj' },
      )

      const fetchMock = t.mock.method(
        globalThis,
        'fetch',
        async () =>
          new Response(
            JSON.stringify({
              cnpj: VALID_CNPJ,
              razao_social: 'ASSOCIACAO TESTE',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      )

      const created = await createOrganization(
        { actorUserId: adminId, cnpj: VALID_CNPJ, acronym: 'AT' },
        database,
      )

      assert.equal(created.status, 'created')

      if (created.status !== 'created') {
        throw new Error('Expected organization creation')
      }

      const organizations = await pool.query<{
        status: string
        legal_name: string
        cnpj_verified_at: Date | null
      }>(
        'SELECT status, legal_name, cnpj_verified_at FROM pg_temp.organizations',
      )

      assert.equal(organizations.rowCount, 1)
      assert.equal(organizations.rows[0].status, 'provisioning')
      assert.equal(organizations.rows[0].legal_name, 'ASSOCIACAO TESTE')
      assert.ok(organizations.rows[0].cnpj_verified_at)

      const memberships = await pool.query('SELECT id FROM pg_temp.memberships')

      assert.equal(memberships.rowCount, 0)

      const audit = await pool.query<{ action: string }>(
        'SELECT action FROM pg_temp.audit_events',
      )

      assert.deepEqual(audit.rows, [{ action: 'organization.created' }])

      assert.deepEqual(
        await createOrganization(
          { actorUserId: adminId, cnpj: VALID_CNPJ, acronym: 'AT' },
          database,
        ),
        { status: 'duplicate-cnpj' },
      )

      fetchMock.mock.restore()
    })

    await t.test(
      'creates roles respecting permissions and defaults',
      async () => {
        await reset()

        const adminId = await createUser('admin')
        const presidentId = await createUser('president')
        const organizationId = await createOrganizationRow(adminId)
        const fullAccessRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        await createMembershipRow(organizationId, presidentId, fullAccessRoleId)

        assert.deepEqual(
          await createRole(
            {
              actorUserId: adminId,
              organizationId,
              role: {
                name: 'Secretario',
                isDirector: false,
                hasFullAccess: false,
                isDefault: false,
                permissionCodes: [PERMISSIONS.membersRead],
              },
            },
            database,
          ),
          { status: 'forbidden' },
        )

        const defaultRole = await createRole(
          {
            actorUserId: presidentId,
            organizationId,
            role: {
              name: 'Associado',
              isDirector: false,
              hasFullAccess: false,
              isDefault: true,
              permissionCodes: [PERMISSIONS.membersRead],
            },
          },
          database,
        )

        assert.equal(defaultRole.status, 'created')

        assert.deepEqual(
          await createRole(
            {
              actorUserId: presidentId,
              organizationId,
              role: {
                name: 'Associado 2',
                isDirector: false,
                hasFullAccess: false,
                isDefault: true,
                permissionCodes: [],
              },
            },
            database,
          ),
          { status: 'default-role-exists' },
        )

        const directorRole = await createRole(
          {
            actorUserId: presidentId,
            organizationId,
            role: {
              name: 'Diretor',
              isDirector: true,
              hasFullAccess: false,
              isDefault: false,
              permissionCodes: [],
            },
          },
          database,
        )

        assert.equal(directorRole.status, 'created')

        const duplicateName = await createRole(
          {
            actorUserId: presidentId,
            organizationId,
            role: {
              name: 'Diretor',
              isDirector: false,
              hasFullAccess: false,
              isDefault: false,
              permissionCodes: [],
            },
          },
          database,
        )

        assert.deepEqual(duplicateName, { status: 'role-name-exists' })

        const rolePermissions = await pool.query<{ permission_code: string }>(
          'SELECT permission_code FROM pg_temp.role_permissions',
        )

        assert.deepEqual(rolePermissions.rows, [
          { permission_code: PERMISSIONS.membersRead },
        ])
      },
    )

    await t.test('prevents granting authority beyond the actor', async () => {
      await reset()

      const presidentId = await createUser('president')
      const managerId = await createUser('manager')
      const memberId = await createUser('member')
      const organizationId = await createOrganizationRow(presidentId)
      const presidentRoleId = await createRoleRow(organizationId, {
        name: 'Presidente',
        hasFullAccess: true,
      })
      const associateRoleId = await createRoleRow(organizationId, {
        name: 'Associado',
        isDefault: true,
      })
      const managerRoleId = await createRoleRow(organizationId, {
        name: 'Gestor',
      })

      await pool.query(
        `INSERT INTO pg_temp.role_permissions (role_id, permission_code)
           VALUES ($1, $2), ($1, $3)`,
        [managerRoleId, PERMISSIONS.rolesManage, PERMISSIONS.membersManage],
      )

      await createMembershipRow(organizationId, presidentId, presidentRoleId)
      await createMembershipRow(organizationId, managerId, managerRoleId)
      const memberMembershipId = await createMembershipRow(
        organizationId,
        memberId,
        associateRoleId,
      )

      assert.deepEqual(
        await createRole(
          {
            actorUserId: managerId,
            organizationId,
            role: {
              name: 'Vice-presidente',
              isDirector: false,
              hasFullAccess: true,
              isDefault: false,
              permissionCodes: [],
            },
          },
          database,
        ),
        { status: 'full-access-not-allowed' },
      )

      assert.deepEqual(
        await createRole(
          {
            actorUserId: managerId,
            organizationId,
            role: {
              name: 'Auditor',
              isDirector: false,
              hasFullAccess: false,
              isDefault: false,
              permissionCodes: [PERMISSIONS.auditRead],
            },
          },
          database,
        ),
        { status: 'permission-not-allowed' },
      )

      const managerCreatedRole = await createRole(
        {
          actorUserId: managerId,
          organizationId,
          role: {
            name: 'Apoio',
            isDirector: false,
            hasFullAccess: false,
            isDefault: false,
            permissionCodes: [PERMISSIONS.rolesManage],
          },
        },
        database,
      )

      assert.equal(managerCreatedRole.status, 'created')

      if (managerCreatedRole.status !== 'created') {
        throw new Error('Expected role creation')
      }

      assert.deepEqual(
        await updateRole(
          {
            actorUserId: managerId,
            organizationId,
            roleId: presidentRoleId,
            role: {
              name: 'Presidente',
              isDirector: false,
              hasFullAccess: true,
              isDefault: false,
              isActive: true,
              permissionCodes: [],
            },
          },
          database,
        ),
        { status: 'full-access-not-allowed' },
      )

      const auditorRole = await createRole(
        {
          actorUserId: presidentId,
          organizationId,
          role: {
            name: 'Auditor',
            isDirector: false,
            hasFullAccess: false,
            isDefault: false,
            permissionCodes: [PERMISSIONS.auditRead],
          },
        },
        database,
      )

      assert.equal(auditorRole.status, 'created')

      if (auditorRole.status !== 'created') {
        throw new Error('Expected role creation')
      }

      assert.deepEqual(
        await updateRole(
          {
            actorUserId: managerId,
            organizationId,
            roleId: auditorRole.roleId,
            role: {
              name: 'Auditor',
              isDirector: false,
              hasFullAccess: false,
              isDefault: false,
              isActive: true,
              permissionCodes: [PERMISSIONS.auditRead],
            },
          },
          database,
        ),
        { status: 'permission-not-allowed' },
      )

      assert.deepEqual(
        await updateMembershipRole(
          {
            actorUserId: managerId,
            membershipId: memberMembershipId,
            roleId: auditorRole.roleId,
          },
          database,
        ),
        { status: 'role-not-allowed' },
      )

      const assignable = await listAssignableRoles(
        managerId,
        organizationId,
        database,
      )

      assert.equal(assignable.status, 'ok')

      if (assignable.status !== 'ok') throw new Error('Expected roles')

      assert.deepEqual(assignable.roles.map(role => role.name).sort(), [
        'Apoio',
        'Associado',
        'Gestor',
      ])
    })

    await t.test(
      'activates the organization only with valid invariants',
      async () => {
        await reset()

        const adminId = await createUser('admin')
        const presidentId = await createUser('president')
        const organizationId = await createOrganizationRow(adminId)
        const fullAccessRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        await createMembershipRow(organizationId, presidentId, fullAccessRoleId)

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'missing-default-role' },
        )

        await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })

        const activated = await activateOrganization(
          presidentId,
          organizationId,
          database,
        )

        assert.deepEqual(activated, { status: 'activated' })

        const organizations = await pool.query<{ status: string }>(
          'SELECT status FROM pg_temp.organizations',
        )

        assert.equal(organizations.rows[0].status, 'active')

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'already-active' },
        )
      },
    )

    await t.test(
      'accepts a valid individual invite for a director role at activation',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const organizationId = await createOrganizationRow(presidentId)
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })
        await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })
        const directorRoleId = await createRoleRow(organizationId, {
          name: 'Tesoureiro',
          isDirector: true,
        })

        await createMembershipRow(organizationId, presidentId, presidentRoleId)

        async function insertDirectorInvite(input: {
          expiresAt: string
          revoked?: boolean
          usesCount?: number
        }) {
          await pool.query(
            `INSERT INTO pg_temp.invites
              (id, organization_id, role_id, type, document_number, token_hash,
               max_uses, uses_count, expires_at, revoked_at, created_by_user_id)
             VALUES ($1, $2, $3, 'individual', '12345678901', $4, 1, $5,
               now() + $6::interval,
               case when $7 then now() else null end, $8)`,
            [
              randomUUID(),
              organizationId,
              directorRoleId,
              `token-${randomUUID()}`,
              input.usesCount ?? 0,
              input.expiresAt,
              input.revoked ?? false,
              presidentId,
            ],
          )
        }

        await insertDirectorInvite({ expiresAt: '1 day', revoked: true })

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'missing-director-occupant' },
        )

        await pool.query('DELETE FROM pg_temp.invites')

        await insertDirectorInvite({ expiresAt: '1 day' })

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'activated' },
        )

        await reset()

        const secondPresidentId = await createUser('second-president')
        const secondOrganizationId =
          await createOrganizationRow(secondPresidentId)
        const secondPresidentRoleId = await createRoleRow(
          secondOrganizationId,
          {
            name: 'Presidente',
            hasFullAccess: true,
          },
        )
        await createRoleRow(secondOrganizationId, {
          name: 'Associado',
          isDefault: true,
        })
        const secondDirectorRoleId = await createRoleRow(secondOrganizationId, {
          name: 'Tesoureiro',
          isDirector: true,
        })
        await createMembershipRow(
          secondOrganizationId,
          secondPresidentId,
          secondPresidentRoleId,
        )

        await pool.query(
          `INSERT INTO pg_temp.invites
            (id, organization_id, role_id, type, document_number, token_hash,
             max_uses, uses_count, expires_at, created_by_user_id)
           VALUES ($1, $2, $3, 'individual', '12345678901', $4, 1, 0,
             now() - interval '1 day', $5)`,
          [
            randomUUID(),
            secondOrganizationId,
            secondDirectorRoleId,
            `token-${randomUUID()}`,
            secondPresidentId,
          ],
        )

        assert.deepEqual(
          await activateOrganization(
            secondPresidentId,
            secondOrganizationId,
            database,
          ),
          { status: 'missing-director-occupant' },
        )
      },
    )

    await t.test('blocks removing the last full-access member', async () => {
      await reset()

      const adminId = await createUser('admin')
      const presidentId = await createUser('president')
      const otherId = await createUser('other')
      const organizationId = await createOrganizationRow(adminId, 'active')
      const fullAccessRoleId = await createRoleRow(organizationId, {
        name: 'Presidente',
        hasFullAccess: true,
      })
      const presidentMembershipId = await createMembershipRow(
        organizationId,
        presidentId,
        fullAccessRoleId,
      )
      const otherMembershipId = await createMembershipRow(
        organizationId,
        otherId,
        fullAccessRoleId,
      )

      assert.deepEqual(
        await deactivateMembership(
          {
            actorUserId: adminId,
            membershipId: otherMembershipId,
            reason: 'Not authorized',
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await deactivateMembership(
          {
            actorUserId: presidentId,
            membershipId: otherMembershipId,
            reason: 'Requested removal',
          },
          database,
        ),
        { status: 'deactivated' },
      )

      assert.deepEqual(
        await deactivateMembership(
          {
            actorUserId: presidentId,
            membershipId: presidentMembershipId,
            reason: 'Requested removal',
          },
          database,
        ),
        { status: 'last-full-access-member' },
      )

      const audit = await pool.query<{ action: string }>(
        "SELECT action FROM pg_temp.audit_events WHERE action = 'membership.deactivated'",
      )

      assert.equal(audit.rowCount, 1)
    })
    await t.test(
      'updates the organization acronym with permission',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const outsiderId = await createUser('outsider')
        const organizationId = await createOrganizationRow(presidentId)
        const fullAccessRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        await createMembershipRow(organizationId, presidentId, fullAccessRoleId)

        assert.deepEqual(
          await updateOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              data: { acronym: 'NOVA' },
            },
            database,
          ),
          { status: 'updated' },
        )

        const organization = await pool.query<{ acronym: string }>(
          'SELECT acronym FROM pg_temp.organizations WHERE id = $1',
          [organizationId],
        )

        assert.equal(organization.rows[0].acronym, 'NOVA')

        const audit = await pool.query<{ action: string }>(
          "SELECT action FROM pg_temp.audit_events WHERE action = 'organization.updated'",
        )

        assert.equal(audit.rowCount, 1)

        assert.deepEqual(
          await updateOrganization(
            {
              actorUserId: outsiderId,
              organizationId,
              data: { acronym: 'OUTRA' },
            },
            database,
          ),
          { status: 'forbidden' },
        )
      },
    )
    await t.test(
      'lists audit events with permission and newest first',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const outsiderId = await createUser('outsider')
        const organizationId = await createOrganizationRow(presidentId)
        const fullAccessRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        await createMembershipRow(organizationId, presidentId, fullAccessRoleId)

        const older = new Date(Date.now() - 60_000)
        const newer = new Date()

        await pool.query(
          `INSERT INTO pg_temp.audit_events
          (id, actor_user_id, organization_id, action, entity_type, entity_id, metadata, created_at)
         VALUES
          ($1, $2, $3, 'organization.created', 'organization', $4, '{}', $5),
          ($6, $2, $3, 'role.created', 'role', $7, $8, $9)`,
          [
            randomUUID(),
            presidentId,
            organizationId,
            organizationId,
            older,
            randomUUID(),
            fullAccessRoleId,
            JSON.stringify({ name: 'Presidente', hasFullAccess: true }),
            newer,
          ],
        )

        const result = await listAuditEvents(
          presidentId,
          organizationId,
          { limit: 10 },
          database,
        )

        assert.equal(result.status, 'ok')

        if (result.status !== 'ok') throw new Error('Expected audit events')

        assert.deepEqual(
          result.events.map(event => event.action),
          ['role.created', 'organization.created'],
        )
        assert.equal(result.events[0].actorName, 'president')
        assert.deepEqual(result.events[0].metadata, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        const filtered = await listAuditEvents(
          presidentId,
          organizationId,
          { action: 'role.created' },
          database,
        )

        assert.equal(filtered.status, 'ok')

        if (filtered.status !== 'ok') throw new Error('Expected audit events')

        assert.equal(filtered.events.length, 1)

        const firstPage = await listAuditEvents(
          presidentId,
          organizationId,
          { limit: 1 },
          database,
        )

        assert.equal(firstPage.status, 'ok')

        if (firstPage.status !== 'ok') throw new Error('Expected audit events')

        assert.equal(firstPage.events.length, 1)

        const secondPage = await listAuditEvents(
          presidentId,
          organizationId,
          { limit: 1, offset: 1 },
          database,
        )

        assert.equal(secondPage.status, 'ok')

        if (secondPage.status !== 'ok') throw new Error('Expected audit events')

        assert.equal(secondPage.events.length, 1)

        assert.deepEqual(
          await listAuditEvents(
            outsiderId,
            organizationId,
            { limit: 10 },
            database,
          ),
          { status: 'forbidden' },
        )
      },
    )
    await t.test('changes membership roles with guards', async () => {
      await reset()

      const presidentId = await createUser('president')
      const memberId = await createUser('member')
      const organizationId = await createOrganizationRow(presidentId)
      const presidentRoleId = await createRoleRow(organizationId, {
        name: 'Presidente',
        hasFullAccess: true,
      })
      const associateRoleId = await createRoleRow(organizationId, {
        name: 'Associado',
        isDefault: true,
      })
      const treasurerRoleId = await createRoleRow(organizationId, {
        name: 'Tesoureiro',
      })

      await createMembershipRow(organizationId, presidentId, presidentRoleId)
      const memberMembershipId = await createMembershipRow(
        organizationId,
        memberId,
        associateRoleId,
      )

      const assignable = await listAssignableRoles(
        presidentId,
        organizationId,
        database,
      )

      assert.equal(assignable.status, 'ok')

      if (assignable.status !== 'ok') throw new Error('Expected roles')

      assert.deepEqual(
        assignable.roles.map(role => role.name),
        ['Associado', 'Presidente', 'Tesoureiro'],
      )

      assert.deepEqual(
        await updateMembershipRole(
          {
            actorUserId: presidentId,
            membershipId: memberMembershipId,
            roleId: treasurerRoleId,
          },
          database,
        ),
        { status: 'updated' },
      )

      const membership = await pool.query<{ role_id: string }>(
        'SELECT role_id FROM pg_temp.memberships WHERE id = $1',
        [memberMembershipId],
      )

      assert.equal(membership.rows[0].role_id, treasurerRoleId)

      const audit = await pool.query<{ action: string }>(
        "SELECT action FROM pg_temp.audit_events WHERE action = 'membership.role_changed'",
      )

      assert.equal(audit.rowCount, 1)

      const managerRoleId = await createRoleRow(organizationId, {
        name: 'Gestor',
      })
      const managerId = await createUser('manager')

      await createMembershipRow(organizationId, managerId, managerRoleId)
      await pool.query(
        `INSERT INTO pg_temp.role_permissions (role_id, permission_code)
         VALUES ($1, 'members.manage')`,
        [managerRoleId],
      )

      assert.deepEqual(
        await updateMembershipRole(
          {
            actorUserId: managerId,
            membershipId: memberMembershipId,
            roleId: presidentRoleId,
          },
          database,
        ),
        { status: 'role-not-allowed' },
      )

      const presidentMembership = await pool.query<{ id: string }>(
        'SELECT id FROM pg_temp.memberships WHERE user_id = $1',
        [presidentId],
      )

      assert.deepEqual(
        await updateMembershipRole(
          {
            actorUserId: presidentId,
            membershipId: presidentMembership.rows[0].id,
            roleId: associateRoleId,
          },
          database,
        ),
        { status: 'last-full-access-member' },
      )

      assert.deepEqual(
        await updateMembershipRole(
          {
            actorUserId: memberId,
            membershipId: presidentMembership.rows[0].id,
            roleId: associateRoleId,
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await listAssignableRoles(memberId, organizationId, database),
        { status: 'forbidden' },
      )
    })
    await t.test(
      'lists pending pre-registrations with permission',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const outsiderId = await createUser('outsider')
        const organizationId = await createOrganizationRow(presidentId)
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })
        const associateRoleId = await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })

        await createMembershipRow(organizationId, presidentId, presidentRoleId)

        const future = new Date(Date.now() + 60 * 60 * 1000)

        await pool.query(
          `INSERT INTO pg_temp.registration_requests
          (id, organization_id, role_id, name, email, expires_at, consumed_at, invalidated_at)
         VALUES
          ($1, $2, $3, 'Pendente', 'pendente@example.test', $4, NULL, NULL),
          ($5, $2, $3, 'Consumida', 'consumida@example.test', $4, now(), NULL),
          ($6, $2, $3, 'Invalidada', 'invalidada@example.test', $4, NULL, now())`,
          [
            randomUUID(),
            organizationId,
            associateRoleId,
            future,
            randomUUID(),
            randomUUID(),
          ],
        )

        const result = await listPendingPreRegistrations(
          presidentId,
          organizationId,
          database,
        )

        assert.equal(result.status, 'ok')

        if (result.status !== 'ok') throw new Error('Expected requests')

        assert.equal(result.requests.length, 1)
        assert.equal(result.requests[0].name, 'Pendente')
        assert.equal(result.requests[0].email, 'pendente@example.test')
        assert.equal(result.requests[0].roleName, 'Associado')
        assert.deepEqual(result.requests[0].expiresAt, future)

        assert.deepEqual(
          await listPendingPreRegistrations(
            outsiderId,
            organizationId,
            database,
          ),
          { status: 'forbidden' },
        )
      },
    )
    await t.test(
      'does not grant platform admins organization authority',
      async () => {
        await reset()

        const adminId = await createUser('admin')
        const presidentId = await createUser('president')
        await createPlatformAdmin(adminId)

        const organizationId = await createOrganizationRow(presidentId)
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          isDirector: true,
          hasFullAccess: true,
        })
        const associateRoleId = await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })
        const membershipId = await createMembershipRow(
          organizationId,
          presidentId,
          presidentRoleId,
        )

        assert.deepEqual(
          await updateOrganization(
            { actorUserId: adminId, organizationId, data: { acronym: 'NOVA' } },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await createRole(
            {
              actorUserId: adminId,
              organizationId,
              role: {
                name: 'Tesoureiro',
                isDirector: false,
                hasFullAccess: false,
                isDefault: false,
                permissionCodes: [],
              },
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await updateRole(
            {
              actorUserId: adminId,
              organizationId,
              roleId: associateRoleId,
              role: {
                name: 'Associado renomeado',
                isDirector: false,
                hasFullAccess: false,
                isDefault: true,
                isActive: true,
                permissionCodes: [],
              },
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await activateOrganization(adminId, organizationId, database),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await deactivateMembership(
            {
              actorUserId: adminId,
              membershipId,
              reason: 'Intervenção indevida',
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await updateMembershipRole(
            { actorUserId: adminId, membershipId, roleId: associateRoleId },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await listOrganizationMemberships(
            adminId,
            organizationId,
            {},
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await listAssignableRoles(adminId, organizationId, database),
          { status: 'forbidden' },
        )

        assert.deepEqual(await listRoles(adminId, organizationId, database), {
          status: 'forbidden',
        })

        assert.deepEqual(
          await listPendingPreRegistrations(adminId, organizationId, database),
          { status: 'forbidden' },
        )

        const [state] = (
          await pool.query<{
            acronym: string
            organization_status: string
            role_name: string
            membership_status: string
            membership_role_id: string
          }>(
            `SELECT o.acronym, o.status AS organization_status,
              r.name AS role_name, m.status AS membership_status,
              m.role_id AS membership_role_id
             FROM pg_temp.organizations o
             JOIN pg_temp.roles r ON r.id = $2
             JOIN pg_temp.memberships m ON m.id = $3
             WHERE o.id = $1`,
            [organizationId, associateRoleId, membershipId],
          )
        ).rows

        assert.notEqual(state?.acronym, 'NOVA')
        assert.equal(state?.organization_status, 'provisioning')
        assert.notEqual(state?.role_name, 'Associado renomeado')
        assert.equal(state?.membership_status, 'active')
        assert.equal(state?.membership_role_id, presidentRoleId)

        const audit = await pool.query(
          'SELECT action FROM pg_temp.audit_events',
        )

        assert.equal(audit.rowCount, 0)
      },
    )
    await t.test(
      'lists organizations for platform admins with filters',
      async () => {
        await reset()

        const adminId = await createUser('admin')
        const outsiderId = await createUser('outsider')

        await createPlatformAdmin(adminId)
        await createOrganizationRow(adminId, 'provisioning')
        await createOrganizationRow(adminId, 'active')

        const all = await listAdminOrganizations(adminId, {}, database)

        assert.equal(all.status, 'ok')

        if (all.status !== 'ok') throw new Error('Expected organizations')

        assert.equal(all.organizations.length, 2)

        const active = await listAdminOrganizations(
          adminId,
          { status: 'active' },
          database,
        )

        assert.equal(active.status, 'ok')

        if (active.status !== 'ok') throw new Error('Expected organizations')

        assert.equal(active.organizations.length, 1)
        assert.equal(active.organizations[0].status, 'active')

        const firstPage = await listAdminOrganizations(
          adminId,
          { limit: 1 },
          database,
        )

        assert.equal(firstPage.status, 'ok')

        if (firstPage.status !== 'ok') throw new Error('Expected organizations')

        assert.equal(firstPage.organizations.length, 1)

        const secondPage = await listAdminOrganizations(
          adminId,
          { limit: 1, offset: 1 },
          database,
        )

        assert.equal(secondPage.status, 'ok')

        if (secondPage.status !== 'ok')
          throw new Error('Expected organizations')

        assert.equal(secondPage.organizations.length, 1)

        assert.deepEqual(
          await listAdminOrganizations(outsiderId, {}, database),
          { status: 'forbidden' },
        )
      },
    )
    await t.test('searches and paginates organization members', async () => {
      await reset()

      const presidentId = await createUser('president')
      const aliceId = await createUser('Alice')
      const bobId = await createUser('Bob')
      const outsiderId = await createUser('outsider')
      const organizationId = await createOrganizationRow(presidentId)
      const presidentRoleId = await createRoleRow(organizationId, {
        name: 'Presidente',
        hasFullAccess: true,
      })
      const memberRoleId = await createRoleRow(organizationId, {
        name: 'Associado',
        isDefault: true,
      })

      await createMembershipRow(organizationId, presidentId, presidentRoleId)
      await createMembershipRow(organizationId, aliceId, memberRoleId)
      await createMembershipRow(organizationId, bobId, memberRoleId)

      const search = await listOrganizationMemberships(
        presidentId,
        organizationId,
        { query: 'Alice' },
        database,
      )

      assert.equal(search.status, 'ok')

      if (search.status !== 'ok') throw new Error('Expected memberships')

      assert.equal(search.memberships.length, 1)
      assert.equal(search.memberships[0].name, 'Alice')

      const firstPage = await listOrganizationMemberships(
        presidentId,
        organizationId,
        { limit: 1 },
        database,
      )

      assert.equal(firstPage.status, 'ok')

      if (firstPage.status !== 'ok') throw new Error('Expected memberships')

      assert.equal(firstPage.memberships.length, 1)

      const secondPage = await listOrganizationMemberships(
        presidentId,
        organizationId,
        { limit: 1, offset: 1 },
        database,
      )

      assert.equal(secondPage.status, 'ok')

      if (secondPage.status !== 'ok') throw new Error('Expected memberships')

      assert.equal(secondPage.memberships.length, 1)

      assert.deepEqual(
        await listOrganizationMemberships(
          outsiderId,
          organizationId,
          {},
          database,
        ),
        { status: 'forbidden' },
      )
    })
  } finally {
    await pool.end()
  }
})
