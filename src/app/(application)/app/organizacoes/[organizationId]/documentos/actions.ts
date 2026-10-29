'use server'

import { revalidatePath } from 'next/cache'
import z from 'zod'
import { requireSession } from '@/lib/session'
import type { OrganizationActionState } from '@/modules/organizations/organization-action-state'
import { uploadOrganizationDocument } from '@/modules/organizations/organization-document.server'
import {
  ORGANIZATION_DOCUMENT_MAX_BYTES,
  ORGANIZATION_DOCUMENT_TYPES,
  type OrganizationDocumentType,
} from '@/modules/organizations/organization-document-policy'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

export async function uploadOrganizationDocumentAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const session = await requireSession()
  const organizationId = readText(formData, 'organizationId')

  if (!z.uuid().safeParse(organizationId).success) {
    return { status: 'error', message: 'Organização inválida.' }
  }

  const type = readText(formData, 'type')

  if (!ORGANIZATION_DOCUMENT_TYPES.includes(type as OrganizationDocumentType)) {
    return { status: 'error', message: 'Tipo de documento inválido.' }
  }

  const file = formData.get('document')

  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Selecione um arquivo para enviar.' }
  }

  if (file.size > ORGANIZATION_DOCUMENT_MAX_BYTES) {
    return {
      status: 'error',
      message: 'O arquivo deve ter no máximo 3 MB.',
    }
  }

  try {
    const result = await uploadOrganizationDocument({
      actorUserId: session.userId,
      organizationId,
      type,
      fileName: file.name,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    })

    switch (result.status) {
      case 'uploaded':
        revalidatePath(`/app/organizacoes/${organizationId}/documentos`)
        revalidatePath(`/app/organizacoes/${organizationId}`)
        return { status: 'success', message: 'Documento enviado.' }
      case 'forbidden':
        return {
          status: 'error',
          message: 'Você não tem permissão para enviar documentos.',
        }
      case 'invalid-type':
        return { status: 'error', message: 'Tipo de documento inválido.' }
      case 'invalid-file':
        return {
          status: 'error',
          message: 'Envie um arquivo PDF, JPEG ou PNG de até 3 MB.',
        }
      case 'storage-failed':
        return {
          status: 'error',
          message:
            'O armazenamento de documentos está indisponível. Tente novamente.',
        }
    }
  } catch {
    console.error('[uploadOrganizationDocumentAction]', {
      stage: 'upload',
    })
    return {
      status: 'error',
      message: 'Não foi possível enviar o documento agora.',
    }
  }
}
