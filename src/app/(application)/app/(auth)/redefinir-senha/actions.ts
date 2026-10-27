'use server'

import { hash } from '@node-rs/argon2'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import z from 'zod'
import type { ActionResult } from '@/lib/actions'
import { resolveLoginClientIp } from '@/lib/login-client-ip'
import { reservePasswordResetAttempt } from '@/lib/login-rate-limit'
import {
  completePasswordReset,
  hasUsablePasswordReset,
} from '@/lib/password-reset'
import { getCurrentSession, SESSION_COOKIE_NAME } from '@/lib/session'
import { type ResetPasswordFields, resetPasswordSchema } from '../schema'

export async function resetPassword(
  data: unknown,
): Promise<ActionResult<ResetPasswordFields>> {
  const parsed = resetPasswordSchema.safeParse(data)
  try {
    const allowed = await reservePasswordResetAttempt(
      'complete',
      resolveLoginClientIp(await headers()),
    )
    if (!allowed)
      return {
        success: false,
        message:
          'Muitas tentativas. Aguarde até 15 minutos antes de tentar novamente.',
      }
    if (!parsed.success)
      return {
        success: false,
        message: 'Confira os campos informados.',
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      }
    const invalid = {
      success: false as const,
      message:
        'Este link é inválido, expirou ou já foi utilizado. Solicite um novo link.',
    }
    if (!(await hasUsablePasswordReset(parsed.data.token))) return invalid
    const passwordHash = await hash(parsed.data.password, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    })
    if (!(await completePasswordReset(parsed.data.token, passwordHash))) {
      return invalid
    }
    // A revogação no banco já ocorreu, inclusive para os demais dispositivos.
    // Uma conta diferente que esteja aberta neste navegador permanece conectada.
    if (!(await getCurrentSession())) {
      const cookieStore = await cookies()
      cookieStore.delete(SESSION_COOKIE_NAME)
    }
    revalidatePath('/app', 'layout')
    return { success: true }
  } catch {
    console.error('[resetPassword]', { stage: 'reset' })
    return {
      success: false,
      message:
        'Não foi possível confirmar a redefinição agora. Tente entrar com a nova senha ou solicite outro link.',
    }
  }
}
