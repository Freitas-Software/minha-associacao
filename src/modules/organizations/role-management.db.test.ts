import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describeDatabase } from '@tests/support/database-suite'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, beforeAll, it } from 'vitest'
import * as schema from '@/db/schema'
import type { UpdateRoleData } from './organization.schema'
import { changeDefaultRole, updateRole } from './organization.server'

const connectionString = process.env.TEST_DATABASE_URL

describeDatabase(
  'role management on PostgreSQL, using temporary tables',
  () => {
    const pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 3000,
    })
    const database = drizzle({
      client: pool,
      relations: defineRelations(schema),
    })

    const organizationId = randomUUID()
    const actorUserId = randomUUID()
    const memberUserId = randomUUID()
    const presidentRoleId = randomUUID()
    const associateRoleId = randomUUID()
    const treasurerRoleId = randomUUID()
    const secretaryRoleId = randomUUID()
    const auditorRoleId = randomUUID()
    const inviteeRoleId = randomUUID()

    beforeAll(async () => {
      await pool.query(`
      CREATE TEMP TABLE organizations (
        id uuid PRIMARY KEY,
        status varchar(20) NOT NULL
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
        CONSTRAINT roles_organization_id_name_unique UNIQUE (organization_id, name)
      );
      CREATE UNIQUE INDEX roles_organization_id_default_unique
        ON roles (organization_id) WHERE is_default AND is_active;
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
        status varchar(20) DEFAULT 'active' NOT NULL,
        CONSTRAINT memberships_organization_id_user_id_unique
          UNIQUE (organization_id, user_id)
      );
      CREATE TEMP TABLE invites (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        role_id uuid,
        uses_count integer DEFAULT 0 NOT NULL,
        max_uses integer,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz
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
      )
    `)

      await pool.query(
        "INSERT INTO pg_temp.organizations (id, status) VALUES ($1, 'active')",
        [organizationId],
      )

      const roleRows = [
        ['Presidente', true, true, false, true, presidentRoleId],
        ['Associado', false, false, true, true, associateRoleId],
        ['Tesoureiro', false, false, false, true, treasurerRoleId],
        ['Secretário', false, false, false, true, secretaryRoleId],
        ['Auditor', false, false, false, true, auditorRoleId],
        ['Convidado', false, false, false, true, inviteeRoleId],
      ] as const

      for (const [
        name,
        isDirector,
        hasFullAccess,
        isDefault,
        isActive,
        id,
      ] of roleRows) {
        await pool.query(
          `INSERT INTO pg_temp.roles
          (id, organization_id, name, is_director, has_full_access, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            organizationId,
            name,
            isDirector,
            hasFullAccess,
            isDefault,
            isActive,
          ],
        )
      }

      await pool.query(
        `INSERT INTO pg_temp.memberships
        (id, organization_id, user_id, role_id, status)
       VALUES
        ($1, $2, $3, $4, 'active'),
        ($5, $2, $6, $7, 'active'),
        ($8, $2, $9, $10, 'active')`,
        [
          randomUUID(),
          organizationId,
          actorUserId,
          presidentRoleId,
          randomUUID(),
          memberUserId,
          associateRoleId,
          randomUUID(),
          randomUUID(),
          secretaryRoleId,
        ],
      )

      await pool.query(
        `INSERT INTO pg_temp.invites
        (id, organization_id, role_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 day')`,
        [randomUUID(), organizationId, inviteeRoleId],
      )
    })

    function role(overrides: Partial<UpdateRoleData> = {}): UpdateRoleData {
      return {
        name: 'Tesoureiro',
        isDirector: false,
        hasFullAccess: false,
        isDefault: false,
        isActive: true,
        permissionCodes: [],
        ...overrides,
      }
    }

    it('rejects callers without roles.manage', async () => {
      const result = await updateRole(
        {
          actorUserId: memberUserId,
          organizationId,
          roleId: treasurerRoleId,
          role: role(),
        },
        database,
      )

      assert.deepEqual(result, { status: 'forbidden' })
    })

    it('updates name, flags and permissions', async () => {
      const result = await updateRole(
        {
          actorUserId,
          organizationId,
          roleId: treasurerRoleId,
          role: role({
            name: 'Tesoureiro geral',
            isDirector: true,
            permissionCodes: ['members.read', 'members.manage'],
          }),
        },
        database,
      )

      assert.deepEqual(result, { status: 'updated' })

      const stored = await pool.query<{
        name: string
        is_director: boolean
      }>('SELECT name, is_director FROM pg_temp.roles WHERE id = $1', [
        treasurerRoleId,
      ])

      assert.equal(stored.rows[0].name, 'Tesoureiro geral')
      assert.equal(stored.rows[0].is_director, true)

      const permissions = await pool.query<{ permission_code: string }>(
        'SELECT permission_code FROM pg_temp.role_permissions WHERE role_id = $1 ORDER BY permission_code',
        [treasurerRoleId],
      )

      assert.deepEqual(permissions.rows, [
        { permission_code: 'members.manage' },
        { permission_code: 'members.read' },
      ])
    })

    it('rejects duplicate role names and invalid defaults', async () => {
      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: treasurerRoleId,
            role: role({ name: 'Associado' }),
          },
          database,
        ),
        { status: 'role-name-exists' },
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: treasurerRoleId,
            role: role({ isDirector: true, isDefault: true }),
          },
          database,
        ),
        { status: 'invalid-default-role' },
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: treasurerRoleId,
            role: role({ isDefault: true }),
          },
          database,
        ),
        { status: 'default-role-exists' },
      )
    })

    it('blocks deactivation of roles with memberships or pending invites', async () => {
      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: secretaryRoleId,
            role: role({ name: 'Secretário', isActive: false }),
          },
          database,
        ),
        { status: 'role-in-use' },
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: inviteeRoleId,
            role: role({ name: 'Convidado', isActive: false }),
          },
          database,
        ),
        { status: 'role-in-use' },
      )
    })

    it('deactivates and reactivates an unused role', async () => {
      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: auditorRoleId,
            role: role({ name: 'Auditor', isActive: false }),
          },
          database,
        ),
        { status: 'updated' },
      )

      const inactive = await pool.query<{ is_active: boolean }>(
        'SELECT is_active FROM pg_temp.roles WHERE id = $1',
        [auditorRoleId],
      )

      assert.equal(inactive.rows[0].is_active, false)

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: auditorRoleId,
            role: role({ name: 'Auditor', isActive: true }),
          },
          database,
        ),
        { status: 'updated' },
      )
    })

    it('changes the default role atomically with authorization', async () => {
      const candidateRoleId = randomUUID()
      const directorCandidateId = randomUUID()
      const privilegedCandidateId = randomUUID()
      const managerRoleId = randomUUID()
      const managerUserId = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
            (id, organization_id, name, is_director, has_full_access, is_default, is_active)
           VALUES ($1, $2, 'Visitante', false, false, false, true),
             ($3, $2, 'Diretor candidato', true, false, false, true),
             ($4, $2, 'Auditor candidato', false, false, false, true),
             ($5, $2, 'Gestor de cargos', false, false, false, true)`,
        [
          candidateRoleId,
          organizationId,
          directorCandidateId,
          privilegedCandidateId,
          managerRoleId,
        ],
      )

      await pool.query(
        `INSERT INTO pg_temp.role_permissions (role_id, permission_code)
           VALUES ($1, 'roles.manage'), ($2, 'audit.read')`,
        [managerRoleId, privilegedCandidateId],
      )

      await pool.query(
        `INSERT INTO pg_temp.memberships (id, organization_id, user_id, role_id, status)
           VALUES ($1, $2, $3, $4, 'active')`,
        [randomUUID(), organizationId, managerUserId, managerRoleId],
      )

      assert.deepEqual(
        await changeDefaultRole(
          {
            actorUserId: managerUserId,
            organizationId,
            roleId: privilegedCandidateId,
          },
          database,
        ),
        { status: 'role-not-allowed' },
      )

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: candidateRoleId },
          database,
        ),
        { status: 'changed', previousRoleId: associateRoleId },
      )

      const defaults = await pool.query<{ id: string }>(
        'SELECT id FROM pg_temp.roles WHERE organization_id = $1 AND is_default ORDER BY id',
        [organizationId],
      )

      assert.deepEqual(defaults.rows, [{ id: candidateRoleId }])

      const previousDefault = await pool.query<{ is_default: boolean }>(
        'SELECT is_default FROM pg_temp.roles WHERE id = $1',
        [associateRoleId],
      )

      assert.equal(previousDefault.rows[0].is_default, false)

      const audit = await pool.query<{
        action: string
        metadata: { fromRoleId: string; toRoleId: string }
      }>(
        "SELECT action, metadata FROM pg_temp.audit_events WHERE action = 'role.default_changed'",
      )

      assert.equal(audit.rowCount, 1)
      assert.deepEqual(audit.rows[0].metadata, {
        fromRoleId: associateRoleId,
        toRoleId: candidateRoleId,
      })

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: candidateRoleId },
          database,
        ),
        { status: 'unchanged' },
      )

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: presidentRoleId },
          database,
        ),
        { status: 'invalid-default-role' },
      )

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: directorCandidateId },
          database,
        ),
        { status: 'invalid-default-role' },
      )

      const inactiveCandidateId = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
            (id, organization_id, name, is_director, has_full_access, is_default, is_active)
           VALUES ($1, $2, 'Inativo candidato', false, false, false, false)`,
        [inactiveCandidateId, organizationId],
      )

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: inactiveCandidateId },
          database,
        ),
        { status: 'invalid-role' },
      )

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: randomUUID() },
          database,
        ),
        { status: 'invalid-role' },
      )

      assert.deepEqual(
        await changeDefaultRole(
          {
            actorUserId: memberUserId,
            organizationId,
            roleId: candidateRoleId,
          },
          database,
        ),
        { status: 'forbidden' },
      )

      await pool.query(
        "UPDATE pg_temp.organizations SET status = 'closed' WHERE id = $1",
        [organizationId],
      )

      assert.deepEqual(
        await changeDefaultRole(
          { actorUserId, organizationId, roleId: auditorRoleId },
          database,
        ),
        { status: 'forbidden' },
      )

      await pool.query(
        "UPDATE pg_temp.organizations SET status = 'active' WHERE id = $1",
        [organizationId],
      )
    })

    it('deactivates roles with only inactive memberships or expired invites', async () => {
      const historicalRoleId = randomUUID()
      const expiredInviteRoleId = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
            (id, organization_id, name, is_director, has_full_access, is_default, is_active)
           VALUES ($1, $2, 'Histórico', false, false, false, true),
             ($3, $2, 'Convite antigo', false, false, false, true)`,
        [historicalRoleId, organizationId, expiredInviteRoleId],
      )

      await pool.query(
        `INSERT INTO pg_temp.memberships (id, organization_id, user_id, role_id, status)
           VALUES ($1, $2, $3, $4, 'inactive')`,
        [randomUUID(), organizationId, randomUUID(), historicalRoleId],
      )

      await pool.query(
        `INSERT INTO pg_temp.invites
            (id, organization_id, role_id, expires_at)
           VALUES ($1, $2, $3, now() - interval '1 day')`,
        [randomUUID(), organizationId, expiredInviteRoleId],
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: historicalRoleId,
            role: role({ name: 'Histórico', isActive: false }),
          },
          database,
        ),
        { status: 'updated' },
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: expiredInviteRoleId,
            role: role({ name: 'Convite antigo', isActive: false }),
          },
          database,
        ),
        { status: 'updated' },
      )
    })

    it('blocks removing the last full-access member', async () => {
      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: presidentRoleId,
            role: role({ name: 'Presidente', hasFullAccess: false }),
          },
          database,
        ),
        { status: 'full-access-required' },
      )
    })

    it('ignores full-access members whose role is inactive', async () => {
      const inactiveRoleId = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
            (id, organization_id, name, is_director, has_full_access, is_default, is_active)
           VALUES ($1, $2, 'Vice-presidente afastado', false, true, false, false)`,
        [inactiveRoleId, organizationId],
      )

      await pool.query(
        `INSERT INTO pg_temp.memberships (id, organization_id, user_id, role_id, status)
           VALUES ($1, $2, $3, $4, 'active')`,
        [randomUUID(), organizationId, randomUUID(), inactiveRoleId],
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: presidentRoleId,
            role: role({ name: 'Presidente', hasFullAccess: false }),
          },
          database,
        ),
        { status: 'full-access-required' },
      )
    })

    it('allows removing full access when another full-access member exists', async () => {
      const viceRoleId = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.roles
          (id, organization_id, name, is_director, has_full_access, is_default, is_active)
         VALUES ($1, $2, 'Vice-presidente', false, true, false, true)`,
        [viceRoleId, organizationId],
      )

      await pool.query(
        `INSERT INTO pg_temp.memberships (id, organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [randomUUID(), organizationId, randomUUID(), viceRoleId],
      )

      assert.deepEqual(
        await updateRole(
          {
            actorUserId,
            organizationId,
            roleId: presidentRoleId,
            role: role({ name: 'Presidente', hasFullAccess: false }),
          },
          database,
        ),
        { status: 'updated' },
      )
    })
    afterAll(async () => {
      await pool.end()
    })
  },
)
