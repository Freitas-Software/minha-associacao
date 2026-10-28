import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/db'
import {
  accounts,
  memberships,
  registrationContactConflicts,
  registrationRequests,
  roles,
  users,
} from '@/db/schema'
import { sendEmail } from '@/lib/email'
import {
  getOrganizationAccess,
  hasPermission,
} from '@/modules/authorization/authorize.server'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import type { RequestRegistrationData } from '@/modules/identity/registration.schema'
import {
  createRegistrationToken,
  REGISTRATION_RESEND_INTERVAL_MS,
} from '@/modules/identity/registration-token.server'
import { registrationConfirmationUrl } from '@/modules/identity/registration-url'

export type PreRegistrationLinkResult =
  | {
      status: 'link-sent'
      to: string
      token: string
      contactConflict: boolean
    }
  | { status: 'forbidden' }
  | { status: 'invalid-role' }
  | { status: 'role-not-allowed' }
  | { status: 'account-exists' }
  | { status: 'already-member' }
  | { status: 'rate-limited' }
  | { status: 'not-found' }

export type PreRegistrationResult =
  | {
      status: 'link-sent'
      sentTo: string
      contactConflict: boolean
    }
  | { status: 'forbidden' }
  | { status: 'invalid-role' }
  | { status: 'role-not-allowed' }
  | { status: 'account-exists' }
  | { status: 'already-member' }
  | { status: 'rate-limited' }
  | { status: 'not-found' }

function maskEmail(email: string): string {
  const at = email.indexOf('@')

  if (at <= 0) return '***'

  return `${email.slice(0, 1)}***${email.slice(at)}`
}

export async function createPreRegistrationLink(
  input: {
    actorUserId: string
    organizationId: string
    roleId: string
    person: RequestRegistrationData
  },
  database: typeof db = db,
): Promise<PreRegistrationLinkResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.membersManage)) {
    return { status: 'forbidden' }
  }

  const [role] = await database
    .select({
      id: roles.id,
      hasFullAccess: roles.hasFullAccess,
      isActive: roles.isActive,
    })
    .from(roles)
    .where(
      and(
        eq(roles.id, input.roleId),
        eq(roles.organizationId, input.organizationId),
      ),
    )
    .limit(1)

  if (!role?.isActive) return { status: 'invalid-role' }

  if (role.hasFullAccess && !access.hasFullAccess) {
    return { status: 'role-not-allowed' }
  }

  const pendingEmail = await database.transaction(async tx => {
    const documentNumber = input.person.documentNumber

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

    if (existingAccount) return { status: 'account-exists' as const }

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

    if (existingUser?.accountId) return { status: 'account-exists' as const }

    if (existingUser) {
      const [membership] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, input.organizationId),
            eq(memberships.userId, existingUser.id),
          ),
        )
        .limit(1)

      if (membership) return { status: 'already-member' as const }
    }

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
    ) {
      return { status: 'rate-limited' as const }
    }

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

    let userId: string
    let profile: RequestRegistrationData
    let contactConflict = false

    if (existingUser) {
      userId = existingUser.id
      profile = {
        name: existingUser.name,
        documentNumber: existingUser.documentNumber,
        email: existingUser.email,
        phone: existingUser.phone,
        birthDate: existingUser.birthDate,
      }

      if (
        existingUser.email !== input.person.email ||
        existingUser.phone !== input.person.phone
      ) {
        contactConflict = true

        const [existingConflict] = await tx
          .select({ id: registrationContactConflicts.id })
          .from(registrationContactConflicts)
          .where(
            and(
              eq(registrationContactConflicts.userId, existingUser.id),
              eq(
                registrationContactConflicts.organizationId,
                input.organizationId,
              ),
              eq(registrationContactConflicts.email, input.person.email),
              eq(registrationContactConflicts.phone, input.person.phone),
              isNull(registrationContactConflicts.resolvedAt),
            ),
          )
          .limit(1)

        if (!existingConflict) {
          await tx.insert(registrationContactConflicts).values({
            userId: existingUser.id,
            organizationId: input.organizationId,
            email: input.person.email,
            phone: input.person.phone,
            createdByUserId: input.actorUserId,
          })
        }
      }
    } else {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name: input.person.name,
          documentNumber: input.person.documentNumber,
          email: input.person.email,
          phone: input.person.phone,
          birthDate: input.person.birthDate,
        })
        .returning({ id: users.id })

      if (!createdUser) {
        throw new Error('A criação do perfil não retornou um ID.')
      }

      userId = createdUser.id
      profile = input.person
    }

    const generatedToken = createRegistrationToken(now)

    await tx.insert(registrationRequests).values({
      userId,
      organizationId: input.organizationId,
      roleId: input.roleId,
      createdByUserId: input.actorUserId,
      name: profile.name,
      documentNumber: profile.documentNumber,
      email: profile.email,
      phone: profile.phone,
      birthDate: profile.birthDate,
      tokenHash: generatedToken.tokenHash,
      expiresAt: generatedToken.expiresAt,
    })

    return {
      status: 'link-sent' as const,
      to: profile.email,
      token: generatedToken.token,
      contactConflict,
    }
  })

  return pendingEmail
}

