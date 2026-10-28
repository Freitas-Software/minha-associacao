import 'server-only'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users } from '@/db/schema'

export type ActiveSession = {
  id: string
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
  isCurrent: boolean
}

export type ListActiveSessionsResult =
  | { status: 'ok'; sessions: ActiveSession[] }
  | { status: 'not-found' }

export type RevokeSessionResult =
  | { status: 'revoked' }
  | { status: 'current-session' }
  | { status: 'not-found' }

async function getAccountId(
  userId: string,
  database: typeof db,
): Promise<string | null> {
  const [user] = await database
    .select({ accountId: users.accountId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user?.accountId ?? null
}

export async function listActiveSessions(
  userId: string,
  currentSessionId: string,
  database: typeof db = db,
): Promise<ListActiveSessionsResult> {
  const accountId = await getAccountId(userId, database)

  if (!accountId) return { status: 'not-found' }

  const now = new Date()
  const rows = await database
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.accountId, accountId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        gt(sessions.idleExpiresAt, now),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt))

  return {
    status: 'ok',
    sessions: rows.map(session => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    })),
  }
}

export async function revokeSession(
  input: {
    userId: string
    currentSessionId: string
    sessionId: string
  },
  database: typeof db = db,
): Promise<RevokeSessionResult> {
  if (input.sessionId === input.currentSessionId) {
    return { status: 'current-session' }
  }

  const accountId = await getAccountId(input.userId, database)

  if (!accountId) return { status: 'not-found' }

  const [revoked] = await database
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.id, input.sessionId),
        eq(sessions.accountId, accountId),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id })

  return revoked ? { status: 'revoked' } : { status: 'not-found' }
}
