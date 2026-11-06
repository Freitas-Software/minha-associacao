import {
  prepareTestDatabase,
  requireTestDatabaseUrl,
} from '../support/database'
import { loadTestEnv } from '../support/env'
import { seedTestData } from '../support/seed'

loadTestEnv()

async function main() {
  const url = process.env.E2E_DATABASE_URL ?? requireTestDatabaseUrl()

  await prepareTestDatabase(url)
  await seedTestData(url)

  console.log('[e2e] test database prepared and seeded')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
