'use server'

import type { ActionResult } from '@/lib/actions'
import { revokeCurrentSession } from '@/lib/session'

export async function logout(): Promise<ActionResult<never>> {
  try {
    await revokeCurrentSession()

    return { success: true }
  } catch {
    console.error('[logout]', {
      operation: 'revoke-current-session',
    })

    return {
      success: false,
      message: 'Não foi possível sair agora. Tente novamente.',
    }
  }
}
