'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/session'
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
