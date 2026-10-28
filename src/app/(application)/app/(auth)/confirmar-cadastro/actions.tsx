'use server'

import z from 'zod'
import type { ActionResult } from '@/lib/actions'
import { completeRegistration as completeRegistrationService } from '@/modules/identity/complete-registration.server'
import {
  type CompleteRegistrationFields,
  completeRegistrationSchema,
} from '@/modules/identity/registration.schema'

const invalidRequestMessage =
  'Este link não pode mais ser utilizado. Solicite um novo link de cadastro.'

export async function completeRegistration(
  data: unknown,
): Promise<ActionResult<CompleteRegistrationFields>> {
  const parsed = completeRegistrationSchema.safeParse(data)

  if (!parsed.success) {
    return {
      success: false,
      message: 'Confira os dados informados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  try {
    const result = await completeRegistrationService(parsed.data)

    if (result.status === 'invalid-link')
      return { success: false, message: invalidRequestMessage }

    if (result.status === 'membership-unavailable') {
      return {
        success: false,
        message:
          'A organização ou o cargo deste convite não está mais disponível. Peça à organização um novo pré-cadastro.',
      }
    }

    if (result.status === 'contact-choice-invalid') {
      return {
        success: false,
        message:
          'O contato escolhido não está mais disponível. Recarregue a página e tente novamente.',
      }
    }

    return { success: true }
  } catch {
    console.error('[completeRegistration]', { stage: 'complete' })

    return {
      success: false,
      message:
        'Não foi possível concluir o cadastro. Tente novamente. Se o problema persistir, solicite um novo link.',
    }
  }
}
