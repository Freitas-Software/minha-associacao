import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import {
  reserveLoginAttempt,
  reservePasswordResetAttempt,
} from './login-rate-limit'
import {
  completePasswordReset,
  hasUsablePasswordReset,
  preparePasswordReset,
} from './password-reset'
import { insertSessionForCredentials } from './session-credentials'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

test('recuperação de senha no PostgreSQL, somente em tabelas temporárias', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const database = drizzle({ client: pool, relations: defineRelations(schema) })
  try {
    await pool.query(`CREATE TEMP TABLE accounts (id uuid PRIMARY KEY, login text UNIQUE NOT NULL, password_hash text NOT NULL);
      CREATE TEMP TABLE users (id uuid PRIMARY KEY, "accountId" uuid, email varchar(55) NOT NULL);
      CREATE TEMP TABLE password_reset_requests (id uuid PRIMARY KEY, account_id uuid NOT NULL, email varchar(55) NOT NULL, token_hash varchar(64) UNIQUE NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, invalidated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TEMP TABLE sessions (id uuid PRIMARY KEY, account_id uuid NOT NULL, token_hash varchar(64) UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, idle_expires_at timestamptz NOT NULL, revoked_at timestamptz);
      CREATE TEMP TABLE login_rate_limits (key varchar(64) PRIMARY KEY, count integer NOT NULL, window_started_at timestamptz NOT NULL, expires_at timestamptz NOT NULL)`)
    const accountId = randomUUID()
    const otherId = randomUUID()
    const cpf = '52998224725'
    const seed = async () => {
      await pool.query(
        'TRUNCATE pg_temp.accounts, pg_temp.users, pg_temp.password_reset_requests, pg_temp.sessions, pg_temp.login_rate_limits',
      )
      await pool.query(
        'INSERT INTO pg_temp.accounts VALUES ($1, $2, $3), ($4, $5, $3)',
        [accountId, cpf, 'hash-anterior-fixture', otherId, 'outro-cpf-fixture'],
      )
      await pool.query('INSERT INTO pg_temp.users VALUES ($1, $2, $3)', [
        randomUUID(),
        accountId,
        'titular@example.test',
      ])
      for (const id of [accountId, accountId, otherId])
        await pool.query(
          "INSERT INTO pg_temp.sessions (id, account_id, token_hash, expires_at, idle_expires_at) VALUES ($1, $2, $3, now() + interval '30 days', now() + interval '7 days')",
          [randomUUID(), id, randomUUID()],
        )
    }
    await t.test(
      'envia para email atual, não revela desconhecidos e exige intervalo entre reenvios',
      async () => {
        await seed()
        const first = await preparePasswordReset(cpf, database)
        assert.ok(first)
        assert.equal(first.email, 'titular@example.test')
        assert.equal(await preparePasswordReset(cpf, database), null)
        assert.equal(await preparePasswordReset('inexistente', database), null)
        await pool.query(
          "UPDATE pg_temp.login_rate_limits SET expires_at = now() - interval '1 second'",
        )
        const second = await preparePasswordReset(cpf, database)
        assert.ok(second)
        assert.notEqual(second.token, first.token)
        assert.equal(await hasUsablePasswordReset(first.token, database), false)
        assert.equal(
          await completePasswordReset(first.token, 'novo-fixture', database),
          false,
        )
        assert.equal(await hasUsablePasswordReset(second.token, database), true)
        const stored = await pool.query(
          'SELECT token_hash FROM pg_temp.password_reset_requests',
        )
        assert.ok(
          stored.rows.every(
            row =>
              row.token_hash !== first.token && row.token_hash !== second.token,
          ),
        )
      },
    )
    await t.test(
      'troca atômica, uso único e revogação limitada à conta do token',
      async () => {
        await seed()
        const request = await preparePasswordReset(cpf, database)
        assert.ok(request)
        assert.equal(
          await completePasswordReset(request.token, 'novo-fixture', database),
          true,
        )
        assert.equal(
          await completePasswordReset(request.token, 'outro-fixture', database),
          false,
        )
        assert.equal(
          await hasUsablePasswordReset(request.token, database),
          false,
        )
        const account = await pool.query(
          'SELECT password_hash FROM pg_temp.accounts WHERE id = $1',
          [accountId],
        )
        assert.equal(account.rows[0].password_hash, 'novo-fixture')
        const revoked = await pool.query(
          'SELECT account_id, revoked_at FROM pg_temp.sessions',
        )
        assert.ok(
          revoked.rows
            .filter(row => row.account_id === accountId)
            .every(row => row.revoked_at),
        )
        assert.ok(
          revoked.rows
            .filter(row => row.account_id === otherId)
            .every(row => !row.revoked_at),
        )
        assert.equal(
          await insertSessionForCredentials(
            accountId,
            'hash-anterior-fixture',
            {
              tokenHash: randomUUID(),
              expiresAt: new Date(Date.now() + 60000),
              idleExpiresAt: new Date(Date.now() + 60000),
            },
            database,
          ),
          null,
        )
        assert.ok(
          await insertSessionForCredentials(
            accountId,
            'novo-fixture',
            {
              tokenHash: randomUUID(),
              expiresAt: new Date(Date.now() + 60000),
              idleExpiresAt: new Date(Date.now() + 60000),
            },
            database,
          ),
        )
      },
    )
    await t.test(
      'token vencido e email alterado não trocam senha',
      async () => {
        await seed()
        const request = await preparePasswordReset(cpf, database)
        assert.ok(request)
        await pool.query(
          "UPDATE pg_temp.password_reset_requests SET expires_at = now() - interval '1 second'",
        )
        assert.equal(
          await completePasswordReset(request.token, 'novo-fixture', database),
          false,
        )
        await pool.query(
          "UPDATE pg_temp.password_reset_requests SET expires_at = now() + interval '30 minutes'",
        )
        await pool.query('UPDATE pg_temp.users SET email = $1', [
          'outro@example.test',
        ])
        assert.equal(
          await hasUsablePasswordReset(request.token, database),
          false,
        )
        assert.equal(
          await completePasswordReset(request.token, 'novo-fixture', database),
          false,
        )
      },
    )
    await t.test(
      'duas conclusões sobrepostas produzem somente um sucesso',
      async () => {
        await seed()
        const request = await preparePasswordReset(cpf, database)
        assert.ok(request)
        const results = await Promise.all([
          completePasswordReset(request.token, 'primeiro-fixture', database),
          completePasswordReset(request.token, 'segundo-fixture', database),
        ])
        assert.equal(results.filter(Boolean).length, 1)
      },
    )
    await t.test(
      'falha na revogação desfaz troca de senha e consumo do link',
      async () => {
        await seed()
        const request = await preparePasswordReset(cpf, database)
        assert.ok(request)
        await pool.query(
          'ALTER TABLE pg_temp.sessions ADD CONSTRAINT reject_revocation CHECK (revoked_at IS NULL)',
        )
        try {
          await assert.rejects(() =>
            completePasswordReset(request.token, 'novo-fixture', database),
          )
          assert.equal(
            await hasUsablePasswordReset(request.token, database),
            true,
          )
          const account = await pool.query(
            'SELECT password_hash FROM pg_temp.accounts WHERE id = $1',
            [accountId],
          )
          assert.equal(account.rows[0].password_hash, 'hash-anterior-fixture')
        } finally {
          await pool.query(
            'ALTER TABLE pg_temp.sessions DROP CONSTRAINT reject_revocation',
          )
        }
      },
    )
    await t.test(
      'orçamentos por IP de login, solicitação e conclusão são independentes',
      async () => {
        await seed()
        for (let i = 0; i < 30; i++)
          assert.equal(
            await reservePasswordResetAttempt(
              'request',
              '192.0.2.10',
              database,
            ),
            true,
          )
        assert.equal(
          await reservePasswordResetAttempt('request', '192.0.2.10', database),
          false,
        )
        assert.equal(
          await reservePasswordResetAttempt('complete', '192.0.2.10', database),
          true,
        )
        assert.equal(
          (await reserveLoginAttempt(cpf, '192.0.2.10', database)).allowed,
          true,
        )
      },
    )
  } finally {
    await pool.end()
  }
})
