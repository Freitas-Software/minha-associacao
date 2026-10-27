'use server'

import { hash, verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import z from 'zod'
import { db } from '@/db'
import { accounts, users } from '@/db/schema'
import type { ActionResult } from '@/lib/actions'
import { resolveLoginClientIp } from '@/lib/login-client-ip'
import {
  releaseSuccessfulLoginAttempt,
  reserveLoginAttempt,
} from '@/lib/login-rate-limit'
import { createSession } from '@/lib/session'
import { type LoginFields, loginSchema } from '../schema'

let dummyHashPromise: Promise<string> | undefined

function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hash('hash-auxiliar-sem-vínculo-com-qualquer-conta', {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  })

  return dummyHashPromise
}

export async function login(data: unknown): Promise<ActionResult<LoginFields>> {
  const parsed = await loginSchema.safeParseAsync(data)

  let stage: 'rate-limit' | 'database' | 'password' | 'session' = 'rate-limit'

  try {
    const clientIp = resolveLoginClientIp(await headers())
    const reservation = await reserveLoginAttempt(
      parsed.success ? parsed.data.login : null,
      clientIp,
    )

    if (!reservation.allowed) {
      return {
        success: false,
        message:
          'Muitas tentativas de login. Aguarde até 15 minutos antes de tentar novamente.',
      }
    }

    if (!parsed.success) {
      return {
        success: false,
        message: 'Confira os campos informados.',
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      }
    }

    stage = 'database'
    const [account] = await db
      .select({ id: accounts.id, passwordHash: accounts.passwordHash })
      .from(accounts)
      .innerJoin(users, eq(users.accountId, accounts.id))
      .where(eq(accounts.login, parsed.data.login))
      .limit(1)

    stage = 'password'

    const passwordHash = account?.passwordHash ?? (await getDummyPasswordHash())

    const passwordMatches = await verify(passwordHash, parsed.data.password)

    if (!account || !passwordMatches)
      return {
        success: false,
        message: 'CPF ou senha inválidos.',
      }

    await releaseSuccessfulLoginAttempt(reservation)

    stage = 'session'

    await createSession(account.id, account.passwordHash)

    revalidatePath('/app')

    return { success: true }
  } catch {
    console.error('[login]', { stage })

    return {
      success: false,
      message: 'Não foi possível entrar agora. Tente novamente em instantes.',
    }
  }
}
