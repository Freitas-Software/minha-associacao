import 'server-only'
import { and, isNotNull, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import {
  emailChangeRequests,
  loginRateLimits,
  passwordResetRequests,
  registrationRequests,
  sessions,
} from '@/db/schema'

export const CLEANUP_RETENTION_DAYS = 30

const RETENTION_MS = CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000

export type CleanupResult = {
  sessions: number
  registrationRequests: number
  passwordResetRequests: number
  emailChangeRequests: number
  loginRateLimits: number
}

/**
 * Removes expired operational records that have outlived the retention window.
 * Returns the number of deleted rows per table.
 */
export async function runCleanup(
  database: typeof db = db,
  now: Date = new Date(),
): Promise<CleanupResult> {
  const cutoff = new Date(now.getTime() - RETENTION_MS)

  return database.transaction(async tx => {
    const deletedSessions = await tx
      .delete(sessions)
      .where(
        or(
          lt(sessions.expiresAt, cutoff),
          lt(sessions.idleExpiresAt, cutoff),
          and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, cutoff)),
        ),
      )
      .returning({ id: sessions.id })

    const deletedRegistrationRequests = await tx
      .delete(registrationRequests)
      .where(lt(registrationRequests.createdAt, cutoff))
      .returning({ id: registrationRequests.id })

    const deletedPasswordResetRequests = await tx
      .delete(passwordResetRequests)
      .where(lt(passwordResetRequests.createdAt, cutoff))
      .returning({ id: passwordResetRequests.id })

    const deletedEmailChangeRequests = await tx
      .delete(emailChangeRequests)
      .where(lt(emailChangeRequests.createdAt, cutoff))
      .returning({ id: emailChangeRequests.id })

    const deletedLoginRateLimits = await tx
      .delete(loginRateLimits)
      .where(lt(loginRateLimits.expiresAt, cutoff))
      .returning({ key: loginRateLimits.key })

    return {
      sessions: deletedSessions.length,
      registrationRequests: deletedRegistrationRequests.length,
      passwordResetRequests: deletedPasswordResetRequests.length,
      emailChangeRequests: deletedEmailChangeRequests.length,
      loginRateLimits: deletedLoginRateLimits.length,
    }
  })
}
