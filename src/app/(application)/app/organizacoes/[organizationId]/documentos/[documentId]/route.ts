import { requireSession } from '@/lib/session'
import { getOrganizationDocumentDownload } from '@/modules/organizations/organization-document.server'

type DocumentRouteProps = {
  params: Promise<{ organizationId: string; documentId: string }>
}

export async function GET(_request: Request, { params }: DocumentRouteProps) {
  const session = await requireSession()
  const { organizationId, documentId } = await params
  const document = await getOrganizationDocumentDownload(
    session.userId,
    organizationId,
    documentId,
  )

  if (document.status !== 'ok') {
    return new Response(
      document.status === 'forbidden'
        ? 'Você não tem permissão para baixar este documento.'
        : 'Documento não encontrado.',
      { status: document.status === 'forbidden' ? 403 : 404 },
    )
  }

  return new Response(document.data, {
    headers: {
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
