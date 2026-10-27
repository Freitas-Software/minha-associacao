import 'server-only'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { loginRateLimits } from '@/db/schema'
import {
  activeBucketCount,
  getLoginWindow,
  LOGIN_IP_LIMIT,
  LOGIN_PAIR_LIMIT,
  loginBucketKey,
} from './login-rate-limit-policy'

export type LoginAttemptReservation =
  | { allowed: false }
  | { allowed: true; pairKey: string | null; windowStartedAt: Date }

export async function reserveLoginAttempt(
  documentNumber: string | null,
  clientIp: string,
  database: typeof db = db,
  scope: 'ip' | 'password-reset-request' | 'password-reset-complete' = 'ip',
): Promise<LoginAttemptReservation> {
  const ipKey = loginBucketKey(scope, clientIp)
  const pairKey = documentNumber
    ? loginBucketKey('cpf-ip', documentNumber, clientIp)
    : null

  return database.transaction<LoginAttemptReservation>(async tx => {
    // Contadores do mesmo IP são modificados em uma transação curta.
    // O Argon2 e a criação da sessão acontecem fora deste bloqueio.
    await tx.execute(sql`set local lock_timeout = '3s'`)
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${ipKey}, 0))`,
    )
    const clock = await tx.execute<{ now: string | Date }>(
      sql`select clock_timestamp() as now`,
    )
    const window = getLoginWindow(new Date(clock.rows[0].now))

    const [ipBucket] = await tx
      .select()
      .from(loginRateLimits)
      .where(eq(loginRateLimits.key, ipKey))
    const ipCount = activeBucketCount(ipBucket, window.windowStartedAt)
    if (ipCount >= LOGIN_IP_LIMIT) return { allowed: false }

    await tx
      .insert(loginRateLimits)
      .values({ key: ipKey, count: ipCount + 1, ...window })
      .onConflictDoUpdate({
        target: loginRateLimits.key,
        set: { count: ipCount + 1, ...window },
      })

    // Até entradas inválidas e tentativas já bloqueadas pelo par consomem
    // o orçamento global do IP, antes de qualquer trabalho do Argon2.
    if (!pairKey)
      return {
        allowed: true,
        pairKey: null,
        windowStartedAt: window.windowStartedAt,
      }

    const [pairBucket] = await tx
      .select()
      .from(loginRateLimits)
      .where(eq(loginRateLimits.key, pairKey))
      .for('update')
    const pairCount = activeBucketCount(pairBucket, window.windowStartedAt)
    if (pairCount >= LOGIN_PAIR_LIMIT) return { allowed: false }

    // Reserva pessimista: falhas e verificações em andamento ocupam vagas.
    // Credenciais válidas devolvem a vaga, sem apagar falhas anteriores.
    await tx
      .insert(loginRateLimits)
      .values({ key: pairKey, count: pairCount + 1, ...window })
      .onConflictDoUpdate({
        target: loginRateLimits.key,
        set: { count: pairCount + 1, ...window },
      })

    return { allowed: true, pairKey, windowStartedAt: window.windowStartedAt }
  })
}

export async function releaseSuccessfulLoginAttempt(
  reservation: Extract<LoginAttemptReservation, { allowed: true }>,
  database: typeof db = db,
): Promise<void> {
  if (!reservation.pairKey) return
  await database
    .update(loginRateLimits)
    .set({ count: sql`${loginRateLimits.count} - 1` })
    .where(
      and(
        eq(loginRateLimits.key, reservation.pairKey),
        eq(loginRateLimits.windowStartedAt, reservation.windowStartedAt),
        gt(loginRateLimits.count, 0),
      ),
    )
}

export async function reservePasswordResetAttempt(
  phase: 'request' | 'complete',
  clientIp: string,
  database: typeof db = db,
): Promise<boolean> {
  const reservation = await reserveLoginAttempt(
    null,
    clientIp,
    database,
    phase === 'request' ? 'password-reset-request' : 'password-reset-complete',
  )
  return reservation.allowed
}
