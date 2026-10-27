'use server'

import z from 'zod'
import type { ActionResult } from '@/lib/actions'
import {
  type RequestRegistrationFields,
  requestRegistrationSchema,
} from '@/modules/identity/registration.schema'
import { requestRegistration as requestRegistrationService } from '@/modules/identity/request-registration.server'

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
    await requestRegistrationService(parsed.data)

    return { success: true }
  } catch {
    console.error('[requestRegistration]', { stage: 'request' })

    return {
      success: false,
      message:
        'Não foi possível concluir sua solicitação. Aguarde pelo menos 60 segundos antes de tentar novamente.',
    }
  }
}
