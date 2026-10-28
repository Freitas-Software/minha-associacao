'use server'

import { revalidatePath } from 'next/cache'
import z from 'zod'
import { getCurrentSession, requireSession } from '@/lib/session'
import { requestRegistrationSchema } from '@/modules/identity/registration.schema'
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
import {
  createRoleSchema,
  deactivateMembershipSchema,
  updateOrganizationSchema,
  updateRoleSchema,
} from '@/modules/organizations/organization.schema'
import {
  activateOrganization,
  createRole,
  deactivateMembership,
  updateOrganization,
  updateRole,
} from '@/modules/organizations/organization.server'
import type { OrganizationActionState } from '@/modules/organizations/organization-action-state'
import {
  approveOrganizationRequest,
  rejectOrganizationRequest,
  requestOrganization,
} from '@/modules/organizations/organization-request.server'
import {
  ORGANIZATION_REQUEST_DOCUMENT_TYPES,
  ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES,
} from '@/modules/organizations/organization-request-limits'
import { requestPreRegistration } from '@/modules/organizations/pre-registration.server'

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

export async function createRoleAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')

  if (!z.uuid().safeParse(organizationId).success) {
    return { status: 'error', message: 'Organização inválida.' }
  }

  const parsed = createRoleSchema.safeParse({
    name: readText(formData, 'name'),
    isDirector: formData.get('isDirector') === 'on',
    hasFullAccess: formData.get('hasFullAccess') === 'on',
    isDefault: formData.get('isDefault') === 'on',
    permissionCodes: formData
      .getAll('permissionCodes')
      .filter((value): value is string => typeof value === 'string'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await createRole({
      actorUserId: session.userId,
      organizationId,
      role: parsed.data,
    })

    if (result.status === 'created') {
      revalidatePath(`/app/organizacoes/${organizationId}`)
      revalidatePath(`/app/organizacoes/${organizationId}/cargos`)
      return { status: 'success', message: 'Cargo criado.' }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para criar cargos.',
        }
      case 'invalid-default-role':
        return {
          status: 'error',
          message:
            'O cargo padrão não pode ser de diretoria nem de acesso completo.',
        }
      case 'invalid-permission':
        return {
          status: 'error',
          message: 'Uma das permissões selecionadas é inválida.',
        }
      case 'default-role-exists':
        return {
          status: 'error',
          message: 'Já existe um cargo padrão ativo nesta organização.',
        }
      case 'role-name-exists':
        return {
          status: 'error',
          message: 'Já existe um cargo com este nome.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível criar o cargo agora.',
    }
  } catch {
    console.error('[createRoleAction]', { stage: 'create' })
    return {
      status: 'error',
      message: 'Não foi possível criar o cargo agora.',
    }
  }
}

export async function activateOrganizationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')

  if (!z.uuid().safeParse(organizationId).success) {
    return { status: 'error', message: 'Organização inválida.' }
  }

  try {
    const result = await activateOrganization(session.userId, organizationId)

    if (result.status === 'activated') {
      revalidatePath('/app/organizacoes')
      revalidatePath(`/app/organizacoes/${organizationId}`)
      return {
        status: 'success',
        message: 'Organização ativada com sucesso.',
      }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para ativar a organização.',
        }
      case 'not-found':
        return { status: 'error', message: 'Organização não encontrada.' }
      case 'already-active':
        return { status: 'error', message: 'A organização já está ativa.' }
      case 'missing-default-role':
        return {
          status: 'error',
          message:
            'Crie exatamente um cargo padrão de ingresso ativo, sem diretoria e sem acesso completo.',
        }
      case 'missing-full-access-role':
        return {
          status: 'error',
          message: 'Crie pelo menos um cargo ativo com acesso completo.',
        }
      case 'missing-director-occupant':
        return {
          status: 'error',
          message: 'Todo cargo ativo de diretoria precisa ter um membro ativo.',
        }
      case 'missing-full-access-member':
        return {
          status: 'error',
          message:
            'A organização precisa de pelo menos um membro ativo com cargo de acesso completo.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível ativar a organização agora.',
    }
  } catch {
    console.error('[activateOrganizationAction]', { stage: 'activate' })
    return {
      status: 'error',
      message: 'Não foi possível ativar a organização agora.',
    }
  }
}

