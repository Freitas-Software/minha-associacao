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
  createInvite,
  getInviteManagementData,
  resendInvite,
  revokeInvite,
} from '@/modules/invites/invite.server'
import {
  activateOrganization,
  closeOrganization,
  createOrganization,
  createRole,
  deactivateMembership,
  getOrganizationSummary,
  listAdminOrganizations,
  listAssignableRoles,
  listOrganizationMemberships,
  listPendingPreRegistrations,
  listRoles,
  listUserOrganizations,
  reopenOrganization,
  updateMembershipRole,
  updateOrganization,
  updateRole,
} from './organization.server'
import {
  listOrganizationDocuments,
  uploadOrganizationDocument,
} from './organization-document.server'
import { createPreRegistrationLink } from './pre-registration.server'

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
        closed_at timestamptz,
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
      CREATE TEMP TABLE provisioning_grants (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        user_id uuid NOT NULL,
        created_by_user_id uuid NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL,
        revoked_at timestamptz
      );
      CREATE TEMP TABLE organization_documents (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        type varchar(20) NOT NULL,
        storage_key text NOT NULL,
        uploaded_by_user_id uuid NOT NULL,
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

    async function getDocument(userId: string) {
      const result = await pool.query<{ document_number: string }>(
        'SELECT document_number FROM pg_temp.users WHERE id = $1',
        [userId],
      )

      return result.rows[0].document_number
    }

    async function insertRequiredDocuments(
      organizationId: string,
      uploadedByUserId: string,
    ) {
      await pool.query(
        `INSERT INTO pg_temp.organization_documents
          (id, organization_id, type, storage_key, uploaded_by_user_id)
         VALUES
          ($1, $2, 'statute', 'organizations/test/statute.pdf', $3),
          ($4, $2, 'election_minutes', 'organizations/test/minutes.pdf', $3)`,
        [randomUUID(), organizationId, uploadedByUserId, randomUUID()],
      )
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
          pg_temp.invites, pg_temp.provisioning_grants,
          pg_temp.organization_documents, pg_temp.audit_events,
          pg_temp.registration_requests`,
      )
    }

    await t.test('creates organizations only for platform admins', async () => {
      await reset()

      const adminId = await createUser('admin')
      const outsiderId = await createUser('outsider')
      const granteeId = await createUser('grantee')
      await pool.query(
        "UPDATE pg_temp.users SET document_number = '52998224725' WHERE id = $1",
        [granteeId],
      )
      const granteeDocument = await getDocument(granteeId)
      await createPlatformAdmin(adminId)

      assert.deepEqual(
        await createOrganization(
          {
            actorUserId: outsiderId,
            cnpj: VALID_CNPJ,
            acronym: 'ORG',
            granteeDocumentNumber: granteeDocument,
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await createOrganization(
          {
            actorUserId: adminId,
            cnpj: '11222333000180',
            acronym: 'ORG',
            granteeDocumentNumber: granteeDocument,
          },
          database,
        ),
        { status: 'invalid-cnpj' },
      )

      assert.deepEqual(
        await createOrganization(
          {
            actorUserId: adminId,
            cnpj: VALID_CNPJ,
            acronym: 'ORG',
            granteeDocumentNumber: '11144477735',
          },
          database,
        ),
        { status: 'grantee-not-found' },
      )

      const fetchMock = t.mock.method(
        globalThis,
        'fetch',
        async () =>
          new Response(
            JSON.stringify({
              cnpj: VALID_CNPJ,
              razao_social: 'ASSOCIACAO TESTE',
              cnae_fiscal: 9430800,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      )

      const created = await createOrganization(
        {
          actorUserId: adminId,
          cnpj: VALID_CNPJ,
          acronym: 'AT',
          granteeDocumentNumber: granteeDocument,
        },
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

      const grants = await pool.query<{
        user_id: string
        revoked_at: Date | null
      }>('SELECT user_id, revoked_at FROM pg_temp.provisioning_grants')

      assert.deepEqual(grants.rows, [{ user_id: granteeId, revoked_at: null }])

      const audit = await pool.query<{ action: string }>(
        'SELECT action FROM pg_temp.audit_events ORDER BY action',
      )

      assert.deepEqual(audit.rows, [
        { action: 'platform.organization_created' },
        { action: 'platform.provisioning_grant_created' },
      ])

      assert.deepEqual(
        await createOrganization(
          {
            actorUserId: adminId,
            cnpj: VALID_CNPJ,
            acronym: 'AT',
            granteeDocumentNumber: granteeDocument,
          },
          database,
        ),
        { status: 'duplicate-cnpj' },
      )

      fetchMock.mock.restore()
    })

    await t.test(
      'grants temporary provisioning access until activation',
      async () => {
        await reset()

        const adminId = await createUser('admin')
        const granteeId = await createUser('grantee')
        const presidentId = await createUser('president')
        const organizationId = await createOrganizationRow(adminId)

        await pool.query(
          `INSERT INTO pg_temp.provisioning_grants
            (id, organization_id, user_id, created_by_user_id)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), organizationId, granteeId, adminId],
        )

        const summary = await getOrganizationSummary(
          granteeId,
          organizationId,
          database,
        )

        assert.equal(summary.status, 'ok')

        if (summary.status !== 'ok') throw new Error('Expected access')

        assert.equal(summary.access.hasFullAccess, false)
        assert.equal(summary.access.canGrantFullAccess, true)
        assert.ok(summary.access.provisioningGrantId)

        assert.deepEqual(
          (await listUserOrganizations(granteeId, database)).map(
            organization => organization.roleName,
          ),
          ['Acesso temporário de configuração'],
        )

        const fullAccessRole = await createRole(
          {
            actorUserId: granteeId,
            organizationId,
            role: {
              name: 'Presidente',
              isDirector: false,
              hasFullAccess: true,
              isDefault: false,
              permissionCodes: [],
            },
          },
          database,
        )

        assert.equal(fullAccessRole.status, 'created')

        if (fullAccessRole.status !== 'created') {
          throw new Error('Expected role creation')
        }

        const defaultRole = await createRole(
          {
            actorUserId: granteeId,
            organizationId,
            role: {
              name: 'Associado',
              isDirector: false,
              hasFullAccess: false,
              isDefault: true,
              permissionCodes: [],
            },
          },
          database,
        )

        assert.equal(defaultRole.status, 'created')

        await createMembershipRow(
          organizationId,
          presidentId,
          fullAccessRole.roleId,
        )
        await insertRequiredDocuments(organizationId, granteeId)

        assert.deepEqual(
          await activateOrganization(granteeId, organizationId, database),
          { status: 'activated' },
        )

        const grants = await pool.query<{ revoked_at: Date | null }>(
          'SELECT revoked_at FROM pg_temp.provisioning_grants',
        )

        assert.notEqual(grants.rows[0].revoked_at, null)

        assert.deepEqual(
          await getOrganizationSummary(granteeId, organizationId, database),
          { status: 'forbidden' },
        )
      },
    )

    await t.test('uploads and lists institutional documents', async () => {
      await reset()

      const presidentId = await createUser('president')
      const outsiderId = await createUser('outsider')
      const organizationId = await createOrganizationRow(presidentId)
      const presidentRoleId = await createRoleRow(organizationId, {
        name: 'Presidente',
        hasFullAccess: true,
      })

      await createMembershipRow(organizationId, presidentId, presidentRoleId)

      const storage = {
        store: async (
          pathname: string,
          _file: { data: Buffer; contentType: string },
        ) => ({ storageKey: pathname }),
        remove: async (_storageKey: string) => undefined,
      }

      assert.deepEqual(
        await uploadOrganizationDocument(
          {
            actorUserId: outsiderId,
            organizationId,
            type: 'statute',
            fileName: 'estatuto.pdf',
            contentType: 'application/pdf',
            data: Buffer.from('%PDF-1.4'),
          },
          database,
          storage,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await uploadOrganizationDocument(
          {
            actorUserId: presidentId,
            organizationId,
            type: 'bylaws',
            fileName: 'estatuto.pdf',
            contentType: 'application/pdf',
            data: Buffer.from('%PDF-1.4'),
          },
          database,
          storage,
        ),
        { status: 'invalid-type' },
      )

      assert.deepEqual(
        await uploadOrganizationDocument(
          {
            actorUserId: presidentId,
            organizationId,
            type: 'statute',
            fileName: 'estatuto.txt',
            contentType: 'text/plain',
            data: Buffer.from('estatuto'),
          },
          database,
          storage,
        ),
        { status: 'invalid-file' },
      )

      const uploaded = await uploadOrganizationDocument(
        {
          actorUserId: presidentId,
          organizationId,
          type: 'statute',
          fileName: 'Estatuto Social.pdf',
          contentType: 'application/pdf',
          data: Buffer.from('%PDF-1.4'),
        },
        database,
        storage,
      )

      assert.equal(uploaded.status, 'uploaded')

      if (uploaded.status !== 'uploaded') {
        throw new Error('Expected upload')
      }

      const list = await listOrganizationDocuments(
        presidentId,
        organizationId,
        database,
      )

      assert.equal(list.status, 'ok')

      if (list.status !== 'ok') throw new Error('Expected documents')

      assert.equal(list.documents.length, 1)
      assert.equal(list.documents[0].type, 'statute')
      assert.equal(list.documents[0].label, 'Estatuto')
      assert.match(
        list.documents[0].storageKey,
        /organizations\/.*\/documentos\/statute\//,
      )

      const audit = await pool.query<{ action: string }>(
        "SELECT action FROM pg_temp.audit_events WHERE action = 'organization.document_uploaded'",
      )

      assert.equal(audit.rowCount, 1)
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

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'missing-documents' },
        )

        await insertRequiredDocuments(organizationId, presidentId)

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
      'closes and reopens an organization with audited read-only access',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const outsiderId = await createUser('outsider')
        const organizationId = await createOrganizationRow(
          presidentId,
          'active',
        )
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })
        await createMembershipRow(organizationId, presidentId, presidentRoleId)

        await pool.query(
          `INSERT INTO pg_temp.invites
            (id, organization_id, role_id, type, document_number, token_hash,
             max_uses, uses_count, expires_at, created_by_user_id)
           VALUES ($1, $2, $3, 'individual', '12345678901', $4, 1, 0,
             now() + interval '1 day', $5)`,
          [
            randomUUID(),
            organizationId,
            presidentRoleId,
            `token-${randomUUID()}`,
            presidentId,
          ],
        )

        assert.deepEqual(
          await closeOrganization(
            {
              actorUserId: outsiderId,
              organizationId,
              reason: 'Encerramento indevido',
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await closeOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              reason: 'Dissolução aprovada em assembleia',
            },
            database,
          ),
          { status: 'closed', revokedInvites: 1 },
        )

        const organization = await pool.query<{
          status: string
          closed_at: Date | null
        }>(
          'SELECT status, closed_at FROM pg_temp.organizations WHERE id = $1',
          [organizationId],
        )

        assert.equal(organization.rows[0].status, 'closed')
        assert.ok(organization.rows[0].closed_at)

        const invites = await pool.query<{ revoked_at: Date | null }>(
          'SELECT revoked_at FROM pg_temp.invites',
        )

        assert.ok(invites.rows[0].revoked_at)

        const summary = await getOrganizationSummary(
          presidentId,
          organizationId,
          database,
        )

        assert.equal(summary.status, 'ok')

        if (summary.status !== 'ok') throw new Error('Expected access')

        assert.equal(summary.access.hasFullAccess, false)
        assert.equal(summary.access.canGrantFullAccess, false)
        assert.ok(summary.access.permissions.includes(PERMISSIONS.membersRead))
        assert.ok(
          summary.access.permissions.includes(PERMISSIONS.organizationClose),
        )
        assert.ok(
          !summary.access.permissions.includes(PERMISSIONS.membersManage),
        )
        assert.ok(!summary.access.permissions.includes(PERMISSIONS.rolesManage))
        assert.ok(summary.organization.closedAt)

        assert.deepEqual(
          await createRole(
            {
              actorUserId: presidentId,
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
          await updateOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              data: { acronym: 'NOVA' },
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await closeOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              reason: 'Encerramento repetido',
            },
            database,
          ),
          { status: 'already-closed' },
        )

        assert.deepEqual(
          await reopenOrganization(presidentId, organizationId, database),
          { status: 'reopened' },
        )

        const reopened = await pool.query<{
          status: string
          closed_at: Date | null
        }>(
          'SELECT status, closed_at FROM pg_temp.organizations WHERE id = $1',
          [organizationId],
        )

        assert.equal(reopened.rows[0].status, 'active')
        assert.equal(reopened.rows[0].closed_at, null)

        assert.deepEqual(
          await reopenOrganization(presidentId, organizationId, database),
          { status: 'not-closed' },
        )

        const createdAfterReopen = await createRole(
          {
            actorUserId: presidentId,
            organizationId,
            role: {
              name: 'Tesoureiro',
              isDirector: false,
              hasFullAccess: false,
              isDefault: false,
              permissionCodes: [PERMISSIONS.membersRead],
            },
          },
          database,
        )

        assert.equal(createdAfterReopen.status, 'created')

        const audit = await pool.query<{ action: string }>(
          `SELECT action FROM pg_temp.audit_events
           WHERE action IN ('organization.closed', 'organization.reopened')
           ORDER BY created_at`,
        )

        assert.deepEqual(
          audit.rows.map(row => row.action),
          ['organization.closed', 'organization.reopened'],
        )
      },
    )

    await t.test(
      'does not close an organization under provisioning',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const organizationId = await createOrganizationRow(presidentId)
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })

        await createMembershipRow(organizationId, presidentId, presidentRoleId)

        assert.deepEqual(
          await closeOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              reason: 'Tentativa antes da ativação',
            },
            database,
          ),
          { status: 'not-active' },
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
        await insertRequiredDocuments(organizationId, presidentId)

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
          await closeOrganization(
            {
              actorUserId: adminId,
              organizationId,
              reason: 'Intervenção indevida',
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await reopenOrganization(adminId, organizationId, database),
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

    await t.test(
      'keeps a closed organization read-only for every management path',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const managerId = await createUser('manager')
        const memberId = await createUser('member')
        const organizationId = await createOrganizationRow(
          presidentId,
          'active',
        )
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          isDirector: true,
          hasFullAccess: true,
        })
        const defaultRoleId = await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })
        const managerRoleId = await createRoleRow(organizationId, {
          name: 'Secretário',
        })

        await pool.query(
          `INSERT INTO pg_temp.role_permissions (role_id, permission_code)
           VALUES ($1, $2), ($1, $3)`,
          [managerRoleId, PERMISSIONS.membersRead, PERMISSIONS.auditRead],
        )

        await createMembershipRow(organizationId, presidentId, presidentRoleId)
        const memberMembershipId = await createMembershipRow(
          organizationId,
          memberId,
          defaultRoleId,
        )
        await createMembershipRow(organizationId, managerId, managerRoleId)

        const closedInviteId = randomUUID()

        await pool.query(
          `INSERT INTO pg_temp.invites
            (id, organization_id, role_id, type, document_number, token_hash,
             max_uses, uses_count, expires_at, created_by_user_id)
           VALUES ($1, $2, $3, 'individual', '12345678901', $4, 1, 0,
             now() + interval '1 day', $5)`,
          [
            closedInviteId,
            organizationId,
            presidentRoleId,
            `token-${randomUUID()}`,
            presidentId,
          ],
        )

        assert.deepEqual(
          await closeOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              reason: 'Encerramento para conferência',
            },
            database,
          ),
          { status: 'closed', revokedInvites: 1 },
        )

        const summary = await getOrganizationSummary(
          presidentId,
          organizationId,
          database,
        )

        assert.equal(summary.status, 'ok')

        if (summary.status !== 'ok') throw new Error('Expected access')

        assert.equal(summary.access.hasFullAccess, false)
        assert.equal(summary.access.canGrantFullAccess, false)
        assert.deepEqual(summary.access.permissions.sort(), [
          'audit.read',
          'members.read',
          'organization.close',
          'organization.read',
          'roles.read',
        ])

        const roles = await listRoles(presidentId, organizationId, database)

        assert.equal(roles.status, 'ok')

        const members = await listOrganizationMemberships(
          presidentId,
          organizationId,
          {},
          database,
        )

        assert.equal(members.status, 'ok')

        const documents = await listOrganizationDocuments(
          presidentId,
          organizationId,
          database,
        )

        assert.equal(documents.status, 'ok')

        const audit = await listAuditEvents(
          presidentId,
          organizationId,
          { limit: 10 },
          database,
        )

        assert.equal(audit.status, 'ok')

        if (audit.status !== 'ok') throw new Error('Expected audit events')

        assert.deepEqual(
          audit.events.map(event => event.action),
          ['organization.closed'],
        )

        const invitedAfterCloseId = randomUUID()

        await pool.query(
          `INSERT INTO pg_temp.invites
            (id, organization_id, role_id, type, token_hash, max_uses,
             expires_at, created_by_user_id)
           VALUES ($1, $2, $3, 'shared', $4, null, now() + interval '1 day', $5)`,
          [
            invitedAfterCloseId,
            organizationId,
            defaultRoleId,
            `token-${randomUUID()}`,
            presidentId,
          ],
        )

        assert.deepEqual(
          await createRole(
            {
              actorUserId: presidentId,
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
              actorUserId: presidentId,
              organizationId,
              roleId: defaultRoleId,
              role: {
                name: 'Associado',
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
          await createInvite(
            {
              actorUserId: presidentId,
              organizationId,
              type: 'shared',
              expiresAt: new Date(Date.now() + 86_400_000),
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await resendInvite(
            { actorUserId: presidentId, inviteId: invitedAfterCloseId },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await revokeInvite(presidentId, invitedAfterCloseId, database),
          { status: 'forbidden' },
        )

        const untouchedInvite = await pool.query<{ revoked_at: Date | null }>(
          'SELECT revoked_at FROM pg_temp.invites WHERE id = $1',
          [invitedAfterCloseId],
        )

        assert.equal(untouchedInvite.rows[0].revoked_at, null)

        assert.deepEqual(
          await getInviteManagementData(
            presidentId,
            organizationId,
            {},
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await deactivateMembership(
            {
              actorUserId: presidentId,
              membershipId: memberMembershipId,
              reason: 'Não autorizado após encerramento',
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await updateMembershipRole(
            {
              actorUserId: presidentId,
              membershipId: memberMembershipId,
              roleId: managerRoleId,
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await createPreRegistrationLink(
            {
              actorUserId: presidentId,
              organizationId,
              roleId: defaultRoleId,
              person: {
                name: 'Nova Pessoa',
                documentNumber: '11144477735',
                email: 'nova.pessoa@example.test',
                phone: '11999990000',
                birthDate: '1990-01-01',
              },
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await uploadOrganizationDocument(
            {
              actorUserId: presidentId,
              organizationId,
              type: 'statute',
              fileName: 'estatuto.pdf',
              contentType: 'application/pdf',
              data: Buffer.from('document'),
            },
            database,
            {
              store: async (pathname: string) => ({ storageKey: pathname }),
              remove: async () => undefined,
            },
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await updateOrganization(
            {
              actorUserId: presidentId,
              organizationId,
              data: { acronym: 'NOVA' },
            },
            database,
          ),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'forbidden' },
        )

        const storedRoles = await pool.query<{ id: string }>(
          'SELECT id FROM pg_temp.roles WHERE organization_id = $1',
          [organizationId],
        )

        assert.equal(storedRoles.rowCount, 3)

        const storedMemberships = await pool.query<{
          status: string
          role_id: string
        }>(
          'SELECT status, role_id FROM pg_temp.memberships WHERE user_id = $1',
          [memberId],
        )

        assert.deepEqual(storedMemberships.rows, [
          { status: 'active', role_id: defaultRoleId },
        ])

        assert.deepEqual(
          await reopenOrganization(managerId, organizationId, database),
          {
            status: 'forbidden',
          },
        )

        assert.deepEqual(
          await reopenOrganization(presidentId, organizationId, database),
          { status: 'reopened' },
        )
      },
    )

    await t.test('isolates authority between organizations', async () => {
      await reset()

      const presidentAId = await createUser('president-a')
      const presidentBId = await createUser('president-b')
      const memberBId = await createUser('member-b')
      const organizationAId = await createOrganizationRow(
        presidentAId,
        'active',
      )
      const organizationBId = await createOrganizationRow(
        presidentBId,
        'active',
      )
      const presidentRoleAId = await createRoleRow(organizationAId, {
        name: 'Presidente',
        hasFullAccess: true,
      })
      const defaultRoleAId = await createRoleRow(organizationAId, {
        name: 'Associado',
        isDefault: true,
      })
      const presidentRoleBId = await createRoleRow(organizationBId, {
        name: 'Presidente',
        hasFullAccess: true,
      })
      const defaultRoleBId = await createRoleRow(organizationBId, {
        name: 'Associado',
        isDefault: true,
      })

      await createMembershipRow(organizationAId, presidentAId, presidentRoleAId)
      await createMembershipRow(organizationBId, presidentBId, presidentRoleBId)
      const memberBMembershipId = await createMembershipRow(
        organizationBId,
        memberBId,
        defaultRoleBId,
      )

      const [organizationBBefore] = (
        await pool.query<{ acronym: string }>(
          'SELECT acronym FROM pg_temp.organizations WHERE id = $1',
          [organizationBId],
        )
      ).rows

      assert.deepEqual(
        await getOrganizationSummary(presidentAId, organizationBId, database),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await updateOrganization(
          {
            actorUserId: presidentAId,
            organizationId: organizationBId,
            data: { acronym: 'TOMADA' },
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await createRole(
          {
            actorUserId: presidentAId,
            organizationId: organizationBId,
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
            actorUserId: presidentAId,
            organizationId: organizationBId,
            roleId: defaultRoleBId,
            role: {
              name: 'Associado',
              isDirector: false,
              hasFullAccess: false,
              isDefault: true,
              isActive: false,
              permissionCodes: [],
            },
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await createInvite(
          {
            actorUserId: presidentAId,
            organizationId: organizationBId,
            type: 'shared',
            roleId: defaultRoleBId,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await deactivateMembership(
          {
            actorUserId: presidentAId,
            membershipId: memberBMembershipId,
            reason: 'Intervenção entre organizações',
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await updateMembershipRole(
          {
            actorUserId: presidentAId,
            membershipId: memberBMembershipId,
            roleId: presidentRoleBId,
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await createPreRegistrationLink(
          {
            actorUserId: presidentAId,
            organizationId: organizationBId,
            roleId: defaultRoleBId,
            person: {
              name: 'Pessoa Externa',
              documentNumber: '11144477735',
              email: 'externa@example.test',
              phone: '11999990000',
              birthDate: '1990-01-01',
            },
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await activateOrganization(presidentAId, organizationBId, database),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await closeOrganization(
          {
            actorUserId: presidentAId,
            organizationId: organizationBId,
            reason: 'Encerramento entre organizações',
          },
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await listRoles(presidentAId, organizationBId, database),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await listOrganizationMemberships(
          presidentAId,
          organizationBId,
          {},
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await listAssignableRoles(presidentAId, organizationBId, database),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await listAuditEvents(presidentAId, organizationBId, {}, database),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await listOrganizationDocuments(
          presidentAId,
          organizationBId,
          database,
        ),
        { status: 'forbidden' },
      )

      assert.deepEqual(
        await getInviteManagementData(
          presidentAId,
          organizationBId,
          {},
          database,
        ),
        { status: 'forbidden' },
      )

      const organizationB = await pool.query<{
        acronym: string
        status: string
      }>('SELECT acronym, status FROM pg_temp.organizations WHERE id = $1', [
        organizationBId,
      ])

      assert.deepEqual(organizationB.rows, [
        { acronym: organizationBBefore.acronym, status: 'active' },
      ])

      const roleB = await pool.query<{ name: string; is_active: boolean }>(
        'SELECT name, is_active FROM pg_temp.roles WHERE id = $1',
        [defaultRoleBId],
      )

      assert.deepEqual(roleB.rows, [{ name: 'Associado', is_active: true }])

      const membershipB = await pool.query<{
        status: string
        role_id: string
      }>('SELECT status, role_id FROM pg_temp.memberships WHERE id = $1', [
        memberBMembershipId,
      ])

      assert.deepEqual(membershipB.rows, [
        { status: 'active', role_id: defaultRoleBId },
      ])

      const auditB = await pool.query(
        'SELECT id FROM pg_temp.audit_events WHERE organization_id = $1',
        [organizationBId],
      )

      assert.equal(auditB.rowCount, 0)

      const roleA = await createRole(
        {
          actorUserId: presidentAId,
          organizationId: organizationAId,
          role: {
            name: 'Tesoureiro',
            isDirector: false,
            hasFullAccess: false,
            isDefault: false,
            permissionCodes: [],
          },
        },
        database,
      )

      assert.equal(roleA.status, 'created')

      const rolesA = await listRoles(presidentAId, organizationAId, database)

      assert.equal(rolesA.status, 'ok')

      if (rolesA.status !== 'ok') throw new Error('Expected roles')

      assert.deepEqual(rolesA.roles.map(role => role.name).sort(), [
        'Associado',
        'Presidente',
        'Tesoureiro',
      ])
      assert.ok(rolesA.roles.some(role => role.id === defaultRoleAId))
    })

    await t.test(
      'requires a non-privileged active default role to activate',
      async () => {
        await reset()

        const presidentId = await createUser('president')
        const organizationId = await createOrganizationRow(presidentId)
        const presidentRoleId = await createRoleRow(organizationId, {
          name: 'Presidente',
          hasFullAccess: true,
        })
        const defaultRoleId = await createRoleRow(organizationId, {
          name: 'Associado',
          isDefault: true,
        })

        await createMembershipRow(organizationId, presidentId, presidentRoleId)
        await insertRequiredDocuments(organizationId, presidentId)

        await pool.query(
          'UPDATE pg_temp.roles SET has_full_access = true WHERE id = $1',
          [defaultRoleId],
        )

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'missing-default-role' },
        )

        await pool.query(
          `UPDATE pg_temp.roles
           SET has_full_access = false, is_director = true
           WHERE id = $1`,
          [defaultRoleId],
        )

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'missing-default-role' },
        )

        await pool.query(
          'UPDATE pg_temp.roles SET is_director = false WHERE id = $1',
          [defaultRoleId],
        )

        assert.deepEqual(
          await activateOrganization(presidentId, organizationId, database),
          { status: 'activated' },
        )
      },
    )

    await t.test(
      'ends temporary provisioning access when the organization activates',
      async () => {
        await reset()

        const adminId = await createUser('admin')
        const granteeId = await createUser('grantee')
        const organizationId = await createOrganizationRow(adminId)

        await pool.query(
          `INSERT INTO pg_temp.provisioning_grants
            (id, organization_id, user_id, created_by_user_id)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), organizationId, granteeId, adminId],
        )

        assert.equal(
          (await getOrganizationSummary(granteeId, organizationId, database))
            .status,
          'ok',
        )

        await pool.query(
          "UPDATE pg_temp.organizations SET status = 'active' WHERE id = $1",
          [organizationId],
        )

        assert.deepEqual(
          await getOrganizationSummary(granteeId, organizationId, database),
          { status: 'forbidden' },
        )

        assert.deepEqual(
          await createRole(
            {
              actorUserId: granteeId,
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
      },
    )
  } finally {
    await pool.end()
  }
})
