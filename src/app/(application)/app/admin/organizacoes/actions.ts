'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/session'
import { createOrganizationSchema } from '@/modules/organizations/organization.schema'
import { createOrganization } from '@/modules/organizations/organization.server'
import type { OrganizationActionState } from '@/modules/organizations/organization-action-state'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

export async function createOrganizationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const parsed = createOrganizationSchema.safeParse({
    cnpj: readText(formData, 'cnpj'),
    acronym: readText(formData, 'acronym'),
    granteeDocumentNumber: readText(formData, 'granteeDocumentNumber'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Confira os campos.',
    }
  }

  try {
    const result = await createOrganization({
      actorUserId: session.userId,
      cnpj: parsed.data.cnpj,
      acronym: parsed.data.acronym,
      granteeDocumentNumber: parsed.data.granteeDocumentNumber,
    })

    switch (result.status) {
      case 'created':
        revalidatePath('/app/admin/organizacoes')
        return {
          status: 'success',
          message:
            'Organização criada em configuração. A concessão temporária foi registrada para o CPF indicado.',
        }
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para criar organizações.',
        }
      case 'invalid-cnpj':
        return { status: 'error', message: 'Informe um CNPJ válido.' }
      case 'invalid-document':
        return { status: 'error', message: 'Informe um CPF válido.' }
      case 'grantee-not-found':
        return {
          status: 'error',
          message:
            'Não existe pessoa cadastrada com este CPF. Peça o cadastro antes de criar a organização.',
        }
      case 'duplicate-cnpj':
        return {
          status: 'error',
          message: 'Já existe uma organização com este CNPJ.',
        }
      case 'lookup-failed':
        return { status: 'error', message: result.message }
    }
  } catch {
    console.error('[createOrganizationAction]', { stage: 'create' })
    return {
      status: 'error',
      message: 'Não foi possível criar a organização agora.',
    }
  }
}