export async function requestOrganizationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const cnpj = readText(formData, 'cnpj')
  const acronym = readText(formData, 'acronym')
  const document = formData.get('document')

  if (!(document instanceof File) || document.size === 0) {
    return {
      status: 'error',
      message: 'Anexe a ata de eleição em PDF, JPEG ou PNG.',
    }
  }

  if (document.size > ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES) {
    return {
      status: 'error',
      message: 'A ata deve ter no máximo 3 MB.',
    }
  }

  if (
    !ORGANIZATION_REQUEST_DOCUMENT_TYPES.includes(
      document.type as (typeof ORGANIZATION_REQUEST_DOCUMENT_TYPES)[number],
    )
  ) {
    return {
      status: 'error',
      message: 'A ata deve ser um arquivo PDF, JPEG ou PNG.',
    }
  }

  try {
    const result = await requestOrganization({
      actorUserId: session.userId,
      cnpj,
      acronym,
      documentName: document.name,
      documentType: document.type,
      documentSize: document.size,
      documentData: Buffer.from(await document.arrayBuffer()),
    })

    if (result.status === 'created') {
      revalidatePath('/app/organizacoes')
      revalidatePath('/app/organizacoes/solicitacoes')
      revalidatePath('/app/admin/solicitacoes')

      return {
        status: 'success',
        message:
          'Solicitação enviada. O administrador da plataforma vai analisar a ata de eleição.',
      }
    }

    switch (result.status) {
      case 'invalid-cnpj':
        return { status: 'error', message: 'Informe um CNPJ válido.' }
      case 'invalid-document':
        return {
          status: 'error',
          message: 'A ata deve ser PDF, JPEG ou PNG com até 3 MB.',
        }
      case 'duplicate-organization':
        return {
          status: 'error',
          message: 'Já existe uma organização com este CNPJ.',
        }
      case 'pending-request':
        return {
          status: 'error',
          message: 'Já existe uma solicitação pendente para este CNPJ.',
        }
      case 'lookup-failed':
        return { status: 'error', message: result.message }
    }
  } catch {
    console.error('[requestOrganizationAction]', { stage: 'request' })
    return {
      status: 'error',
      message: 'Não foi possível enviar a solicitação agora.',
    }
  }
}

export async function approveOrganizationRequestAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const requestId = readText(formData, 'requestId')

  if (!z.uuid().safeParse(requestId).success) {
    return { status: 'error', message: 'Solicitação inválida.' }
  }

  try {
    const result = await approveOrganizationRequest(session.userId, requestId)

    if (result.status === 'approved') {
      revalidatePath('/app/admin/solicitacoes')
      revalidatePath('/app/organizacoes')
      revalidatePath('/app/organizacoes/solicitacoes')
      return {
        status: 'success',
        message: 'Solicitação aprovada e organização criada.',
      }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para aprovar solicitações.',
        }
      case 'not-found':
        return { status: 'error', message: 'Solicitação não encontrada.' }
      case 'already-reviewed':
        return {
          status: 'error',
          message: 'Esta solicitação já foi analisada.',
        }
      case 'duplicate-organization':
        return {
          status: 'error',
          message: 'Já existe uma organização com este CNPJ.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível aprovar a solicitação agora.',
    }
  } catch {
    console.error('[approveOrganizationRequestAction]', { stage: 'approve' })
    return {
      status: 'error',
      message: 'Não foi possível aprovar a solicitação agora.',
    }
  }
}

