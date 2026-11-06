import { afterAll, beforeAll, beforeEach } from 'vitest'
import { createPool, truncatePublicTables } from './database'

const url = process.env.TEST_DATABASE_URL

let pool: ReturnType<typeof createPool> | null = null

beforeAll(() => {
  if (url) pool = createPool(url)
})

beforeEach(async () => {
  if (pool) await truncatePublicTables(pool)
})

afterAll(async () => {
  await pool?.end()
  pool = null
})
