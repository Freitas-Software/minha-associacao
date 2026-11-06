import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle')

/** Reference data seeded by the migrations; never truncated between tests. */
const PRESERVED_TABLES = new Set(['permissions'])

export function getTestDatabaseUrl(): string | undefined {
  return process.env.TEST_DATABASE_URL
}

export function requireTestDatabaseUrl(): string {
  const url = getTestDatabaseUrl()

  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required. Create a dedicated PostgreSQL database and set it in .env.test.local.',
    )
  }

  return url
}

export function getDatabaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1))

  if (!name)
    throw new Error(`The database URL does not contain a database name.`)

  return name
}

/**
 * Destructive helpers only run against databases whose name contains "test".
 * This prevents a misconfigured TEST_DATABASE_URL from resetting development data.
 */
export function assertSafeTestDatabase(url: string) {
  const name = getDatabaseName(url)

  if (!/test/i.test(name) && process.env.TEST_DATABASE_ALLOW_UNSAFE !== '1') {
    throw new Error(
      `Refusing to reset database "${name}": the database name must contain "test". Set TEST_DATABASE_ALLOW_UNSAFE=1 only for disposable databases.`,
    )
  }
}

export function createPool(url: string, max = 1): Pool {
  return new Pool({
    connectionString: url,
    max,
    connectionTimeoutMillis: 5_000,
  })
}

export function createDatabase(pool: Pool) {
  return drizzle({ client: pool, relations: defineRelations(schema) })
}

export type TestDatabase = ReturnType<typeof createDatabase>

async function ensureDatabase(url: string) {
  assertSafeTestDatabase(url)

  const name = getDatabaseName(url)
  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'

  const admin = createPool(adminUrl.toString())

  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    )

    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(name)}`)
    }
  } finally {
    await admin.end()
  }
}

export async function resetDatabase(pool: Pool) {
  await pool.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    CREATE SCHEMA public;
  `)
}

export async function applyMigrations(pool: Pool) {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true })
  const migrationDirectories = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  for (const directory of migrationDirectories) {
    const sql = await readFile(
      join(MIGRATIONS_DIR, directory, 'migration.sql'),
      'utf8',
    )

    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()

      if (trimmed) await pool.query(trimmed)
    }
  }
}

/**
 * Creates the test database when missing, then rebuilds its schema from the
 * Drizzle migration folders. The schema is recreated, never patched.
 */
export async function prepareTestDatabase(url: string) {
  assertSafeTestDatabase(url)
  await ensureDatabase(url)

  const pool = createPool(url)

  try {
    await resetDatabase(pool)
    await applyMigrations(pool)
  } finally {
    await pool.end()
  }
}

export async function truncatePublicTables(pool: Pool) {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'`,
  )

  const tables = rows
    .map(row => row.tablename)
    .filter(table => !PRESERVED_TABLES.has(table))

  if (tables.length === 0) return

  const list = tables
    .map(table => `"public".${quoteIdentifier(table)}`)
    .join(', ')

  await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`
}
