import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import {
  approveOrganizationRequest,
  getOrganizationRequestDocument,
  listOrganizationRequests,
  listPendingOrganizationRequests,
  listUserOrganizationRequests,
  rejectOrganizationRequest,
  requestOrganization,
} from './organization-request.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

const FIRST_CNPJ = '11222333000181'
const SECOND_CNPJ = '04252011000110'

test('organization requests on PostgreSQL, using temporary tables', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const database = drizzle({ client: pool, relations: defineRelations(schema) })

  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : input.toString()
      const cnpj = url.split('/').pop() ?? ''

      return new Response(
        JSON.stringify({
          cnpj,
          razao_social: 'ASSOCIACAO SOLICITANTE',
          cnae_fiscal: 9430800,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )

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
      CREATE TEMP TABLE platform_admins (
        user_id uuid PRIMARY KEY,
        granted_by_user_id uuid,
        created_at timestamptz DEFAULT now() NOT NULL,
        revoked_at timestamptz
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
      CREATE TEMP TABLE organization_requests (
        id uuid PRIMARY KEY,
        requester_user_id uuid NOT NULL,
        cnpj varchar(14) NOT NULL,
        legal_name varchar(255) NOT NULL,
        acronym varchar(32) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        document_name varchar(255) NOT NULL,
        document_type varchar(100) NOT NULL,
        document_size integer NOT NULL,
        document_data bytea NOT NULL,
        reviewed_by_user_id uuid,
        reviewed_at timestamptz,
        rejection_reason varchar(500),
        organization_id uuid,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX organization_requests_pending_cnpj_unique
        ON organization_requests (cnpj) WHERE status = 'pending';
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

    let userCounter = 0

    async function createUser(label: string) {
      userCounter += 1
      const id = randomUUID()
      const suffix = String(userCounter).padStart(6, '0')

      await pool.query(
        `INSERT INTO pg_temp.users
          (id, "accountId", name, document_number, email, email_verified_at, phone, birth_date)
         VALUES ($1, $2, $3, $4, $5, now(), $6, $7)`,
        [
          id,
          randomUUID(),
          label,
          `8${suffix}0000`,
          `${label}.${suffix}@example.test`,
          `117${suffix}00`,
          '1990-01-01',
        ],
      )

      return id
    }

    const requesterId = await createUser('requester')
    const adminId = await createUser('admin')
    await pool.query(
      'INSERT INTO pg_temp.platform_admins (user_id) VALUES ($1)',
      [adminId],
    )

    const document = Buffer.from('ata de eleição fixture')

    await t.test(
      'creates a pending request and validates permissions',
      async () => {
        const created = await requestOrganization(
          {
            actorUserId: requesterId,
            cnpj: FIRST_CNPJ,
            acronym: 'AS',
            documentName: 'ata.pdf',
            documentType: 'application/pdf',
            documentSize: document.byteLength,
            documentData: document,
          },
          database,
        )

        assert.equal(created.status, 'created')

        assert.deepEqual(
          await requestOrganization(
            {
              actorUserId: requesterId,
              cnpj: FIRST_CNPJ,
              acronym: 'AS',
              documentName: 'ata.pdf',
              documentType: 'application/pdf',
              documentSize: document.byteLength,
              documentData: document,
            },
            database,
          ),
          { status: 'pending-request' },
        )

        const mine = await listUserOrganizationRequests(requesterId, database)

        assert.equal(mine.length, 1)
        assert.equal(mine[0].status, 'pending')

        assert.deepEqual(
          await listPendingOrganizationRequests(requesterId, database),
          { status: 'forbidden' },
        )

        const pending = await listPendingOrganizationRequests(adminId, database)

        assert.equal(pending.status, 'ok')

        if (pending.status !== 'ok') throw new Error('Expected pending list')

        assert.equal(pending.requests.length, 1)
        assert.equal(pending.requests[0].requesterName, 'requester')

        if (created.status !== 'created') throw new Error('Expected request')

        assert.deepEqual(
          await getOrganizationRequestDocument(
            requesterId,
            created.requestId,
            database,
          ),
          { status: 'forbidden' },
        )

        const adminDocument = await getOrganizationRequestDocument(
          adminId,
          created.requestId,
          database,
        )

        assert.equal(adminDocument.status, 'ok')

        if (adminDocument.status !== 'ok') throw new Error('Expected document')

        assert.deepEqual(adminDocument.data, document)

        assert.deepEqual(
          await approveOrganizationRequest(
            requesterId,
            created.requestId,
            database,
          ),
          { status: 'forbidden' },
        )
      },
    )

    await t.test('approves and creates the initial organization', async () => {
      const [request] = await pool
        .query<{ id: string }>(
          "SELECT id FROM pg_temp.organization_requests WHERE status = 'pending'",
        )
        .then(result => result.rows)

      const approved = await approveOrganizationRequest(
        adminId,
        request.id,
        database,
      )

      assert.equal(approved.status, 'approved')

      if (approved.status !== 'approved') throw new Error('Expected approval')

      const organizations = await pool.query<{
        id: string
        status: string
        legal_name: string
        created_by_user_id: string
      }>(
        'SELECT id, status, legal_name, created_by_user_id FROM pg_temp.organizations',
      )

      assert.equal(organizations.rowCount, 1)
      assert.equal(organizations.rows[0].id, approved.organizationId)
      assert.equal(organizations.rows[0].status, 'provisioning')
      assert.equal(organizations.rows[0].legal_name, 'ASSOCIACAO SOLICITANTE')
      assert.equal(organizations.rows[0].created_by_user_id, requesterId)

      const roles = await pool.query<{
        name: string
        is_default: boolean
        is_director: boolean
        has_full_access: boolean
      }>(
        'SELECT name, is_default, is_director, has_full_access FROM pg_temp.roles ORDER BY name',
      )

      assert.deepEqual(roles.rows, [
        {
          name: 'Associado',
          is_default: true,
          is_director: false,
          has_full_access: false,
        },
        {
          name: 'Presidente',
          is_default: false,
          is_director: true,
          has_full_access: true,
        },
      ])

      const memberships = await pool.query<{
        user_id: string
        status: string
        role_id: string
      }>('SELECT user_id, status, role_id FROM pg_temp.memberships')

      assert.equal(memberships.rowCount, 1)
      assert.equal(memberships.rows[0].user_id, requesterId)
      assert.equal(memberships.rows[0].status, 'active')

      const requests = await pool.query<{
        status: string
        organization_id: string
        reviewed_by_user_id: string
      }>(
        'SELECT status, organization_id, reviewed_by_user_id FROM pg_temp.organization_requests',
      )

      assert.equal(requests.rows[0].status, 'approved')
      assert.equal(requests.rows[0].organization_id, approved.organizationId)
      assert.equal(requests.rows[0].reviewed_by_user_id, adminId)

      assert.deepEqual(
        await approveOrganizationRequest(adminId, request.id, database),
        { status: 'already-reviewed' },
      )
    })

    await t.test('rejects a request with a reason', async () => {
      const created = await requestOrganization(
        {
          actorUserId: requesterId,
          cnpj: SECOND_CNPJ,
          acronym: 'AS2',
          documentName: 'ata2.pdf',
          documentType: 'application/pdf',
          documentSize: document.byteLength,
          documentData: document,
        },
        database,
      )

      assert.equal(created.status, 'created')

      if (created.status !== 'created') throw new Error('Expected request')

      assert.deepEqual(
        await rejectOrganizationRequest(
          adminId,
          created.requestId,
          'Ata ilegível',
          database,
        ),
        { status: 'rejected' },
      )

      const rejected = await pool.query<{
        status: string
        rejection_reason: string
      }>(
        'SELECT status, rejection_reason FROM pg_temp.organization_requests WHERE id = $1',
        [created.requestId],
      )

      assert.deepEqual(rejected.rows[0], {
        status: 'rejected',
        rejection_reason: 'Ata ilegível',
      })
    })
    await t.test('lists request history by status', async () => {
      const approved = await listOrganizationRequests(
        adminId,
        'approved',
        {},
        database,
      )

      assert.equal(approved.status, 'ok')

      if (approved.status !== 'ok') throw new Error('Expected history')

      assert.equal(approved.requests.length, 1)
      assert.equal(approved.requests[0].status, 'approved')
      assert.notEqual(approved.requests[0].reviewedAt, null)
      assert.notEqual(approved.requests[0].organizationId, null)

      const rejected = await listOrganizationRequests(
        adminId,
        'rejected',
        {},
        database,
      )

      assert.equal(rejected.status, 'ok')

      if (rejected.status !== 'ok') throw new Error('Expected history')

      assert.equal(rejected.requests.length, 1)
      assert.equal(rejected.requests[0].status, 'rejected')
      assert.equal(rejected.requests[0].rejectionReason, 'Ata ilegível')

      const pending = await listOrganizationRequests(
        adminId,
        'pending',
        {},
        database,
      )

      assert.equal(pending.status, 'ok')

      if (pending.status !== 'ok') throw new Error('Expected history')

      assert.equal(pending.requests.length, 0)

      const byLegalName = await listOrganizationRequests(
        adminId,
        'approved',
        { query: 'ASSOCIACAO' },
        database,
      )

      assert.equal(byLegalName.status, 'ok')

      if (byLegalName.status !== 'ok') throw new Error('Expected history')

      assert.equal(byLegalName.requests.length, 1)

      const byRequester = await listOrganizationRequests(
        adminId,
        'approved',
        { query: 'requester' },
        database,
      )

      assert.equal(byRequester.status, 'ok')

      if (byRequester.status !== 'ok') throw new Error('Expected history')

      assert.equal(byRequester.requests.length, 1)

      const noResults = await listOrganizationRequests(
        adminId,
        'approved',
        { query: 'inexistente' },
        database,
      )

      assert.equal(noResults.status, 'ok')

      if (noResults.status !== 'ok') throw new Error('Expected history')

      assert.equal(noResults.requests.length, 0)

      const firstPage = await listOrganizationRequests(
        adminId,
        'approved',
        { limit: 1 },
        database,
      )

      assert.equal(firstPage.status, 'ok')

      if (firstPage.status !== 'ok') throw new Error('Expected history')

      assert.equal(firstPage.requests.length, 1)

      const secondPage = await listOrganizationRequests(
        adminId,
        'approved',
        { limit: 1, offset: 1 },
        database,
      )

      assert.equal(secondPage.status, 'ok')

      if (secondPage.status !== 'ok') throw new Error('Expected history')

      assert.equal(secondPage.requests.length, 0)

      assert.deepEqual(
        await listOrganizationRequests(requesterId, 'approved', {}, database),
        { status: 'forbidden' },
      )
    })
  } finally {
    fetchMock.mock.restore()
    await pool.end()
  }
})
