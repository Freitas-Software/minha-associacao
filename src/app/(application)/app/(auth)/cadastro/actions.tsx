'use server'

import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import z from 'zod'
import { db } from '@/db'
import { accounts, registrationRequests, users } from '@/db/schema'
import type { ActionResult } from '@/lib/actions'
import { sendEmail } from '@/lib/email'
import {
  createRegistrationToken,
  REGISTRATION_RESEND_INTERVAL_MS,
} from '@/lib/registration-token'
import {
  type RequestRegistrationFields,
  requestRegistrationSchema,
} from '../schema'

export async function requestRegistration(
  data: unknown,
): Promise<ActionResult<RequestRegistrationFields>> {
  const parsed = await requestRegistrationSchema.safeParseAsync(data)

  if (!parsed.success)
    return {
      success: false,
      message: 'Confira os campos informados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }

  try {
    const appUrl = process.env.APP_URL

    if (!appUrl) throw new Error('APP_URL não configurada.')

    const confirmationUrl = new URL('/app/confirmar-cadastro', appUrl)

    const isLocalDevelopment =
      process.env.NODE_ENV !== 'production' &&
      confirmationUrl.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(confirmationUrl.hostname)

    if (confirmationUrl.protocol !== 'https:' && !isLocalDevelopment)
      throw new Error('APP_URL deve utilizar HTTPS.')

    const pendingEmail = await db.transaction(async tx => {
      const documentNumber = parsed.data.documentNumber

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

      const profile = existingUser ?? parsed.data
      const generatedToken = createRegistrationToken()

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

    if (pendingEmail) {
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
    }

    return { success: true }
  } catch {
    return {
      success: false,
      message:
        'Não foi possível concluir sua solicitação. Aguarde pelo menos 60 segundos antes de tentar novamente.',
    }
  }
}