export async function requestPreRegistration(
  input: {
    actorUserId: string
    organizationId: string
    roleId: string
    person: RequestRegistrationData
  },
  database: typeof db = db,
): Promise<PreRegistrationResult> {
  const pendingEmail = await createPreRegistrationLink(input, database)

  if (pendingEmail.status !== 'link-sent') return pendingEmail

  const confirmationUrl = registrationConfirmationUrl()
  confirmationUrl.searchParams.set('token', pendingEmail.token)

  after(async () => {
    try {
      await sendEmail({
        to: pendingEmail.to,
        subject: 'Conclua seu cadastro na Associae',
        text: [
          'Uma organização solicitou seu cadastro na Associae.',
          '',
          ...(pendingEmail.contactConflict
            ? [
                'O contato informado por essa organização difere do contato já cadastrado. Por segurança, enviamos este link ao email existente; ao concluir, você poderá revisar o contato.',
                '',
              ]
            : []),
          'Para confirmar seu email e definir sua senha, acesse:',
          confirmationUrl.toString(),
          '',
          'Este link é válido por 30 minutos e pode ser usado por uma única vez.',
          '',
          'Se você não reconhece esta solicitação, ignore esta mensagem.',
        ].join('\n'),
      })
    } catch {
      console.error('[requestPreRegistration]', { stage: 'email' })
    }
  })

  return {
    status: 'link-sent',
    sentTo: maskEmail(pendingEmail.to),
    contactConflict: pendingEmail.contactConflict,
  }
}

export async function resendPreRegistration(
  input: {
    actorUserId: string
    registrationRequestId: string
  },
  database: typeof db = db,
): Promise<PreRegistrationResult> {
  const [request] = await database
    .select({
      organizationId: registrationRequests.organizationId,
      roleId: registrationRequests.roleId,
      name: registrationRequests.name,
      documentNumber: registrationRequests.documentNumber,
      email: registrationRequests.email,
      phone: registrationRequests.phone,
      birthDate: registrationRequests.birthDate,
    })
    .from(registrationRequests)
    .where(eq(registrationRequests.id, input.registrationRequestId))
    .limit(1)

  if (!request?.organizationId || !request.roleId) {
    return { status: 'not-found' }
  }

  return requestPreRegistration(
    {
      actorUserId: input.actorUserId,
      organizationId: request.organizationId,
      roleId: request.roleId,
      person: {
        name: request.name,
        documentNumber: request.documentNumber,
        email: request.email,
        phone: request.phone,
        birthDate: request.birthDate,
      },
    },
    database,
  )
}
