import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { hash } from '@node-rs/argon2'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import {
  confirmEmailChange,
  createEmailChangeRequest,
} from './email-change.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'
const PASSWORD = 'uma senha bem longa 123'

type ServiceDatabase = NonNullable<
  Parameters<typeof createEmailChangeRequest>[1]
>

test('email change on PostgreSQL, using temporary tables', {
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
      CREATE TEMP TABLE email_change_requests (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        new_email varchar(55) NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        invalidated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
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

    await client.query(
      `INSERT INTO pg_temp.accounts (id, login, password_hash)
       VALUES ($1, '52998224725', $2)`,
      [accountId, passwordHash],
    )
    await client.query(
      `INSERT INTO pg_temp.users
        (id, "accountId", name, document_number, email, email_verified_at, phone, birth_date)
       VALUES
        ($1, $2, 'Pessoa Teste', '52998224725', 'atual@example.test', now(), '11999999999', '1990-01-01'),
        ($3, NULL, 'Outra Pessoa', '11144477735', 'usado@example.test', now(), '11888888888', '1985-05-05')`,
      [userId, accountId, randomUUID()],
    )

    let token = ''

    async function ageRequests() {
      await client.query(
        "UPDATE pg_temp.email_change_requests SET created_at = now() - interval '2 minutes'",
      )
    }

    await t.test('creates a confirmation request for a new email', async () => {
      const result = await createEmailChangeRequest(
        {
          userId,
          data: { newEmail: 'novo@example.test', password: PASSWORD },
        },
        database,
      )

      assert.equal(result.status, 'link-sent')

      if (result.status !== 'link-sent') throw new Error('Expected link')

      token = result.token

      const requests = await client.query<{
        new_email: string
        user_id: string
      }>('SELECT new_email, user_id FROM pg_temp.email_change_requests')

      assert.equal(requests.rowCount, 1)
      assert.equal(requests.rows[0].new_email, 'novo@example.test')
      assert.equal(requests.rows[0].user_id, userId)
    })

    await t.test('rejects an invalid password', async () => {
      assert.deepEqual(
        await createEmailChangeRequest(
          {
            userId,
            data: {
              newEmail: 'outro@example.test',
              password: 'senha incorreta e longa',
            },
          },
          database,
        ),
        { status: 'invalid-password' },
      )
    })

    await t.test('rejects the current email', async () => {
      assert.deepEqual(
        await createEmailChangeRequest(
          {
            userId,
            data: { newEmail: 'atual@example.test', password: PASSWORD },
          },
          database,
        ),
        { status: 'same-email' },
      )
    })

    await t.test('rejects an email used by another person', async () => {
      assert.deepEqual(
        await createEmailChangeRequest(
          {
            userId,
            data: { newEmail: 'usado@example.test', password: PASSWORD },
          },
          database,
        ),
        { status: 'email-in-use' },
      )
    })

    await t.test('rate limits repeated requests', async () => {
      assert.deepEqual(
        await createEmailChangeRequest(
          {
            userId,
            data: { newEmail: 'segundo@example.test', password: PASSWORD },
          },
          database,
        ),
        { status: 'rate-limited' },
      )
    })

    await t.test('confirms the change and consumes the request', async () => {
      assert.deepEqual(await confirmEmailChange({ userId, token }, database), {
        status: 'confirmed',
      })

      const user = await client.query<{
        email: string
        email_verified_at: Date | null
      }>('SELECT email, email_verified_at FROM pg_temp.users WHERE id = $1', [
        userId,
      ])

      assert.equal(user.rows[0].email, 'novo@example.test')
      assert.notEqual(user.rows[0].email_verified_at, null)

      const request = await client.query<{ consumed_at: Date | null }>(
        'SELECT consumed_at FROM pg_temp.email_change_requests WHERE user_id = $1',
        [userId],
      )

      assert.notEqual(request.rows[0].consumed_at, null)
    })

    await t.test('rejects confirmation by another user', async () => {
      await ageRequests()

      const result = await createEmailChangeRequest(
        {
          userId,
          data: { newEmail: 'terceiro@example.test', password: PASSWORD },
        },
        database,
      )

      assert.equal(result.status, 'link-sent')

      if (result.status !== 'link-sent') throw new Error('Expected link')

      assert.deepEqual(
        await confirmEmailChange(
          { userId: randomUUID(), token: result.token },
          database,
        ),
        { status: 'invalid-link' },
      )
    })

    await t.test(
      'rejects confirmation when the email became occupied',
      async () => {
        await ageRequests()

        const result = await createEmailChangeRequest(
          {
            userId,
            data: { newEmail: 'ocupado@example.test', password: PASSWORD },
          },
          database,
        )

        assert.equal(result.status, 'link-sent')

        if (result.status !== 'link-sent') throw new Error('Expected link')

        await client.query(
          `INSERT INTO pg_temp.users
          (id, "accountId", name, document_number, email, email_verified_at, phone, birth_date)
         VALUES ($1, NULL, 'Ocupante', '39053344705', 'ocupado@example.test', now(), '11777777777', '1980-01-01')`,
          [randomUUID()],
        )

        assert.deepEqual(
          await confirmEmailChange({ userId, token: result.token }, database),
          { status: 'email-in-use' },
        )
      },
    )
  } finally {
    client.release()
    await pool.end()
  }
})