export async function rejectOrganizationRequestAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const requestId = readText(formData, 'requestId')
  const reason = readText(formData, 'reason')

  if (!z.uuid().safeParse(requestId).success) {
    return { status: 'error', message: 'Solicitação inválida.' }
  }

  if (reason.length < 3) {
    return {
      status: 'error',
      message: 'Informe o motivo da rejeição.',
    }
  }

  try {
    const result = await rejectOrganizationRequest(
      session.userId,
      requestId,
      reason,
    )

    if (result.status === 'rejected') {
      revalidatePath('/app/admin/solicitacoes')
      revalidatePath('/app/organizacoes/solicitacoes')
      return { status: 'success', message: 'Solicitação rejeitada.' }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para rejeitar solicitações.',
        }
      case 'not-found':
        return { status: 'error', message: 'Solicitação não encontrada.' }
      case 'already-reviewed':
        return {
          status: 'error',
          message: 'Esta solicitação já foi analisada.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível rejeitar a solicitação agora.',
    }
  } catch {
    console.error('[rejectOrganizationRequestAction]', { stage: 'reject' })
    return {
      status: 'error',
      message: 'Não foi possível rejeitar a solicitação agora.',
    }
  }
}

export async function deactivateMembershipAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')
  const membershipId = readText(formData, 'membershipId')
  const parsed = deactivateMembershipSchema.safeParse({
    reason: readText(formData, 'reason'),
  })

  if (
    !z.uuid().safeParse(organizationId).success ||
    !z.uuid().safeParse(membershipId).success
  ) {
    return { status: 'error', message: 'Vínculo inválido.' }
  }

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Informe o motivo.',
    }
  }

  try {
    const result = await deactivateMembership({
      actorUserId: session.userId,
      membershipId,
      reason: parsed.data.reason,
    })

    if (result.status === 'deactivated') {
      revalidatePath(`/app/organizacoes/${organizationId}`)
      revalidatePath(`/app/organizacoes/${organizationId}/membros`)
      return { status: 'success', message: 'Vínculo desativado.' }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para desativar vínculos.',
        }
      case 'not-found':
        return { status: 'error', message: 'Vínculo não encontrado.' }
      case 'already-inactive':
        return { status: 'error', message: 'Este vínculo já está inativo.' }
      case 'last-full-access-member':
        return {
          status: 'error',
          message:
            'A organização precisa manter pelo menos um membro ativo com acesso completo.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível desativar o vínculo agora.',
    }
  } catch {
    console.error('[deactivateMembershipAction]', { stage: 'deactivate' })
    return {
      status: 'error',
      message: 'Não foi possível desativar o vínculo agora.',
    }
  }
}

