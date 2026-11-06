import { describe } from 'vitest'

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL)

if (!hasDatabase && process.env.TEST_REQUIRE_DATABASE === '1') {
  throw new Error(
    'TEST_DATABASE_URL is required to run the integration test project.',
  )
}

/**
 * Database suites skip when no test database is available, so `pnpm test`
 * remains usable without PostgreSQL. CI sets TEST_DATABASE_URL and runs them.
 */
export const describeDatabase = hasDatabase ? describe : describe.skip
