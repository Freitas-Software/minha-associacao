'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import z from 'zod'
import type { ActionResult } from '@/lib/actions'
import { sendEmail } from '@/lib/email'
import { resolveLoginClientIp } from '@/lib/login-client-ip'
import { reservePasswordResetAttempt } from '@/lib/login-rate-limit'
import { preparePasswordReset } from '@/lib/password-reset'
import { passwordResetUrl } from '@/lib/password-reset-url'
import {
  type RequestPasswordResetFields,
  requestPasswordResetSchema,
} from '../schema'

export async function requestPasswordReset(
  data: unknown,
): Promise<ActionResult<RequestPasswordResetFields>> {
  const parsed = requestPasswordResetSchema.safeParse(data)
  try {
    const allowed = await reservePasswordResetAttempt(
      'request',
      resolveLoginClientIp(await headers()),
    )
    if (!parsed.success)
      return {
        success: false,
        message: 'Confira o CPF informado.',
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      }
    // Resposta idêntica para conta desconhecida, reenvio antecipado e limite por IP.
    if (!allowed) return { success: true }
    // Valida configuração antes da busca, sem revelar se a conta existe.
    passwordResetUrl('config-check')
    const pending = await preparePasswordReset(parsed.data.documentNumber)
    if (pending) {
      const url = passwordResetUrl(pending.token)
      // A latência e as falhas do provedor não revelam a existência da conta.
      after(async () => {
        try {
          await sendEmail({
            to: pending.email,
            subject: 'Redefina sua senha — Associae',
            text: [
              'Recebemos uma solicitação de recuperação de senha.',
              'Use o link abaixo para definir uma nova senha. Ele é válido por 30 minutos e só pode ser usado uma vez.',
              url,
              'Ao redefinir, todas as sessões da sua conta serão encerradas.',
              'Se você não fez esta solicitação, ignore este email. Sua senha permanece a mesma.',
            ].join('\n\n'),
          })
        } catch {
          console.error('[requestPasswordReset]', { stage: 'email' })
        }
      })
    }
    return { success: true }
  } catch {
    console.error('[requestPasswordReset]', { stage: 'request' })
    return {
      success: false,
      message:
        'Não foi possível concluir a solicitação agora. Tente novamente em instantes.',
    }
  }
}