export async function updateRoleAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')
  const roleId = readText(formData, 'roleId')

  if (
    !z.uuid().safeParse(organizationId).success ||
    !z.uuid().safeParse(roleId).success
  ) {
    return { status: 'error', message: 'Cargo inválido.' }
  }

  const parsed = updateRoleSchema.safeParse({
    name: readText(formData, 'name'),
    isDirector: formData.get('isDirector') === 'on',
    hasFullAccess: formData.get('hasFullAccess') === 'on',
    isDefault: formData.get('isDefault') === 'on',
    isActive: formData.get('isActive') === 'on',
    permissionCodes: formData
      .getAll('permissionCodes')
      .filter((value): value is string => typeof value === 'string'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await updateRole({
      actorUserId: session.userId,
      organizationId,
      roleId,
      role: parsed.data,
    })

    if (result.status === 'updated') {
      revalidatePath(`/app/organizacoes/${organizationId}`)
      revalidatePath(`/app/organizacoes/${organizationId}/cargos`)
      revalidatePath(`/app/organizacoes/${organizationId}/cargos/${roleId}`)
      return { status: 'success', message: 'Cargo atualizado.' }
    }

    switch (result.status) {
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para editar cargos.',
        }
      case 'not-found':
        return { status: 'error', message: 'Cargo não encontrado.' }
      case 'invalid-default-role':
        return {
          status: 'error',
          message:
            'O cargo padrão não pode ser de diretoria nem de acesso completo.',
        }
      case 'invalid-permission':
        return {
          status: 'error',
          message: 'Uma das permissões selecionadas é inválida.',
        }
      case 'default-role-exists':
        return {
          status: 'error',
          message: 'Já existe outro cargo padrão ativo nesta organização.',
        }
      case 'role-name-exists':
        return {
          status: 'error',
          message: 'Já existe um cargo com este nome.',
        }
      case 'role-in-use':
        return {
          status: 'error',
          message:
            'Este cargo possui vínculos ou convites em uso e não pode ser desativado.',
        }
      case 'default-role-required':
        return {
          status: 'error',
          message:
            'A organização ativa precisa manter um cargo padrão de ingresso ativo.',
        }
      case 'full-access-required':
        return {
          status: 'error',
          message:
            'A organização precisa manter um membro ativo com acesso completo.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível atualizar o cargo agora.',
    }
  } catch {
    console.error('[updateRoleAction]', { stage: 'update' })
    return {
      status: 'error',
      message: 'Não foi possível atualizar o cargo agora.',
    }
  }
}

export async function requestPreRegistrationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')
  const roleId = readText(formData, 'roleId')

  if (
    !z.uuid().safeParse(organizationId).success ||
    !z.uuid().safeParse(roleId).success
  ) {
    return { status: 'error', message: 'Organização ou cargo inválido.' }
  }

  const parsed = requestRegistrationSchema.safeParse({
    name: readText(formData, 'name'),
    documentNumber: readText(formData, 'documentNumber'),
    email: readText(formData, 'email'),
    phone: readText(formData, 'phone'),
    birthDate: readText(formData, 'birthDate'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await requestPreRegistration({
      actorUserId: session.userId,
      organizationId,
      roleId,
      person: parsed.data,
    })

    switch (result.status) {
      case 'link-sent':
        return {
          status: 'success',
          message: result.contactConflict
            ? `Link enviado para ${result.sentTo}. O contato informado difere do cadastro existente; a pessoa poderá revisá-lo ao concluir a conta.`
            : `Link de ativação enviado para ${result.sentTo}.`,
        }
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para pré-cadastrar pessoas.',
        }
      case 'invalid-role':
        return {
          status: 'error',
          message: 'O cargo selecionado não está ativo nesta organização.',
        }
      case 'role-not-allowed':
        return {
          status: 'error',
          message:
            'Você não pode atribuir um cargo com acesso completo sem ter acesso completo.',
        }
      case 'account-exists':
        return {
          status: 'error',
          message:
            'Esta pessoa já possui conta. Envie um convite para ela ingressar na organização.',
        }
      case 'already-member':
        return {
          status: 'error',
          message:
            'Esta pessoa já possui vínculo com a organização. Reative o vínculo por convite, se necessário.',
        }
      case 'rate-limited':
        return {
          status: 'error',
          message:
            'Já foi enviado um link recentemente. Aguarde um minuto antes de tentar novamente.',
        }
    }

    return {
      status: 'error',
      message: 'Não foi possível pré-cadastrar a pessoa agora.',
    }
  } catch {
    console.error('[requestPreRegistrationAction]', { stage: 'request' })
    return {
      status: 'error',
      message: 'Não foi possível pré-cadastrar a pessoa agora.',
    }
  }
}

export async function updateOrganizationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')

  if (!z.uuid().safeParse(organizationId).success) {
    return { status: 'error', message: 'Organização inválida.' }
  }

  const parsed = updateOrganizationSchema.safeParse({
    acronym: readText(formData, 'acronym'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira a sigla.',
    }
  }

  try {
    const result = await updateOrganization({
      actorUserId: session.userId,
      organizationId,
      data: parsed.data,
    })

    if (result.status === 'updated') {
      revalidatePath(`/app/organizacoes/${organizationId}`)
      revalidatePath(`/app/organizacoes/${organizationId}/configuracoes`)
      return { status: 'success', message: 'Sigla atualizada.' }
    }

    if (result.status === 'forbidden') {
      return {
        status: 'error',
        message: 'Você não tem permissão para editar a organização.',
      }
    }

    return { status: 'error', message: 'Organização não encontrada.' }
  } catch {
    console.error('[updateOrganizationAction]', { stage: 'update' })
    return {
      status: 'error',
      message: 'Não foi possível atualizar a organização agora.',
    }
  }
}
