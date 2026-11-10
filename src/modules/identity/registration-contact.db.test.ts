import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { describeDatabase } from '@tests/support/database-suite'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, beforeAll, it } from 'vitest'
import * as schema from '@/db/schema'
import { getRegistrationContactContext } from './registration-contact.server'
import { hashRegistrationToken } from './registration-token.server'

const connectionString = process.env.TEST_DATABASE_URL

describeDatabase(
  'registration contact context on PostgreSQL, using temporary tables',
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

    beforeAll(async () => {
      await pool.query(`
      CREATE TEMP TABLE organizations (
        id uuid PRIMARY KEY,
        legal_name varchar(255) NOT NULL,
        acronym varchar(32) NOT NULL
      );
      CREATE TEMP TABLE roles (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        name varchar(100) NOT NULL
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
    })

    async function reset() {
      await pool.query(
        'TRUNCATE pg_temp.organizations, pg_temp.roles, pg_temp.registration_requests, pg_temp.registration_contact_conflicts',
      )
    }

    async function insertRequest(input: {
      token: string
      documentNumber: string
      email: string
      phone?: string
      userId?: string | null
      organizationId?: string | null
      roleId?: string | null
      expiresAt?: Date
      consumedAt?: Date | null
      invalidatedAt?: Date | null
    }) {
      await pool.query(
        `INSERT INTO pg_temp.registration_requests
          (id, user_id, organization_id, role_id, name, document_number, email, phone, birth_date, token_hash, expires_at, consumed_at, invalidated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          randomUUID(),
          input.userId ?? null,
          input.organizationId ?? null,
          input.roleId ?? null,
          'Pessoa Cadastrada',
          input.documentNumber,
          input.email,
          input.phone ?? '11999999999',
          '1990-01-01',
          hashRegistrationToken(input.token),
          input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
          input.consumedAt ?? null,
          input.invalidatedAt ?? null,
        ],
      )
    }

    it('returns the context for a public registration', async () => {
      await reset()

      const token = randomBytes(32).toString('base64url')

      await insertRequest({
        token,
        documentNumber: '12345678900',
        email: 'publico@example.test',
        phone: '11912345678',
      })

      assert.deepEqual(await getRegistrationContactContext(token, database), {
        currentEmail: 'publico@example.test',
        currentPhone: '11912345678',
        conflicts: [],
        documentNumberMasked: '***.***.***-00',
        organization: null,
        roleName: null,
      })
    })

    it('returns organization and role for a pre-registration', async () => {
      await reset()

      const token = randomBytes(32).toString('base64url')
      const organizationId = randomUUID()
      const roleId = randomUUID()

      await pool.query(
        'INSERT INTO pg_temp.organizations (id, legal_name, acronym) VALUES ($1, $2, $3)',
        [organizationId, 'Associação Teste', 'ATE'],
      )
      await pool.query(
        'INSERT INTO pg_temp.roles (id, organization_id, name) VALUES ($1, $2, $3)',
        [roleId, organizationId, 'Associado'],
      )
      await insertRequest({
        token,
        documentNumber: '01234567890',
        email: 'pre.cadastro@example.test',
        userId: randomUUID(),
        organizationId,
        roleId,
      })

      const context = await getRegistrationContactContext(token, database)

      assert.deepEqual(context?.organization, {
        legalName: 'Associação Teste',
        acronym: 'ATE',
      })
      assert.equal(context?.roleName, 'Associado')
      assert.equal(context?.documentNumberMasked, '***.***.***-90')
      assert.deepEqual(context?.conflicts, [])
    })

    it('does not resolve a role from another organization', async () => {
      await reset()

      const token = randomBytes(32).toString('base64url')
      const organizationId = randomUUID()
      const otherOrganizationId = randomUUID()
      const otherRoleId = randomUUID()

      await pool.query(
        'INSERT INTO pg_temp.organizations (id, legal_name, acronym) VALUES ($1, $2, $3), ($4, $5, $6)',
        [
          organizationId,
          'Associação Correta',
          'AC',
          otherOrganizationId,
          'Outra Associação',
          'OA',
        ],
      )
      await pool.query(
        'INSERT INTO pg_temp.roles (id, organization_id, name) VALUES ($1, $2, $3)',
        [otherRoleId, otherOrganizationId, 'Cargo Externo'],
      )
      await insertRequest({
        token,
        documentNumber: '11144477735',
        email: 'escopo@example.test',
        organizationId,
        roleId: otherRoleId,
      })

      const context = await getRegistrationContactContext(token, database)

      assert.deepEqual(context?.organization, {
        legalName: 'Associação Correta',
        acronym: 'AC',
      })
      assert.equal(context?.roleName, null)
    })

    it('lists unresolved contact conflicts only', async () => {
      await reset()

      const token = randomBytes(32).toString('base64url')
      const userId = randomUUID()
      const organizationId = randomUUID()

      await pool.query(
        'INSERT INTO pg_temp.organizations (id, legal_name, acronym) VALUES ($1, $2, $3)',
        [organizationId, 'Associação Conflito', 'AC'],
      )
      await insertRequest({
        token,
        documentNumber: '52998224725',
        email: 'conflito@example.test',
        userId,
      })
      const conflictId = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.registration_contact_conflicts
          (id, user_id, organization_id, email, phone, created_by_user_id, resolved_at)
         VALUES
          ($1, $2, $3, 'novo@example.test', '11988887777', $4, NULL),
          ($5, $2, $3, 'antigo@example.test', '11977776666', $4, now())`,
        [conflictId, userId, organizationId, randomUUID(), randomUUID()],
      )

      const context = await getRegistrationContactContext(token, database)

      assert.deepEqual(context?.conflicts, [
        {
          id: conflictId,
          organizationName: 'Associação Conflito',
          email: 'novo@example.test',
          phone: '11988887777',
        },
      ])
    })

    it('returns null for invalid, expired, consumed and invalidated tokens', async () => {
      await reset()

      const invalidToken = randomBytes(32).toString('base64url')
      const expiredToken = randomBytes(32).toString('base64url')
      const consumedToken = randomBytes(32).toString('base64url')
      const invalidatedToken = randomBytes(32).toString('base64url')

      await insertRequest({
        token: expiredToken,
        documentNumber: '11144477735',
        email: 'expirado@example.test',
        expiresAt: new Date(Date.now() - 60 * 1000),
      })
      await insertRequest({
        token: consumedToken,
        documentNumber: '39053344705',
        email: 'consumido@example.test',
        consumedAt: new Date(),
      })
      await insertRequest({
        token: invalidatedToken,
        documentNumber: '86288366757',
        email: 'invalidado@example.test',
        invalidatedAt: new Date(),
      })

      assert.equal(
        await getRegistrationContactContext(invalidToken, database),
        null,
      )
      assert.equal(
        await getRegistrationContactContext(expiredToken, database),
        null,
      )
      assert.equal(
        await getRegistrationContactContext(consumedToken, database),
        null,
      )
      assert.equal(
        await getRegistrationContactContext(invalidatedToken, database),
        null,
      )
    })

    afterAll(async () => {
      await pool.end()
    })
  },
)
