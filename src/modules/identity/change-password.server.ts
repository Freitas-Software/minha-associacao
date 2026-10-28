import 'server-only'
import { hash, verify } from '@node-rs/argon2'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, sessions, users } from '@/db/schema'

export type ChangePasswordResult =
  | { status: 'changed' }
  | { status: 'invalid-password' }
  | { status: 'same-password' }
  | { status: 'not-found' }

export async function changePassword(
  input: {
    userId: string
    currentSessionId: string
    currentPassword: string
    newPassword: string
  },
  database: typeof db = db,
): Promise<ChangePasswordResult> {
  const [account] = await database
    .select({
      id: accounts.id,
      passwordHash: accounts.passwordHash,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.id, users.accountId))
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!account) return { status: 'not-found' }

  const currentMatches = await verify(
    account.passwordHash,
    input.currentPassword,
  )

  if (!currentMatches) return { status: 'invalid-password' }

  if (input.currentPassword === input.newPassword) {
    return { status: 'same-password' }
  }

  const passwordHash = await hash(input.newPassword, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  })

  return database.transaction(async tx => {
    const [updated] = await tx
      .update(accounts)
      .set({ passwordHash })
      .where(eq(accounts.id, account.id))
      .returning({ id: accounts.id })

    if (!updated) return { status: 'not-found' as const }

    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.accountId, account.id),
          ne(sessions.id, input.currentSessionId),
          isNull(sessions.revokedAt),
        ),
      )

    return { status: 'changed' as const }
  })
}
