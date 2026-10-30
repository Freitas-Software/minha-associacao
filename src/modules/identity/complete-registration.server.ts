import 'server-only'
import { hash } from '@node-rs/argon2'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  accounts,
  memberships,
  organizations,
  registrationContactConflicts,
  registrationRequests,
  roles,
  users,
} from '@/db/schema'
import type { CompleteRegistrationData } from './registration.schema'
import { hashRegistrationToken } from './registration-token.server'

export type CompleteRegistrationResult =
  | { status: 'completed' }
  | { status: 'invalid-link' }
  | { status: 'membership-unavailable' }
  | { status: 'contact-choice-invalid' }
  | { status: 'organization-closed' }

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

  return database.transaction(async tx => {
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

    if (!request) return { status: 'invalid-link' as const }

    const [existingAccount] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.login, request.documentNumber))
      .limit(1)

    if (existingAccount) return { status: 'invalid-link' as const }

    const [existingUser] = await tx
      .select({
        id: users.id,
        accountId: users.accountId,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.documentNumber, request.documentNumber))
      .limit(1)
      .for('update')

    if (existingUser?.accountId) return { status: 'invalid-link' as const }

    if (request.userId !== null && request.userId !== existingUser?.id) {
      return { status: 'invalid-link' as const }
    }

    if (existingUser && existingUser.email !== request.email) {
      return { status: 'invalid-link' as const }
    }

    const organizationId = request.organizationId
    const roleId = request.roleId

    if ((organizationId === null) !== (roleId === null)) {
      return { status: 'membership-unavailable' as const }
    }

    if (organizationId && roleId) {
      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, organizationId),
            eq(roles.isActive, true),
          ),
        )
        .limit(1)

      if (!role) return { status: 'membership-unavailable' as const }

      const [organization] = await tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
        .for('update')

      if (!organization || organization.status === 'closed') {
        return { status: 'organization-closed' as const }
      }

      if (existingUser) {
        const [existingMembership] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              eq(memberships.organizationId, organizationId),
              eq(memberships.userId, existingUser.id),
            ),
          )
          .limit(1)

        if (existingMembership) {
          return { status: 'membership-unavailable' as const }
        }
      }
    }

    let selectedContact: { email: string; phone: string } | null = null

    if (existingUser) {
      const conflicts = await tx
        .select({
          id: registrationContactConflicts.id,
          email: registrationContactConflicts.email,
          phone: registrationContactConflicts.phone,
        })
        .from(registrationContactConflicts)
        .where(
          and(
            eq(registrationContactConflicts.userId, existingUser.id),
            isNull(registrationContactConflicts.resolvedAt),
          ),
        )

      if (data.contactChoice && data.contactChoice !== 'existing') {
        const chosen = conflicts.find(
          conflict => conflict.id === data.contactChoice,
        )

        if (!chosen) return { status: 'contact-choice-invalid' as const }

        selectedContact = { email: chosen.email, phone: chosen.phone }
      } else {
        selectedContact = {
          email: existingUser.email,
          phone: existingUser.phone,
        }
      }
    } else if (data.contactChoice && data.contactChoice !== 'existing') {
      return { status: 'contact-choice-invalid' as const }
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

    let resolvedUserId: string

    if (existingUser && selectedContact) {
      const [linkedUser] = await tx
        .update(users)
        .set({
          accountId: account.id,
          email: selectedContact.email,
          phone: selectedContact.phone,
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

      resolvedUserId = linkedUser.id

      await tx
        .update(registrationContactConflicts)
        .set({ resolvedAt: now })
        .where(
          and(
            eq(registrationContactConflicts.userId, existingUser.id),
            isNull(registrationContactConflicts.resolvedAt),
          ),
        )
    } else {
      const [createdUser] = await tx
        .insert(users)
        .values({
          accountId: account.id,
          name: request.name,
          documentNumber: request.documentNumber,
          email: request.email,
          emailVerifiedAt: now,
          phone: request.phone,
          birthDate: request.birthDate,
        })
        .returning({ id: users.id })

      if (!createdUser) {
        throw new Error('A criação do perfil não retornou um ID.')
      }

      resolvedUserId = createdUser.id
    }

    if (organizationId && roleId) {
      await tx.insert(memberships).values({
        organizationId,
        userId: resolvedUserId,
        roleId,
        status: 'active',
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

    return { status: 'completed' as const }
  })
}
