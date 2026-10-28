'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/session'
import { changePasswordSchema } from '@/modules/identity/change-password.schema'
import { changePassword } from '@/modules/identity/change-password.server'
import {
  confirmEmailChangeSchema,
  requestEmailChangeSchema,
} from '@/modules/identity/email-change.schema'
import {
  confirmEmailChange,
  requestEmailChange,
} from '@/modules/identity/email-change.server'
import { updateProfileSchema } from '@/modules/identity/profile.schema'
import { updateProfile } from '@/modules/identity/profile.server'
import type { ProfileActionState } from '@/modules/identity/profile-action-state'

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requireSession()
  const parsed = updateProfileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await updateProfile({
      userId: session.userId,
      data: parsed.data,
    })

    if (result.status === 'updated') {
      revalidatePath('/app/perfil')
      return { status: 'success', message: 'Perfil atualizado.' }
    }

    if (result.status === 'phone-in-use') {
      return {
        status: 'error',
        message: 'Este telefone já está cadastrado para outra pessoa.',
      }
    }

    return { status: 'error', message: 'Perfil não encontrado.' }
  } catch {
    console.error('[updateProfileAction]', { stage: 'update' })
    return {
      status: 'error',
      message: 'Não foi possível atualizar o perfil agora.',
    }
  }
}

export async function requestEmailChangeAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requireSession()
  const parsed = requestEmailChangeSchema.safeParse({
    newEmail: formData.get('newEmail'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await requestEmailChange({
      userId: session.userId,
      data: parsed.data,
    })

    switch (result.status) {
      case 'link-sent':
        return {
          status: 'success',
          message: `Link de confirmação enviado para ${result.email}. Abra o link para concluir a alteração.`,
        }
      case 'invalid-password':
        return { status: 'error', message: 'A senha atual está incorreta.' }
      case 'same-email':
        return {
          status: 'error',
          message: 'O novo email é igual ao email atual.',
        }
      case 'email-in-use':
        return {
          status: 'error',
          message: 'Este email já está cadastrado para outra pessoa.',
        }
      case 'rate-limited':
        return {
          status: 'error',
          message:
            'Já foi solicitado um link recentemente. Aguarde um minuto antes de tentar novamente.',
        }
      case 'not-found':
        return { status: 'error', message: 'Perfil não encontrado.' }
    }

    return {
      status: 'error',
      message: 'Não foi possível solicitar a alteração de email agora.',
    }
  } catch {
    console.error('[requestEmailChangeAction]', { stage: 'request' })
    return {
      status: 'error',
      message: 'Não foi possível solicitar a alteração de email agora.',
    }
  }
}

export async function confirmEmailChangeAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requireSession()
  const parsed = confirmEmailChangeSchema.safeParse({
    token: formData.get('token'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Link inválido.',
    }
  }

  try {
    const result = await confirmEmailChange({
      userId: session.userId,
      token: parsed.data.token,
    })

    if (result.status === 'confirmed') {
      revalidatePath('/app/perfil')
      return { status: 'success', message: 'Email alterado e confirmado.' }
    }

    if (result.status === 'email-in-use') {
      return {
        status: 'error',
        message: 'Este email já está cadastrado para outra pessoa.',
      }
    }

    return {
      status: 'error',
      message:
        'Este link não pode mais ser utilizado. Solicite uma nova alteração de email.',
    }
  } catch {
    console.error('[confirmEmailChangeAction]', { stage: 'confirm' })
    return {
      status: 'error',
      message: 'Não foi possível confirmar a alteração de email agora.',
    }
  }
}

export async function changePasswordAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requireSession()
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await changePassword({
      userId: session.userId,
      currentSessionId: session.sessionId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    })

    switch (result.status) {
      case 'changed':
        revalidatePath('/app/perfil')
        return {
          status: 'success',
          message:
            'Senha alterada. As outras sessões da sua conta foram encerradas.',
        }
      case 'invalid-password':
        return { status: 'error', message: 'A senha atual está incorreta.' }
      case 'same-password':
        return {
          status: 'error',
          message: 'A nova senha deve ser diferente da senha atual.',
        }
      case 'not-found':
        return { status: 'error', message: 'Conta não encontrada.' }
    }

    return {
      status: 'error',
      message: 'Não foi possível alterar a senha agora.',
    }
  } catch {
    console.error('[changePasswordAction]', { stage: 'change' })
    return {
      status: 'error',
      message: 'Não foi possível alterar a senha agora.',
    }
  }
}
