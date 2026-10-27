import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, sessions } from '@/db/schema'

type SessionValues = Pick<
  typeof sessions.$inferInsert,
  'tokenHash' | 'createdAt' | 'lastSeenAt' | 'expiresAt' | 'idleExpiresAt'
>

export async function insertSessionForCredentials(
  accountId: string,
  expectedPasswordHash: string,
  values: SessionValues,
  database: typeof db = db,
) {
  return database.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '3s'`)
    const [account] = await tx
      .select({ passwordHash: accounts.passwordHash })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)
      .for('update')
    // A troca de senha e a emissão da sessão se serializam pelo registro da conta.
    if (!account || account.passwordHash !== expectedPasswordHash) return null
    const [session] = await tx
      .insert(sessions)
      .values({ accountId, ...values })
      .returning({ id: sessions.id })
    return session ?? null
  })
}
