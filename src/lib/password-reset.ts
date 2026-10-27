import 'server-only'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  accounts,
  loginRateLimits,
  passwordResetRequests,
  sessions,
  users,
} from '@/db/schema'
import { loginBucketKey } from './login-rate-limit-policy'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_RESEND_INTERVAL_MS,
} from './password-reset-token'

// O limite por CPF também vale para identidades inexistentes, independentemente do IP.
export async function preparePasswordReset(
  documentNumber: string,
  database: typeof db = db,
) {
  return database.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '3s'`)
    const key = loginBucketKey('password-reset-cpf', documentNumber)
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    )
    const clock = await tx.execute<{ now: Date }>(
      sql`select clock_timestamp() as now`,
    )
    const now = clock.rows[0].now
    const [bucket] = await tx
      .select()
      .from(loginRateLimits)
      .where(eq(loginRateLimits.key, key))
    if (bucket && bucket.expiresAt.getTime() > now.getTime()) return null
    const window = {
      count: 1,
      windowStartedAt: now,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_RESEND_INTERVAL_MS),
    }
    await tx
      .insert(loginRateLimits)
      .values({ key, ...window })
      .onConflictDoUpdate({ target: loginRateLimits.key, set: window })

    // A mesma ordem de bloqueio é usada na conclusão e na criação de sessões.
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.login, documentNumber))
      .limit(1)
      .for('update')
    if (!account) return null
    const [user] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.accountId, account.id))
      .limit(1)
      .for('update')
    if (!user) return null
    await tx
      .update(passwordResetRequests)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(passwordResetRequests.accountId, account.id),
          isNull(passwordResetRequests.consumedAt),
          isNull(passwordResetRequests.invalidatedAt),
        ),
      )
    const { token, tokenHash, expiresAt } = createPasswordResetToken(now)
    await tx.insert(passwordResetRequests).values({
      accountId: account.id,
      email: user.email,
      tokenHash,
      expiresAt,
      createdAt: now,
    })
    return { token, email: user.email }
  })
}

export async function hasUsablePasswordReset(
  token: string,
  database: typeof db = db,
): Promise<boolean> {
  const [request] = await database
    .select({ id: passwordResetRequests.id })
    .from(passwordResetRequests)
    .innerJoin(
      users,
      and(
        eq(users.accountId, passwordResetRequests.accountId),
        eq(users.email, passwordResetRequests.email),
      ),
    )
    .where(
      and(
        eq(passwordResetRequests.tokenHash, hashPasswordResetToken(token)),
        isNull(passwordResetRequests.consumedAt),
        isNull(passwordResetRequests.invalidatedAt),
        gt(passwordResetRequests.expiresAt, sql`clock_timestamp()`),
      ),
    )
    .limit(1)
  return Boolean(request)
}

// O hash é calculado fora da transação; validade e email são rechecados sob bloqueio.
export async function completePasswordReset(
  token: string,
  passwordHash: string,
  database: typeof db = db,
): Promise<boolean> {
  const tokenHash = hashPasswordResetToken(token)
  const [candidate] = await database
    .select({ accountId: passwordResetRequests.accountId })
    .from(passwordResetRequests)
    .where(eq(passwordResetRequests.tokenHash, tokenHash))
    .limit(1)
  if (!candidate) return false
  return database.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '3s'`)
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, candidate.accountId))
      .limit(1)
      .for('update')
    if (!account) return false
    const [user] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.accountId, account.id))
      .limit(1)
      .for('update')
    const [request] = await tx
      .select()
      .from(passwordResetRequests)
      .where(eq(passwordResetRequests.tokenHash, tokenHash))
      .limit(1)
      .for('update')
    const clock = await tx.execute<{ now: Date }>(
      sql`select clock_timestamp() as now`,
    )
    const now = clock.rows[0].now
    if (
      !user ||
      !request ||
      request.accountId !== account.id ||
      request.email !== user.email ||
      request.consumedAt ||
      request.invalidatedAt ||
      request.expiresAt.getTime() <= now.getTime()
    )
      return false

    await tx
      .update(accounts)
      .set({ passwordHash })
      .where(eq(accounts.id, account.id))
    await tx
      .update(passwordResetRequests)
      .set({ consumedAt: now })
      .where(eq(passwordResetRequests.id, request.id))
    await tx
      .update(passwordResetRequests)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(passwordResetRequests.accountId, account.id),
          isNull(passwordResetRequests.consumedAt),
          isNull(passwordResetRequests.invalidatedAt),
        ),
      )
    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.accountId, account.id), isNull(sessions.revokedAt)),
      )
    return true
  })
}
