import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import { getProfile, updateProfile } from './profile.server'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

type ServiceDatabase = NonNullable<Parameters<typeof getProfile>[1]>

test('profile on PostgreSQL, using temporary tables', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const client = await pool.connect()
  // Temporary tables are session-scoped, so the test keeps one client.
  const database = drizzle({
    client,
    relations: defineRelations(schema),
  }) as unknown as ServiceDatabase

  try {
    await client.query(`
      CREATE TEMP TABLE users (
        id uuid PRIMARY KEY,
        "accountId" uuid,
        name varchar(255) NOT NULL,
        document_number varchar(11) NOT NULL UNIQUE,
        email varchar(55) NOT NULL UNIQUE,
        email_verified_at timestamptz,
        phone varchar(11) NOT NULL,
        birth_date date NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        CONSTRAINT users_phone_unique UNIQUE (phone)
      )
    `)

    const userId = randomUUID()
    const otherId = randomUUID()

    await client.query(
      `INSERT INTO pg_temp.users
        (id, name, document_number, email, email_verified_at, phone, birth_date)
       VALUES
        ($1, 'Pessoa Teste', '52998224725', 'pessoa@example.test', now(), '11999999999', '1990-01-01'),
        ($2, 'Outra Pessoa', '11144477735', 'outra@example.test', now(), '11888888888', '1985-05-05')`,
      [userId, otherId],
    )

    await t.test('reads the profile', async () => {
      const profile = await getProfile(userId, database)

      assert.equal(profile?.name, 'Pessoa Teste')
      assert.equal(profile?.email, 'pessoa@example.test')
      assert.equal(profile?.phone, '11999999999')
    })

    await t.test('updates name and phone', async () => {
      assert.deepEqual(
        await updateProfile(
          {
            userId,
            data: { name: 'Pessoa Atualizada', phone: '11777777777' },
          },
          database,
        ),
        { status: 'updated' },
      )

      const profile = await getProfile(userId, database)

      assert.equal(profile?.name, 'Pessoa Atualizada')
      assert.equal(profile?.phone, '11777777777')
    })

    await t.test('rejects a phone already used by another person', async () => {
      assert.deepEqual(
        await updateProfile(
          {
            userId,
            data: { name: 'Pessoa Atualizada', phone: '11888888888' },
          },
          database,
        ),
        { status: 'phone-in-use' },
      )
    })

    await t.test('returns not found for an unknown user', async () => {
      assert.deepEqual(
        await updateProfile(
          {
            userId: randomUUID(),
            data: { name: 'Inexistente', phone: '11666666666' },
          },
          database,
        ),
        { status: 'not-found' },
      )

      assert.equal(await getProfile(randomUUID(), database), null)
    })
  } finally {
    client.release()
    await pool.end()
  }
})
