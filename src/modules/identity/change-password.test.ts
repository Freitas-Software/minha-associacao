import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { hash, verify } from '@node-rs/argon2'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { changePassword } from './change-password.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'
const PASSWORD = 'uma senha bem longa 123'
const NEW_PASSWORD = 'outra senha bem longa 456'

type ServiceDatabase = NonNullable<Parameters<typeof changePassword>[1]>

test('change password on PostgreSQL, using temporary tables', {
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
        id uuid PRIMARY KEY,
        login varchar(11) NOT NULL UNIQUE,
        password_hash text NOT NULL
      );
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid
      );
      CREATE TEMP TABLE sessions (
        id uuid PRIMARY KEY,
        account_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        revoked_at timestamptz
      )
    `)

    const passwordHash = await hash(PASSWORD, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    })

    const userId = randomUUID()
    const accountId = randomUUID()
    const currentSessionId = randomUUID()
    const otherSessionId = randomUUID()

    await client.query(
      `INSERT INTO pg_temp.accounts (id, login, password_hash)
       VALUES ($1, '52998224725', $2)`,
      [accountId, passwordHash],
    )
    await client.query(
      `INSERT INTO pg_temp.users (id, "accountId") VALUES ($1, $2)`,
      [userId, accountId],
    )
    await client.query(
      `INSERT INTO pg_temp.sessions (id, account_id, token_hash)
       VALUES ($1, $2, $3), ($4, $2, $5)`,
      [
        currentSessionId,
        accountId,
        'a'.repeat(64),
        otherSessionId,
        'b'.repeat(64),
      ],
    )

    await t.test('rejects an incorrect current password', async () => {
      assert.deepEqual(
        await changePassword(
          {
            userId,
            currentSessionId,
            currentPassword: 'senha errada e longa',
            newPassword: NEW_PASSWORD,
          },
          database,
        ),
        { status: 'invalid-password' },
      )
    })

    await t.test('rejects the same password', async () => {
      assert.deepEqual(
        await changePassword(
          {
            userId,
            currentSessionId,
            currentPassword: PASSWORD,
            newPassword: PASSWORD,
          },
          database,
        ),
        { status: 'same-password' },
      )
    })

    await t.test(
      'changes the password and revokes other sessions',
      async () => {
        assert.deepEqual(
          await changePassword(
            {
              userId,
              currentSessionId,
              currentPassword: PASSWORD,
              newPassword: NEW_PASSWORD,
            },
            database,
          ),
          { status: 'changed' },
        )

        const account = await client.query<{ password_hash: string }>(
          'SELECT password_hash FROM pg_temp.accounts WHERE id = $1',
          [accountId],
        )

        assert.equal(
          await verify(account.rows[0].password_hash, PASSWORD),
          false,
        )
        assert.equal(
          await verify(account.rows[0].password_hash, NEW_PASSWORD),
          true,
        )

        const sessions = await client.query<{
          id: string
          revoked_at: Date | null
        }>('SELECT id, revoked_at FROM pg_temp.sessions ORDER BY id')

        const current = sessions.rows.find(row => row.id === currentSessionId)
        const other = sessions.rows.find(row => row.id === otherSessionId)

        assert.equal(current?.revoked_at, null)
        assert.notEqual(other?.revoked_at, null)
      },
    )
  } finally {
    client.release()
    await pool.end()
  }
})
