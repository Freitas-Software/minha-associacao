import { prepareTestDatabase } from './database'

/**
 * Rebuilds the dedicated test database once before the integration project.
 * When no test database is configured, integration suites skip themselves.
 */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL

  if (!url) {
    if (process.env.TEST_REQUIRE_DATABASE === '1') {
      throw new Error(
        'TEST_DATABASE_URL is required for the integration test project.',
      )
    }

    console.warn(
      '[integration] TEST_DATABASE_URL is not set; database suites will be skipped.',
    )
    return
  }

  await prepareTestDatabase(url)
}
