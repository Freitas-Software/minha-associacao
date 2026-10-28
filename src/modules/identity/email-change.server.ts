import 'server-only'
import { verify } from '@node-rs/argon2'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/db'
import { accounts, emailChangeRequests, users } from '@/db/schema'
import { sendEmail } from '@/lib/email'
import {
  createEmailChangeToken,
  EMAIL_CHANGE_RESEND_INTERVAL_MS,
  hashEmailChangeToken,
} from '@/lib/email-change-token'
import type { RequestEmailChangeData } from './email-change.schema'

export type EmailChangeLinkResult =
  | { status: 'link-sent'; to: string; token: string }
  | { status: 'not-found' }
  | { status: 'invalid-password' }
  | { status: 'same-email' }
  | { status: 'email-in-use' }
  | { status: 'rate-limited' }

export type RequestEmailChangeResult =
  | { status: 'link-sent'; email: string }
  | { status: 'not-found' }
  | { status: 'invalid-password' }
  | { status: 'same-email' }
  | { status: 'email-in-use' }
  | { status: 'rate-limited' }

export type ConfirmEmailChangeResult =
  | { status: 'confirmed' }
  | { status: 'invalid-link' }
  | { status: 'email-in-use' }

function emailChangeConfirmationUrl(): URL {
  const appUrl = process.env.APP_URL

  if (!appUrl) throw new Error('APP_URL não configurada.')

  const url = new URL('/app/perfil/confirmar-email', appUrl)

  const isLocalDevelopment =
    process.env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)

  if (url.protocol !== 'https:' && !isLocalDevelopment) {
    throw new Error('APP_URL deve utilizar HTTPS.')
  }

  return url
}

export async function createEmailChangeRequest(
  input: {
    userId: string
    data: RequestEmailChangeData
  },
  database: typeof db = db,
): Promise<EmailChangeLinkResult> {
  const [account] = await database
    .select({
      userId: users.id,
      currentEmail: users.email,
      passwordHash: accounts.passwordHash,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.id, users.accountId))
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!account) return { status: 'not-found' }

  const passwordMatches = await verify(
    account.passwordHash,
    input.data.password,
  )

  if (!passwordMatches) return { status: 'invalid-password' }

  if (account.currentEmail === input.data.newEmail) {
    return { status: 'same-email' }
  }

  return database.transaction(async tx => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`email-change:${input.userId}`}, 0)
      )
    `)

    const [currentUser] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for('update')

    if (!currentUser) return { status: 'not-found' as const }

    if (currentUser.email === input.data.newEmail) {
      return { status: 'same-email' as const }
    }

    const [emailOwner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.data.newEmail))
      .limit(1)

    if (emailOwner) return { status: 'email-in-use' as const }

    const [lastRequest] = await tx
      .select({ createdAt: emailChangeRequests.createdAt })
      .from(emailChangeRequests)
      .where(eq(emailChangeRequests.userId, input.userId))
      .orderBy(desc(emailChangeRequests.createdAt))
      .limit(1)

    const now = new Date()

    if (
      lastRequest &&
      now.getTime() - lastRequest.createdAt.getTime() <
        EMAIL_CHANGE_RESEND_INTERVAL_MS
    ) {
      return { status: 'rate-limited' as const }
    }

    await tx
      .update(emailChangeRequests)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(emailChangeRequests.userId, input.userId),
          isNull(emailChangeRequests.consumedAt),
          isNull(emailChangeRequests.invalidatedAt),
        ),
      )

    const generatedToken = createEmailChangeToken(now)

    await tx.insert(emailChangeRequests).values({
      userId: input.userId,
      newEmail: input.data.newEmail,
      tokenHash: generatedToken.tokenHash,
      expiresAt: generatedToken.expiresAt,
    })

    return {
      status: 'link-sent' as const,
      to: input.data.newEmail,
      token: generatedToken.token,
    }
  })
}

export async function requestEmailChange(
  input: {
    userId: string
    data: RequestEmailChangeData
  },
  database: typeof db = db,
): Promise<RequestEmailChangeResult> {
  const pending = await createEmailChangeRequest(input, database)

  if (pending.status !== 'link-sent') return pending

  const confirmationUrl = emailChangeConfirmationUrl()
  confirmationUrl.searchParams.set('token', pending.token)

  after(async () => {
    try {
      await sendEmail({
        to: pending.to,
        subject: 'Confirme seu novo email - Associae',
        text: [
          'Recebemos uma solicitação para alterar o email da sua conta Associae para este endereço.',
          '',
          'Para confirmar a alteração, acesse:',
          confirmationUrl.toString(),
          '',
          'Este link é válido por 30 minutos e pode ser usado por uma única vez.',
          '',
          'Se você não solicitou esta alteração, ignore esta mensagem. Seu email atual continua ativo.',
        ].join('\n'),
      })
    } catch {
      console.error('[requestEmailChange]', { stage: 'email' })
    }
  })

  return { status: 'link-sent', email: pending.to }
}

export async function confirmEmailChange(
  input: {
    userId: string
    token: string
  },
  database: typeof db = db,
): Promise<ConfirmEmailChangeResult> {
  const tokenHash = hashEmailChangeToken(input.token)

  return database.transaction(async tx => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`email-change:${input.userId}`}, 0)
      )
    `)

    const [request] = await tx
      .select()
      .from(emailChangeRequests)
      .where(
        and(
          eq(emailChangeRequests.tokenHash, tokenHash),
          eq(emailChangeRequests.userId, input.userId),
          isNull(emailChangeRequests.consumedAt),
          isNull(emailChangeRequests.invalidatedAt),
          gt(emailChangeRequests.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .for('update')

    if (!request) return { status: 'invalid-link' as const }

    const [currentUser] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for('update')

    if (!currentUser) return { status: 'invalid-link' as const }

    if (currentUser.email === request.newEmail) {
      return { status: 'invalid-link' as const }
    }

    const [emailOwner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, request.newEmail))
      .limit(1)

    if (emailOwner) return { status: 'email-in-use' as const }

    const now = new Date()

    const [updated] = await tx
      .update(users)
      .set({
        email: request.newEmail,
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, input.userId))
      .returning({ id: users.id })

    if (!updated) return { status: 'invalid-link' as const }

    await tx
      .update(emailChangeRequests)
      .set({ consumedAt: now })
      .where(eq(emailChangeRequests.id, request.id))

    await tx
      .update(emailChangeRequests)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(emailChangeRequests.userId, input.userId),
          isNull(emailChangeRequests.consumedAt),
          isNull(emailChangeRequests.invalidatedAt),
        ),
      )

    return { status: 'confirmed' as const }
  })
}
