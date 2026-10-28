import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { completeRegistration } from './complete-registration.server'
import { hashRegistrationToken } from './registration-token.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

const NEW_PASSWORD = 'correct horse battery staple'

test('registration completion on PostgreSQL, using temporary tables', {
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
        login text UNIQUE NOT NULL,
        password_hash text NOT NULL
      );
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid UNIQUE,
        name varchar(255) NOT NULL,
        document_number varchar(11) NOT NULL UNIQUE,
        email varchar(55) NOT NULL UNIQUE,
        email_verified_at timestamptz,
        phone varchar(11) NOT NULL UNIQUE,
        birth_date date NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
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

    async function reset() {
      await pool.query(
        'TRUNCATE pg_temp.accounts, pg_temp.users, pg_temp.registration_requests, pg_temp.registration_contact_conflicts',
      )
    }

    async function insertRequest(input: {
      token: string
      documentNumber: string
      email: string
      name?: string
      phone?: string
      userId?: string | null
      expiresAt?: Date
    }) {
      await pool.query(
        `INSERT INTO pg_temp.registration_requests
          (id, user_id, name, document_number, email, phone, birth_date, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          randomUUID(),
          input.userId ?? null,
          input.name ?? 'New Person',
          input.documentNumber,
          input.email,
          input.phone ?? '11999999999',
          '1990-01-01',
          hashRegistrationToken(input.token),
          input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
        ],
      )
    }

    async function insertUser(input: {
      documentNumber: string
      email: string
      accountId?: string | null
      name?: string
    }) {
      const id = randomUUID()

      await pool.query(
        `INSERT INTO pg_temp.users
          (id, "accountId", name, document_number, email, phone, birth_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          input.accountId ?? null,
          input.name ?? 'Pre Registered',
          input.documentNumber,
          input.email,
          '11988888888',
          '1985-05-05',
        ],
      )

      return id
    }

    await t.test(
      'creates an account and a verified user for a new person',
      async () => {
        await reset()

        const token = randomBytes(32).toString('base64url')
        const documentNumber = '11111111111'
        const email = 'new.person@example.test'

        await insertRequest({ token, documentNumber, email })

        const result = await completeRegistration(
          { token, password: NEW_PASSWORD },
          database,
        )

        assert.deepEqual(result, { status: 'completed' })

        const accounts = await pool.query<{
          id: string
          login: string
          password_hash: string
        }>('SELECT id, login, password_hash FROM pg_temp.accounts')

        assert.equal(accounts.rowCount, 1)
        assert.equal(accounts.rows[0].login, documentNumber)
        assert.ok(accounts.rows[0].password_hash.startsWith('$argon2id$'))
        assert.notEqual(accounts.rows[0].password_hash, NEW_PASSWORD)

        const users = await pool.query<{
          account_id: string
          name: string
          document_number: string
          email: string
          email_verified_at: Date | null
        }>(
          'SELECT "accountId" AS account_id, name, document_number, email, email_verified_at FROM pg_temp.users',
        )

        assert.equal(users.rowCount, 1)
        assert.equal(users.rows[0].account_id, accounts.rows[0].id)
        assert.equal(users.rows[0].name, 'New Person')
        assert.equal(users.rows[0].document_number, documentNumber)
        assert.equal(users.rows[0].email, email)
        assert.ok(users.rows[0].email_verified_at)

        const requests = await pool.query<{
          consumed_at: Date | null
        }>('SELECT consumed_at FROM pg_temp.registration_requests')

        assert.equal(requests.rowCount, 1)
        assert.ok(requests.rows[0].consumed_at)

        assert.deepEqual(
          await completeRegistration(
            { token, password: NEW_PASSWORD },
            database,
          ),
          { status: 'invalid-link' },
        )

        const counts = await pool.query<{ accounts: number; users: number }>(
          `SELECT
          (SELECT count(*)::int FROM pg_temp.accounts) AS accounts,
          (SELECT count(*)::int FROM pg_temp.users) AS users`,
        )

        assert.deepEqual(counts.rows[0], { accounts: 1, users: 1 })
      },
    )

    await t.test(
      'links a pre-registered user without duplicating the profile',
      async () => {
        await reset()

        const token = randomBytes(32).toString('base64url')
        const documentNumber = '22222222222'
        const email = 'pre.registered@example.test'
        const userId = await insertUser({ documentNumber, email })

        await insertRequest({
          token,
          documentNumber,
          email,
          userId,
          name: 'Ignored Name',
        })

        const result = await completeRegistration(
          { token, password: NEW_PASSWORD },
          database,
        )

        assert.deepEqual(result, { status: 'completed' })

        const users = await pool.query<{
          account_id: string | null
          name: string
          email_verified_at: Date | null
        }>(
          'SELECT "accountId" AS account_id, name, email_verified_at FROM pg_temp.users',
        )

        assert.equal(users.rowCount, 1)
        assert.equal(users.rows[0].name, 'Pre Registered')
        assert.ok(users.rows[0].account_id)
        assert.ok(users.rows[0].email_verified_at)

        const accounts = await pool.query('SELECT id FROM pg_temp.accounts')

        assert.equal(accounts.rowCount, 1)
        assert.equal(users.rows[0].account_id, accounts.rows[0].id)
      },
    )

    await t.test(
      'rejects a request linked to a different profile',
      async () => {
        await reset()

        const token = randomBytes(32).toString('base64url')
        const documentNumber = '33333333333'
        const email = 'profile@example.test'

        await insertUser({ documentNumber, email })
        await insertRequest({
          token,
          documentNumber,
          email,
          userId: randomUUID(),
        })

        assert.deepEqual(
          await completeRegistration(
            { token, password: NEW_PASSWORD },
            database,
          ),
          { status: 'invalid-link' },
        )

        const accounts = await pool.query('SELECT id FROM pg_temp.accounts')

        assert.equal(accounts.rowCount, 0)
      },
    )

    await t.test(
      'rejects a request when the profile email changed',
      async () => {
        await reset()

        const token = randomBytes(32).toString('base64url')
        const documentNumber = '44444444444'
        const email = 'old@example.test'
        const userId = await insertUser({ documentNumber, email })

        await insertRequest({
          token,
          documentNumber,
          email: 'new@example.test',
          userId,
        })

        assert.deepEqual(
          await completeRegistration(
            { token, password: NEW_PASSWORD },
            database,
          ),
          { status: 'invalid-link' },
        )
      },
    )

    await t.test('rejects expired tokens and existing accounts', async () => {
      await reset()

      const expiredToken = randomBytes(32).toString('base64url')
      const expiredDocument = '55555555555'

      await insertRequest({
        token: expiredToken,
        documentNumber: expiredDocument,
        email: 'expired@example.test',
        expiresAt: new Date(Date.now() - 60 * 1000),
      })

      assert.deepEqual(
        await completeRegistration(
          { token: expiredToken, password: NEW_PASSWORD },
          database,
        ),
        { status: 'invalid-link' },
      )

      await reset()

      const token = randomBytes(32).toString('base64url')
      const documentNumber = '66666666666'
      const account = await pool.query<{ id: string }>(
        `INSERT INTO pg_temp.accounts (id, login, password_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        [randomUUID(), documentNumber, 'existing-hash'],
      )

      await insertUser({
        documentNumber,
        email: 'existing@example.test',
        accountId: account.rows[0].id,
      })
      await insertRequest({
        token,
        documentNumber,
        email: 'existing@example.test',
      })

      assert.deepEqual(
        await completeRegistration({ token, password: NEW_PASSWORD }, database),
        { status: 'invalid-link' },
      )

      const accounts = await pool.query('SELECT id FROM pg_temp.accounts')

      assert.equal(accounts.rowCount, 1)
    })

    await t.test(
      'rejects an unknown token without creating records',
      async () => {
        await reset()

        assert.deepEqual(
          await completeRegistration(
            {
              token: randomBytes(32).toString('base64url'),
              password: NEW_PASSWORD,
            },
            database,
          ),
          { status: 'invalid-link' },
        )

        const counts = await pool.query<{ accounts: number; users: number }>(
          `SELECT
          (SELECT count(*)::int FROM pg_temp.accounts) AS accounts,
          (SELECT count(*)::int FROM pg_temp.users) AS users`,
        )

        assert.deepEqual(counts.rows[0], { accounts: 0, users: 0 })
      },
    )
  } finally {
    await pool.end()
  }
})
