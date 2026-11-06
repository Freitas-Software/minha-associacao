import {
  createDatabase,
  createPool,
  type TestDatabase,
} from '@tests/support/database'
import { describeDatabase } from '@tests/support/database-suite'
import {
  ORGANIZATION,
  ORGANIZATION_ID,
  PRESIDENT_USER_ID,
} from '@tests/support/fixtures'
import { seedTestData } from '@tests/support/seed'
import type { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import {
  getOrganizationSummary,
  listRoles,
} from '@/modules/organizations/organization.server'

const url = process.env.TEST_DATABASE_URL

describeDatabase('application modules against the migrated schema', () => {
  let pool: Pool | undefined
  let database: TestDatabase | undefined

  beforeAll(() => {
    if (!url) return
    pool = createPool(url)
    database = createDatabase(pool)
  })

  beforeEach(async () => {
    if (url) await seedTestData(url)
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('returns the seeded organization for its president', async () => {
    if (!database) return

    const summary = await getOrganizationSummary(
      PRESIDENT_USER_ID,
      ORGANIZATION_ID,
      database,
    )

    expect(summary.status).toBe('ok')

    if (summary.status !== 'ok') throw new Error('Expected organization access')

    expect(summary.organization.legalName).toBe(ORGANIZATION.legalName)
    expect(summary.organization.status).toBe('active')
    expect(summary.access.hasFullAccess).toBe(true)
  })

  it('lists the seeded roles ordered by name', async () => {
    if (!database) return

    const result = await listRoles(PRESIDENT_USER_ID, ORGANIZATION_ID, database)

    expect(result.status).toBe('ok')

    if (result.status !== 'ok') throw new Error('Expected roles')

    expect(result.roles.map(role => role.name).sort()).toEqual([
      ORGANIZATION.defaultRoleName,
      ORGANIZATION.presidentRoleName,
    ])
  })

  it('rejects a duplicate CPF at the database constraint', async () => {
    if (!pool) return

    await expect(
      pool.query(
        `INSERT INTO users (id, name, document_number, email, phone, birth_date)
         VALUES ('0199a6a0-0000-7000-8000-000000000099', 'Duplicate',
                 '52998224725', 'duplicate@example.test', '11999990009', '1990-01-01')`,
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })
})
