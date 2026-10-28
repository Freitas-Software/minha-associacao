'use server'

import { revalidatePath } from 'next/cache'
import z from 'zod'
import { getCurrentSession, requireSession } from '@/lib/session'
import {
  acceptInvite,
  createInvite,
  revokeInvite,
} from '@/modules/invites/invite.server'
import type { InviteActionState } from '@/modules/invites/invite-action-state'
import {
  INVITE_INDIVIDUAL_TTL_MS,
  INVITE_SHARED_TTL_MS,
} from '@/modules/invites/invite-policy'
import { inviteAcceptanceUrl } from '@/modules/invites/invite-url'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

export async function createInviteAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')
  const parsedOrganizationId = z.uuid().safeParse(organizationId)

  if (!parsedOrganizationId.success) {
    return { status: 'error', message: 'Organização inválida.' }
  }

  const type = readText(formData, 'type')

  if (type !== 'individual' && type !== 'shared') {
    return { status: 'error', message: 'Tipo de convite inválido.' }
  }

  const maxUsesRaw = readText(formData, 'maxUses')
  const maxUses = maxUsesRaw === '' ? null : Number(maxUsesRaw)

  if (
    type === 'shared' &&
    maxUses !== null &&
    (!Number.isInteger(maxUses) || maxUses <= 0)
  ) {
    return {
      status: 'error',
      message: 'Informe um limite de usos maior que zero.',
    }
  }

  const roleId = readText(formData, 'roleId') || null
  const documentNumber = readText(formData, 'documentNumber')
  const expiresAt = new Date(
    Date.now() +
      (type === 'individual' ? INVITE_INDIVIDUAL_TTL_MS : INVITE_SHARED_TTL_MS),
  )

  try {
    const result = await createInvite({
      actorUserId: session.userId,
      organizationId,
      type,
      roleId,
      documentNumber: type === 'individual' ? documentNumber : null,
      maxUses: type === 'shared' ? maxUses : null,
      expiresAt,
    })

    if (result.status === 'created') {
      revalidatePath(`/app/organizacoes/${organizationId}/convites`)

      return {
        status: 'success',
        message:
          'Convite criado. Copie o link abaixo e envie para a pessoa convidada.',
        inviteUrl: inviteAcceptanceUrl(result.token),
      }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para criar convites.',
        }
      case 'invalid-role':
        return {
          status: 'error',
          message: 'Selecione um cargo válido para este tipo de convite.',
        }
      case 'invalid-document':
        return { status: 'error', message: 'Informe um CPF válido.' }
      case 'invalid-expiry':
        return {
          status: 'error',
          message: 'Não foi possível definir a validade do convite.',
        }
      case 'invalid-max-uses':
        return {
          status: 'error',
          message: 'Informe um limite de usos válido.',
        }
    }
  } catch {
    console.error('[createInviteAction]', { stage: 'create' })
    return {
      status: 'error',
      message: 'Não foi possível criar o convite agora.',
    }
  }
}

export async function revokeInviteAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')
  const inviteId = readText(formData, 'inviteId')
  const parsedOrganizationId = z.uuid().safeParse(organizationId)

  if (!parsedOrganizationId.success || !z.uuid().safeParse(inviteId).success) {
    return { status: 'error', message: 'Convite inválido.' }
  }

  try {
    const result = await revokeInvite(session.userId, inviteId)

    if (result.status === 'revoked') {
      revalidatePath(`/app/organizacoes/${organizationId}/convites`)
      return { status: 'success', message: 'Convite revogado.' }
    }

    if (result.status === 'already-revoked') {
      return { status: 'error', message: 'Este convite já foi revogado.' }
    }

    if (result.status === 'not-found') {
      return { status: 'error', message: 'Convite não encontrado.' }
    }

    return {
      status: 'error',
      message: 'Você não tem permissão para revogar este convite.',
    }
  } catch {
    console.error('[revokeInviteAction]', { stage: 'revoke' })
    return {
      status: 'error',
      message: 'Não foi possível revogar o convite agora.',
    }
  }
}

export async function acceptInviteAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await getCurrentSession()

  if (!session) {
    return {
      status: 'error',
      message: 'Entre na sua conta para aceitar o convite.',
    }
  }

  const token = readText(formData, 'token')

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { status: 'error', message: 'Link de convite inválido.' }
  }

  try {
    const result = await acceptInvite(session.userId, token)

    if (result.status === 'accepted') {
      revalidatePath('/app')
      revalidatePath('/app/organizacoes')

      return {
        status: 'success',
        message: 'Convite aceito. Seu vínculo está ativo.',
      }
    }

    if (result.status === 'already-member') {
      return {
        status: 'success',
        message: 'Você já é membro ativo desta organização.',
      }
    }

    if (result.status === 'forbidden') {
      return {
        status: 'error',
        message: 'Este convite é vinculado a outro CPF.',
      }
    }

    if (result.status === 'account-unverified') {
      return {
        status: 'error',
        message: 'Confirme seu email antes de aceitar o convite.',
      }
    }

    if (result.status === 'invalid-role') {
      return {
        status: 'error',
        message: 'O cargo deste convite não está mais disponível.',
      }
    }

    return {
      status: 'error',
      message: 'Este convite é inválido, expirou ou já esgotou os usos.',
    }
  } catch {
    console.error('[acceptInviteAction]', { stage: 'accept' })
    return {
      status: 'error',
      message: 'Não foi possível aceitar o convite agora.',
    }
  }
}
