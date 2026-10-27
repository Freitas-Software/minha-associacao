import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { insertSessionForCredentials } from './session-credentials'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

test('session creation on PostgreSQL, using temporary tables', {
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
      CREATE TEMP TABLE sessions (
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        idle_expires_at timestamptz NOT NULL,
        revoked_at timestamptz
      )
    `)

    const accountId = randomUUID()
    const passwordHash = 'stored-password-hash'
    const now = new Date()

    const values = {
      tokenHash: 'f'.repeat(64),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      idleExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    }

    await pool.query(
      'INSERT INTO pg_temp.accounts (id, login, password_hash) VALUES ($1, $2, $3)',
      [accountId, '12345678901', passwordHash],
    )

    await t.test('rejects a session when the password changed', async () => {
      const session = await insertSessionForCredentials(
        accountId,
        'previous-password-hash',
        values,
        database,
      )

      assert.equal(session, null)

      const sessions = await pool.query('SELECT id FROM pg_temp.sessions')

      assert.equal(sessions.rowCount, 0)
    })

    await t.test('creates a session for the current password', async () => {
      const session = await insertSessionForCredentials(
        accountId,
        passwordHash,
        { ...values, tokenHash: 'e'.repeat(64) },
        database,
      )

      assert.ok(session?.id)

      const sessions = await pool.query<{ account_id: string }>(
        'SELECT account_id FROM pg_temp.sessions',
      )

      assert.equal(sessions.rowCount, 1)
      assert.equal(sessions.rows[0].account_id, accountId)
    })
  } finally {
    await pool.end()
  }
})
