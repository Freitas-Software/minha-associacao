import { getCurrentSession } from '@/lib/session'
import { getOrganizationRequestDocument } from '@/modules/organizations/organization-request.server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await getCurrentSession()

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { requestId } = await params
  const document = await getOrganizationRequestDocument(
    session.userId,
    requestId,
  )

  if (document.status === 'forbidden') {
    return new Response('Forbidden', { status: 403 })
  }

  if (document.status === 'not-found') {
    return new Response('Not found', { status: 404 })
  }

  const filename = document.name.replaceAll(/[^\w.-]+/g, '_')

  return new Response(new Uint8Array(document.data), {
    headers: {
      'Content-Type': document.type,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
