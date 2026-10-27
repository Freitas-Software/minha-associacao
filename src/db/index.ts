import 'server-only'
import 'dotenv/config'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is necessary')

const relations = defineRelations(schema)

export const db = drizzle(process.env.DATABASE_URL, {
  logger: false,
  relations,
})
