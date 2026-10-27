'use server'

import { renewCurrentSession, revokeOtherSessions } from '@/lib/session'

type RenewSessionResult =
  | { status: 'renewed' }
  | { status: 'expired' }
  | { status: 'unavailable' }

export async function renewSession(): Promise<RenewSessionResult> {
  try {
    const renewed = await renewCurrentSession()

    return {
      status: renewed ? 'renewed' : 'expired',
    }
  } catch {
    console.error('[renewSession]', {
      operation: 'renew-current-session',
    })

    return { status: 'unavailable' }
  }
}

type EndOtherSessionsResult =
  | { status: 'completed' }
  | { status: 'expired' }
  | { status: 'unavailable' }

export async function endOtherSessions(): Promise<EndOtherSessionsResult> {
  try {
    const completed = await revokeOtherSessions()

    return {
      status: completed ? 'completed' : 'expired',
    }
  } catch {
    console.error('[endOtherSessions]', {
      operation: 'revoke-other-sessions',
    })

    return { status: 'unavailable' }
  }
}
