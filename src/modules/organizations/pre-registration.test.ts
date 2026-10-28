import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { completeRegistration } from '@/modules/identity/complete-registration.server'
import type { RequestRegistrationData } from '@/modules/identity/registration.schema'
import { createPreRegistrationLink } from './pre-registration.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'
const PASSWORD = 'uma senha bem longa 123'

test('pre-registration on PostgreSQL, using temporary tables', {
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
      CREATE TEMP TABLE accounts (
        id uuid PRIMARY KEY,
        login varchar(11) NOT NULL UNIQUE,
        password_hash text NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid,
        name varchar(255) NOT NULL,
        document_number varchar(11) NOT NULL UNIQUE,
        email varchar(55) NOT NULL,
        email_verified_at timestamptz,
        phone varchar(11) NOT NULL,
        birth_date date NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE organizations (
        id uuid PRIMARY KEY,
        legal_name varchar(255) NOT NULL,
        status varchar(20) NOT NULL
      );
      CREATE TEMP TABLE roles (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        name varchar(100) NOT NULL,
        is_director boolean DEFAULT false NOT NULL,
        has_full_access boolean DEFAULT false NOT NULL,
        is_default boolean DEFAULT false NOT NULL,
        is_active boolean DEFAULT true NOT NULL
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
        status varchar(20) DEFAULT 'active' NOT NULL,
        joined_at timestamptz DEFAULT now() NOT NULL,
        deactivated_at timestamptz,
        deactivated_by_user_id uuid,
        deactivation_reason varchar(500),
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT memberships_organization_id_user_id_unique
          UNIQUE (organization_id, user_id)
      );
      CREATE TEMP TABLE registration_requests (
        id uuid PRIMARY KEY,
        user_id uuid,
        organization_id uuid,
        role_id uuid,
        created_by_user_id uuid,
        name varchar(255) NOT NULL,
        document_number varchar(11) NOT NULL,
        email varchar(55) NOT NULL,
        phone varchar(11) NOT NULL,
        birth_date date NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        invalidated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE registration_contact_conflicts (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        organization_id uuid NOT NULL,
        email varchar(55) NOT NULL,
        phone varchar(11) NOT NULL,
        created_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz
      )
    `)

    const organizationId = randomUUID()
    const actorUserId = randomUUID()
    const managerUserId = randomUUID()
    const presidentRoleId = randomUUID()
    const associateRoleId = randomUUID()
    const managerRoleId = randomUUID()
    const inactiveRoleId = randomUUID()

    await pool.query(
      "INSERT INTO pg_temp.organizations (id, legal_name, status) VALUES ($1, 'Associação Teste', 'active')",
      [organizationId],
    )

    const roles = [
      [presidentRoleId, 'Presidente', false, true, false, true],
      [associateRoleId, 'Associado', false, false, true, true],
      [managerRoleId, 'Gestor', false, false, false, true],
      [inactiveRoleId, 'Inativo', false, false, false, false],
    ] as const

    for (const [
      id,
      name,
      isDirector,
      hasFullAccess,
      isDefault,
      isActive,
    ] of roles) {
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
      `INSERT INTO pg_temp.role_permissions (role_id, permission_code)
       VALUES ($1, 'members.manage')`,
      [managerRoleId],
    )

    await pool.query(
      `INSERT INTO pg_temp.memberships (id, organization_id, user_id, role_id, status)
       VALUES
        ($1, $2, $3, $4, 'active'),
        ($5, $2, $6, $7, 'active')`,
      [
        randomUUID(),
        organizationId,
        actorUserId,
        presidentRoleId,
        randomUUID(),
        managerUserId,
        managerRoleId,
      ],
    )

    function person(
      overrides: Partial<RequestRegistrationData> = {},
    ): RequestRegistrationData {
      return {
        name: 'Pessoa Pré-cadastrada',
        documentNumber: '52998224725',
        email: 'pessoa@example.test',
        phone: '11999999999',
        birthDate: '1990-01-01',
        ...overrides,
      }
    }

    await t.test(
      'creates the link and membership after activation',
      async () => {
        const requested = await createPreRegistrationLink(
          {
            actorUserId,
            organizationId,
            roleId: associateRoleId,
            person: person(),
          },
          database,
        )

        assert.equal(requested.status, 'link-sent')

        if (requested.status !== 'link-sent') {
          throw new Error('Expected link')
        }

        assert.equal(requested.contactConflict, false)
        assert.equal(requested.to, 'pessoa@example.test')

        const created = await pool.query<{
          user_id: string
          organization_id: string
          role_id: string
          email: string
        }>(
          'SELECT user_id, organization_id, role_id, email FROM pg_temp.registration_requests',
        )

        assert.equal(created.rowCount, 1)
        assert.equal(created.rows[0].organization_id, organizationId)
        assert.equal(created.rows[0].role_id, associateRoleId)
        assert.equal(created.rows[0].email, 'pessoa@example.test')

        const completed = await completeRegistration(
          {
            token: requested.token,
            password: PASSWORD,
            contactChoice: 'existing',
          },
          database,
        )

        assert.deepEqual(completed, { status: 'completed' })

        const membership = await pool.query<{
          role_id: string
          status: string
        }>(
          'SELECT role_id, status FROM pg_temp.memberships WHERE user_id = $1',
          [created.rows[0].user_id],
        )

        assert.deepEqual(membership.rows, [
          { role_id: associateRoleId, status: 'active' },
        ])

        const account = await pool.query<{ login: string }>(
          'SELECT login FROM pg_temp.accounts WHERE login = $1',
          ['52998224725'],
        )

        assert.equal(account.rowCount, 1)
      },
    )

    await t.test('rejects an existing account', async () => {
      assert.deepEqual(
        await createPreRegistrationLink(
          {
            actorUserId,
            organizationId,
            roleId: associateRoleId,
            person: person(),
          },
          database,
        ),
        { status: 'account-exists' },
      )
    })

    await t.test('rate limits repeated requests', async () => {
      const personData = person({
        documentNumber: '11144477735',
        email: 'outra@example.test',
      })

      assert.equal(
        (
          await createPreRegistrationLink(
            {
              actorUserId,
              organizationId,
              roleId: associateRoleId,
              person: personData,
            },
            database,
          )
        ).status,
        'link-sent',
      )

      assert.deepEqual(
        await createPreRegistrationLink(
          {
            actorUserId,
            organizationId,
            roleId: associateRoleId,
            person: personData,
          },
          database,
        ),
        { status: 'rate-limited' },
      )
    })

    await t.test(
      'rejects an inactive role and a privileged role without full access',
      async () => {
        assert.deepEqual(
          await createPreRegistrationLink(
            {
              actorUserId,
              organizationId,
              roleId: inactiveRoleId,
              person: person({
                documentNumber: '12345678909',
                email: 'inativo@example.test',
              }),
            },
            database,
          ),
          { status: 'invalid-role' },
        )

        assert.deepEqual(
          await createPreRegistrationLink(
            {
              actorUserId: managerUserId,
              organizationId,
              roleId: presidentRoleId,
              person: person({
                documentNumber: '98765432100',
                email: 'privilegiado@example.test',
              }),
            },
            database,
          ),
          { status: 'role-not-allowed' },
        )
      },
    )

    await t.test(
      'rejects an existing membership without an account',
      async () => {
        const userId = randomUUID()

        await pool.query(
          `INSERT INTO pg_temp.users
          (id, name, document_number, email, phone, birth_date)
         VALUES ($1, 'Já vinculada', '39053344705', 'vinculada@example.test', '11777777777', '1985-05-05')`,
          [userId],
        )

        await pool.query(
          `INSERT INTO pg_temp.memberships (id, organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
          [randomUUID(), organizationId, userId, associateRoleId],
        )

        assert.deepEqual(
          await createPreRegistrationLink(
            {
              actorUserId,
              organizationId,
              roleId: associateRoleId,
              person: person({
                documentNumber: '39053344705',
                email: 'vinculada@example.test',
                phone: '11777777777',
              }),
            },
            database,
          ),
          { status: 'already-member' },
        )
      },
    )

    await t.test(
      'records and resolves a contact conflict at activation',
      async () => {
        const userId = randomUUID()

        await pool.query(
          `INSERT INTO pg_temp.users
          (id, name, document_number, email, phone, birth_date)
         VALUES ($1, 'Contato Antigo', '86288366757', 'antigo@example.test', '11666666666', '1980-02-02')`,
          [userId],
        )

        const requested = await createPreRegistrationLink(
          {
            actorUserId,
            organizationId,
            roleId: associateRoleId,
            person: person({
              documentNumber: '86288366757',
              email: 'novo@example.test',
              phone: '11555555555',
            }),
          },
          database,
        )

        assert.equal(requested.status, 'link-sent')

        if (requested.status !== 'link-sent') {
          throw new Error('Expected link')
        }

        assert.equal(requested.contactConflict, true)
        assert.equal(requested.to, 'antigo@example.test')

        const conflict = await pool.query<{ id: string }>(
          'SELECT id FROM pg_temp.registration_contact_conflicts WHERE user_id = $1',
          [userId],
        )

        assert.equal(conflict.rowCount, 1)

        assert.deepEqual(
          await completeRegistration(
            {
              token: requested.token,
              password: PASSWORD,
              contactChoice: conflict.rows[0].id,
            },
            database,
          ),
          { status: 'completed' },
        )

        const updated = await pool.query<{
          email: string
          phone: string
        }>('SELECT email, phone FROM pg_temp.users WHERE id = $1', [userId])

        assert.deepEqual(updated.rows[0], {
          email: 'novo@example.test',
          phone: '11555555555',
        })

        const resolved = await pool.query<{ resolved_at: Date | null }>(
          'SELECT resolved_at FROM pg_temp.registration_contact_conflicts WHERE id = $1',
          [conflict.rows[0].id],
        )

        assert.notEqual(resolved.rows[0].resolved_at, null)
      },
    )
  } finally {
    await pool.end()
  }
})
