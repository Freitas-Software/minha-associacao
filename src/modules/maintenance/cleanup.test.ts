import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { runCleanup } from './cleanup.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

test('operational cleanup on PostgreSQL, using temporary tables', {
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
      CREATE TEMP TABLE sessions (
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        idle_expires_at timestamptz NOT NULL,
        revoked_at timestamptz
      );
      CREATE TEMP TABLE registration_requests (
        id uuid PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE password_reset_requests (
        id uuid PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE login_rate_limits (
        key varchar(64) PRIMARY KEY,
        expires_at timestamptz NOT NULL
      )
    `)

    async function seed() {
      const now = new Date()
      const old = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
      const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      await pool.query(
        `INSERT INTO pg_temp.sessions
          (id, account_id, token_hash, expires_at, idle_expires_at, revoked_at)
         VALUES
          ($1, $2, $3, $4, $5, NULL),
          ($6, $2, $7, $8, $9, NULL),
          ($10, $2, $11, $8, $5, $4),
          ($12, $2, $13, $8, $8, NULL)`,
        [
          randomUUID(),
          randomUUID(),
          'a'.repeat(64),
          old,
          old,
          randomUUID(),
          'b'.repeat(64),
          future,
          old,
          randomUUID(),
          'c'.repeat(64),
          randomUUID(),
          'd'.repeat(64),
        ],
      )

      await pool.query(
        `INSERT INTO pg_temp.registration_requests (id, created_at)
         VALUES ($1, $2), ($3, $4)`,
        [randomUUID(), old, randomUUID(), recent],
      )
      await pool.query(
        `INSERT INTO pg_temp.password_reset_requests (id, created_at)
         VALUES ($1, $2), ($3, $4)`,
        [randomUUID(), old, randomUUID(), recent],
      )
      await pool.query(
        'INSERT INTO pg_temp.login_rate_limits (key, expires_at) VALUES ($1, $2), ($3, $4)',
        ['old-key', old, 'recent-key', recent],
      )
    }

    await t.test(
      'deletes only records beyond the retention window',
      async () => {
        await pool.query(
          'TRUNCATE pg_temp.sessions, pg_temp.registration_requests, pg_temp.password_reset_requests, pg_temp.login_rate_limits',
        )
        await seed()

        const result = await runCleanup(database)

        assert.deepEqual(result, {
          sessions: 3,
          registrationRequests: 1,
          passwordResetRequests: 1,
          loginRateLimits: 1,
        })

        const counts = await pool.query<{
          sessions: number
          registration_requests: number
          password_reset_requests: number
          login_rate_limits: number
        }>(
          `SELECT
          (SELECT count(*)::int FROM pg_temp.sessions) AS sessions,
          (SELECT count(*)::int FROM pg_temp.registration_requests) AS registration_requests,
          (SELECT count(*)::int FROM pg_temp.password_reset_requests) AS password_reset_requests,
          (SELECT count(*)::int FROM pg_temp.login_rate_limits) AS login_rate_limits`,
        )

        assert.deepEqual(counts.rows[0], {
          sessions: 1,
          registration_requests: 1,
          password_reset_requests: 1,
          login_rate_limits: 1,
        })
      },
    )

    await t.test(
      'is idempotent when there is nothing left to delete',
      async () => {
        assert.deepEqual(await runCleanup(database), {
          sessions: 0,
          registrationRequests: 0,
          passwordResetRequests: 0,
          loginRateLimits: 0,
        })
      },
    )

    await t.test('does not delete recent revoked sessions', async () => {
      await pool.query(
        'TRUNCATE pg_temp.sessions, pg_temp.registration_requests, pg_temp.password_reset_requests, pg_temp.login_rate_limits',
      )

      const now = new Date()

      await pool.query(
        `INSERT INTO pg_temp.sessions
          (id, account_id, token_hash, expires_at, idle_expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $4, $5)`,
        [
          randomUUID(),
          randomUUID(),
          'e'.repeat(64),
          new Date(now.getTime() + 24 * 60 * 60 * 1000),
          now,
        ],
      )

      const result = await runCleanup(database)

      assert.equal(result.sessions, 0)

      const sessions = await pool.query('SELECT id FROM pg_temp.sessions')

      assert.equal(sessions.rowCount, 1)
    })
  } finally {
    await pool.end()
  }
})
