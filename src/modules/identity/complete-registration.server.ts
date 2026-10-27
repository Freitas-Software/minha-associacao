import 'server-only'
import { hash } from '@node-rs/argon2'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accounts, registrationRequests, users } from '@/db/schema'
import type { CompleteRegistrationData } from './registration.schema'
import { hashRegistrationToken } from './registration-token.server'

export type CompleteRegistrationResult =
  | { status: 'completed' }
  | { status: 'invalid-link' }

/**
 * Conclui o cadastro a partir do token enviado por email.
 *
 * Revalida o token sob bloqueio e cria a conta vinculada ao perfil existente
 * ou cria users e accounts para uma pessoa nova.
 */
export async function completeRegistration(
  data: CompleteRegistrationData,
  database: typeof db = db,
): Promise<CompleteRegistrationResult> {
  const tokenHash = hashRegistrationToken(data.token)

  const [candidate] = await database
    .select({
      documentNumber: registrationRequests.documentNumber,
    })
    .from(registrationRequests)
    .where(
      and(
        eq(registrationRequests.tokenHash, tokenHash),
        isNull(registrationRequests.consumedAt),
        isNull(registrationRequests.invalidatedAt),
        gt(registrationRequests.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!candidate) return { status: 'invalid-link' }

  const passwordHash = await hash(data.password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  })

  const completed = await database.transaction(async tx => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`registration:${candidate.documentNumber}`},
          0
        )
      )
    `)

    const [request] = await tx
      .select()
      .from(registrationRequests)
      .where(
        and(
          eq(registrationRequests.tokenHash, tokenHash),
          eq(registrationRequests.documentNumber, candidate.documentNumber),
          isNull(registrationRequests.consumedAt),
          isNull(registrationRequests.invalidatedAt),
          gt(registrationRequests.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .for('update')

    if (!request) return false

    const [existingAccount] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.login, request.documentNumber))
      .limit(1)

    if (existingAccount) return false

    const [existingUser] = await tx
      .select({
        id: users.id,
        accountId: users.accountId,
        email: users.email,
      })
      .from(users)
      .where(eq(users.documentNumber, request.documentNumber))
      .limit(1)
      .for('update')

    if (existingUser?.accountId) return false

    if (request.userId !== null && request.userId !== existingUser?.id) {
      return false
    }

    if (existingUser && existingUser.email !== request.email) {
      return false
    }

    const now = new Date()

    const [account] = await tx
      .insert(accounts)
      .values({
        login: request.documentNumber,
        passwordHash,
      })
      .returning({ id: accounts.id })

    if (!account) {
      throw new Error('A criação da conta não retornou um ID.')
    }

    if (existingUser) {
      const [linkedUser] = await tx
        .update(users)
        .set({
          accountId: account.id,
          emailVerifiedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(users.id, existingUser.id),
            isNull(users.accountId),
            eq(users.email, request.email),
          ),
        )
        .returning({ id: users.id })

      if (!linkedUser) {
        throw new Error('Não foi possível vincular a conta.')
      }
    } else {
      await tx.insert(users).values({
        accountId: account.id,
        name: request.name,
        documentNumber: request.documentNumber,
        email: request.email,
        emailVerifiedAt: now,
        phone: request.phone,
        birthDate: request.birthDate,
      })
    }

    const [consumedRequest] = await tx
      .update(registrationRequests)
      .set({ consumedAt: now })
      .where(
        and(
          eq(registrationRequests.id, request.id),
          isNull(registrationRequests.consumedAt),
          isNull(registrationRequests.invalidatedAt),
          gt(registrationRequests.expiresAt, now),
        ),
      )
      .returning({ id: registrationRequests.id })

    if (!consumedRequest) {
      throw new Error('Não foi possível consumir a solicitação.')
    }

    await tx
      .update(registrationRequests)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(registrationRequests.documentNumber, request.documentNumber),
          isNull(registrationRequests.consumedAt),
          isNull(registrationRequests.invalidatedAt),
        ),
      )

    return true
  })

  return completed ? { status: 'completed' } : { status: 'invalid-link' }
}
