import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, registrationRequests, users } from '@/db/schema'
import { sendEmail } from '@/lib/email'
import type { RequestRegistrationData } from './registration.schema'
import {
  createRegistrationToken,
  REGISTRATION_RESEND_INTERVAL_MS,
} from './registration-token.server'

export type RequestRegistrationResult =
  | { status: 'link-sent' }
  | { status: 'ignored' }

function registrationConfirmationUrl(): URL {
  const appUrl = process.env.APP_URL

  if (!appUrl) throw new Error('APP_URL não configurada.')

  const confirmationUrl = new URL('/app/confirmar-cadastro', appUrl)

  const isLocalDevelopment =
    process.env.NODE_ENV !== 'production' &&
    confirmationUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(confirmationUrl.hostname)

  if (confirmationUrl.protocol !== 'https:' && !isLocalDevelopment)
    throw new Error('APP_URL deve utilizar HTTPS.')

  return confirmationUrl
}

/**
 * Solicita um link de confirmação para cadastro público.
 *
 * Retorna `ignored` quando não há email a enviar: conta já existente, pessoa
 * com conta vinculada ou reenvio dentro do intervalo mínimo. A resposta não
 * revela qual desses casos ocorreu.
 */
export async function requestRegistration(
  data: RequestRegistrationData,
  database: typeof db = db,
): Promise<RequestRegistrationResult> {
  const confirmationUrl = registrationConfirmationUrl()

  const pendingEmail = await database.transaction(async tx => {
    const documentNumber = data.documentNumber

    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`registration:${documentNumber}`},
          0
        )
      )
    `)

    const [existingAccount] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.login, documentNumber))
      .limit(1)

    if (existingAccount) return null

    const [existingUser] = await tx
      .select({
        id: users.id,
        accountId: users.accountId,
        name: users.name,
        documentNumber: users.documentNumber,
        email: users.email,
        phone: users.phone,
        birthDate: users.birthDate,
      })
      .from(users)
      .where(eq(users.documentNumber, documentNumber))
      .limit(1)
      .for('update')

    if (existingUser?.accountId) return null

    const [lastRequest] = await tx
      .select({ createdAt: registrationRequests.createdAt })
      .from(registrationRequests)
      .where(eq(registrationRequests.documentNumber, documentNumber))
      .orderBy(desc(registrationRequests.createdAt))
      .limit(1)

    const now = new Date()

    if (
      lastRequest &&
      now.getTime() - lastRequest.createdAt.getTime() <
        REGISTRATION_RESEND_INTERVAL_MS
    )
      return null

    // Para pessoa pré-cadastrada, valem os dados já registrados em users.
    const profile = existingUser ?? data
    const generatedToken = createRegistrationToken(now)

    await tx
      .update(registrationRequests)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(registrationRequests.documentNumber, documentNumber),
          isNull(registrationRequests.consumedAt),
          isNull(registrationRequests.invalidatedAt),
        ),
      )

    await tx.insert(registrationRequests).values({
      userId: existingUser?.id ?? null,
      name: profile.name,
      documentNumber: profile.documentNumber,
      email: profile.email,
      phone: profile.phone,
      birthDate: profile.birthDate,
      tokenHash: generatedToken.tokenHash,
      expiresAt: generatedToken.expiresAt,
    })

    return {
      to: profile.email,
      token: generatedToken.token,
    }
  })

  if (!pendingEmail) return { status: 'ignored' }

  confirmationUrl.searchParams.set('token', pendingEmail.token)

  await sendEmail({
    to: pendingEmail.to,
    subject: 'Conclua seu cadastro - Minha Associação',
    text: [
      'Recebemos uma solicitação de cadastro no Minha Associação.',
      '',
      'Para confirmar seu email e definir sua senha, acesse:',
      confirmationUrl.toString(),
      '',
      'Este link é válido por 30 minutos e pode ser usado por uma única vez.',
      '',
      'Se você não solicitou este cadastro, ignore esta mensagem.',
    ].join('\n'),
  })

  return { status: 'link-sent' }
}
