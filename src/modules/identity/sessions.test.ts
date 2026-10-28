import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { listActiveSessions, revokeSession } from './sessions.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

type ServiceDatabase = NonNullable<Parameters<typeof listActiveSessions>[2]>

test('sessions on PostgreSQL, using temporary tables', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const client = await pool.connect()
  const database = drizzle({
    client,
    relations: defineRelations(schema),
  }) as unknown as ServiceDatabase

  try {
    await client.query(`
      CREATE TEMP TABLE accounts (
        id uuid PRIMARY KEY
      );
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid
      );
      CREATE TEMP TABLE sessions (
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        idle_expires_at timestamptz NOT NULL,
        revoked_at timestamptz
      )
    `)

    const accountId = randomUUID()
    const userId = randomUUID()
    const otherAccountId = randomUUID()
    const currentSessionId = randomUUID()
    const otherSessionId = randomUUID()
    const revokedSessionId = randomUUID()
    const expiredSessionId = randomUUID()
    const foreignSessionId = randomUUID()
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const past = new Date(Date.now() - 60 * 1000)

    await client.query('INSERT INTO pg_temp.accounts (id) VALUES ($1), ($2)', [
      accountId,
      otherAccountId,
    ])
    await client.query(
      'INSERT INTO pg_temp.users (id, "accountId") VALUES ($1, $2)',
      [userId, accountId],
    )
    await client.query(
      `INSERT INTO pg_temp.sessions
        (id, account_id, token_hash, expires_at, idle_expires_at, revoked_at)
       VALUES
        ($1, $2, $3, $4, $4, NULL),
        ($5, $2, $6, $4, $4, NULL),
        ($7, $2, $8, $4, $4, now()),
        ($9, $2, $10, $11, $11, NULL),
        ($12, $13, $14, $4, $4, NULL)`,
      [
        currentSessionId,
        accountId,
        'a'.repeat(64),
        future,
        otherSessionId,
        'b'.repeat(64),
        revokedSessionId,
        'c'.repeat(64),
        expiredSessionId,
        'd'.repeat(64),
        past,
        foreignSessionId,
        otherAccountId,
        'e'.repeat(64),
      ],
    )

    await t.test(
      'lists only active sessions and marks the current one',
      async () => {
        const result = await listActiveSessions(
          userId,
          currentSessionId,
          database,
        )

        assert.equal(result.status, 'ok')

        if (result.status !== 'ok') throw new Error('Expected sessions')

        assert.deepEqual(
          result.sessions.map(session => session.id).sort(),
          [currentSessionId, otherSessionId].sort(),
        )
        assert.equal(
          result.sessions.find(session => session.id === currentSessionId)
            ?.isCurrent,
          true,
        )
      },
    )

    await t.test(
      'revokes another session but not the current one',
      async () => {
        assert.deepEqual(
          await revokeSession(
            {
              userId,
              currentSessionId,
              sessionId: otherSessionId,
            },
            database,
          ),
          { status: 'revoked' },
        )

        assert.deepEqual(
          await revokeSession(
            {
              userId,
              currentSessionId,
              sessionId: currentSessionId,
            },
            database,
          ),
          { status: 'current-session' },
        )

        const result = await listActiveSessions(
          userId,
          currentSessionId,
          database,
        )

        assert.equal(result.status, 'ok')

        if (result.status !== 'ok') throw new Error('Expected sessions')

        assert.deepEqual(
          result.sessions.map(session => session.id),
          [currentSessionId],
        )
      },
    )

    await t.test('does not revoke a session from another account', async () => {
      assert.deepEqual(
        await revokeSession(
          {
            userId,
            currentSessionId,
            sessionId: foreignSessionId,
          },
          database,
        ),
        { status: 'not-found' },
      )
    })
  } finally {
    client.release()
    await pool.end()
  }
})
