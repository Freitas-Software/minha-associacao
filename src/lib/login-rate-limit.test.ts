import assert from 'node:assert/strict'
import test from 'node:test'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'
import {
  releaseSuccessfulLoginAttempt,
  reserveLoginAttempt,
} from './login-rate-limit'

const connectionString = process.env.TEST_DATABASE_URL
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === '1'

test('limites persistidos no PostgreSQL, usando apenas tabela temporária', {
  skip: !connectionString || !runDatabaseTests,
}, async t => {
  // Uma conexão exclusiva mantém a tabela temporária isolada de dados reais.
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  })
  const database = drizzle({ client: pool, relations: defineRelations(schema) })
  try {
    await pool.query(`CREATE TEMP TABLE login_rate_limits (
      key varchar(64) PRIMARY KEY,
      count integer NOT NULL,
      window_started_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL
    )`)

    await t.test(
      'cinco falhas bloqueiam até uma tentativa de senha válida e outro CPF continua livre',
      async () => {
        for (let i = 0; i < 5; i++)
          assert.equal(
            (await reserveLoginAttempt('11111111111', '192.0.2.1', database))
              .allowed,
            true,
          )
        assert.equal(
          (await reserveLoginAttempt('11111111111', '192.0.2.1', database))
            .allowed,
          false,
        )
        assert.equal(
          (await reserveLoginAttempt('22222222222', '192.0.2.1', database))
            .allowed,
          true,
        )
        assert.equal(
          (await reserveLoginAttempt('11111111111', '192.0.2.2', database))
            .allowed,
          true,
        )
      },
    )

    await t.test(
      'sucesso devolve a reserva do par, mas mantém o orçamento global do IP',
      async () => {
        await pool.query('TRUNCATE pg_temp.login_rate_limits')
        for (let i = 0; i < 30; i++) {
          const reservation = await reserveLoginAttempt(
            '11111111111',
            '192.0.2.1',
            database,
          )
          assert.equal(reservation.allowed, true)
          if (reservation.allowed)
            await releaseSuccessfulLoginAttempt(reservation, database)
        }
        assert.equal(
          (await reserveLoginAttempt('22222222222', '192.0.2.1', database))
            .allowed,
          false,
        )
      },
    )

    await t.test(
      'trinta CPFs diferentes ou entradas inválidas esgotam o IP',
      async () => {
        await pool.query('TRUNCATE pg_temp.login_rate_limits')
        for (let i = 0; i < 30; i++)
          assert.equal(
            (
              await reserveLoginAttempt(
                i % 2 ? String(i) : null,
                '192.0.2.1',
                database,
              )
            ).allowed,
            true,
          )
        assert.equal(
          (await reserveLoginAttempt(null, '192.0.2.1', database)).allowed,
          false,
        )
      },
    )

    await t.test(
      'requisições sobrepostas reservam no máximo cinco verificações do par',
      async () => {
        await pool.query('TRUNCATE pg_temp.login_rate_limits')
        const outcomes = await Promise.all(
          Array.from({ length: 12 }, () =>
            reserveLoginAttempt('11111111111', '192.0.2.1', database),
          ),
        )
        assert.equal(outcomes.filter(r => r.allowed).length, 5)
      },
    )

    await t.test(
      'janela vencida permite login e conclusão atrasada não desconta a janela nova',
      async () => {
        await pool.query('TRUNCATE pg_temp.login_rate_limits')
        const old = await reserveLoginAttempt(
          '11111111111',
          '192.0.2.1',
          database,
        )
        assert.equal(old.allowed, true)
        await pool.query(
          `UPDATE pg_temp.login_rate_limits SET window_started_at = window_started_at - interval '15 minutes', expires_at = expires_at - interval '15 minutes', count = 30`,
        )
        const current = await reserveLoginAttempt(
          '11111111111',
          '192.0.2.1',
          database,
        )
        assert.equal(current.allowed, true)
        // Simula uma conclusão da janela que acabou de vencer.
        if (old.allowed)
          await releaseSuccessfulLoginAttempt(
            {
              ...old,
              windowStartedAt: new Date(old.windowStartedAt.getTime() - 900000),
            },
            database,
          )
        for (let i = 0; i < 4; i++)
          assert.equal(
            (await reserveLoginAttempt('11111111111', '192.0.2.1', database))
              .allowed,
            true,
          )
        assert.equal(
          (await reserveLoginAttempt('11111111111', '192.0.2.1', database))
            .allowed,
          false,
        )
      },
    )
  } finally {
    await pool.end()
  }
})
