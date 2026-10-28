import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import 'server-only'
import { and, eq, gt, isNull, ne } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { sessions, users } from '@/db/schema'
import { insertSessionForCredentials } from './session-credentials'

const DAY_MS = 24 * 60 * 60 * 1000

export const SESSION_MAX_DURATION_MS = 30 * DAY_MS
export const SESSION_IDLE_DURATION_MS = 7 * DAY_MS

const isProduction = process.env.NODE_ENV === 'production'

export const SESSION_COOKIE_NAME = isProduction
  ? '__Host-associae-session'
  : 'associae-session'

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf-8').digest('hex')
}

export async function createSession(
  accountId: string,
  expectedPasswordHash: string,
) {
  const cookieStore = await cookies()

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)

  const now = new Date()

  const expiresAt = new Date(now.getTime() + SESSION_MAX_DURATION_MS)

  const idleExpiresAt = new Date(
    Math.min(now.getTime() + SESSION_IDLE_DURATION_MS, expiresAt.getTime()),
  )

  const session = await insertSessionForCredentials(
    accountId,
    expectedPasswordHash,
    {
      tokenHash,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      idleExpiresAt,
    },
  )

  if (!session) throw new Error('Não foi possível criar a sessão.')

  try {
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
  } catch (error) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id))

    throw error
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null
  }

  const tokenHash = hashSessionToken(token)
  const now = new Date()

  const [session] = await db
    .select({
      sessionId: sessions.id,
      accountId: sessions.accountId,
      userId: users.id,
      name: users.name,
      expiresAt: sessions.expiresAt,
      idleExpiresAt: sessions.idleExpiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.accountId, sessions.accountId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        gt(sessions.idleExpiresAt, now),
      ),
    )
    .limit(1)

  return session ?? null
}

export async function requireSession() {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/app/entrar')
  }

  return session
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const tokenHash = hashSessionToken(token)

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function renewCurrentSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return false
  }

  const tokenHash = hashSessionToken(token)

  return db.transaction(async tx => {
    const [session] = await tx
      .select({
        id: sessions.id,
        expiresAt: sessions.expiresAt,
        idleExpiresAt: sessions.idleExpiresAt,
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1)
      .for('update')

    if (!session) return false

    const now = new Date()

    if (
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now.getTime() ||
      session.idleExpiresAt.getTime() <= now.getTime()
    ) {
      return false
    }

    const idleExpiresAt = new Date(
      Math.min(
        now.getTime() + SESSION_IDLE_DURATION_MS,
        session.expiresAt.getTime(),
      ),
    )

    await tx
      .update(sessions)
      .set({
        lastSeenAt: now,
        idleExpiresAt,
      })
      .where(eq(sessions.id, session.id))

    return true
  })
}

export async function revokeOtherSessions(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return false
  }

  const tokenHash = hashSessionToken(token)

  return db.transaction(async tx => {
    const [currentSession] = await tx
      .select({
        id: sessions.id,
        accountId: sessions.accountId,
        expiresAt: sessions.expiresAt,
        idleExpiresAt: sessions.idleExpiresAt,
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1)
      .for('update')

    if (!currentSession) return false

    const now = new Date()

    if (
      currentSession.revokedAt !== null ||
      currentSession.expiresAt.getTime() <= now.getTime() ||
      currentSession.idleExpiresAt.getTime() <= now.getTime()
    ) {
      return false
    }

    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.accountId, currentSession.accountId),
          ne(sessions.id, currentSession.id),
          isNull(sessions.revokedAt),
        ),
      )

    return true
  })
}
