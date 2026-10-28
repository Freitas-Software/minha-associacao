import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { listUserOrganizationRequests } from '@/modules/organizations/organization-request.server'

export const metadata: Metadata = {
  title: 'Minhas solicitações',
  robots: { index: false, follow: false },
}

function statusLabel(status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved')
    return { label: 'Aprovada', variant: 'default' as const }
  if (status === 'rejected') {
    return { label: 'Rejeitada', variant: 'destructive' as const }
  }
  return { label: 'Pendente', variant: 'secondary' as const }
}

async function RequestsContent() {
  await io()

  const session = await requireSession()
  const requests = await listUserOrganizationRequests(session.userId)

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/app/organizacoes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Minhas organizações
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Minhas solicitações
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a análise das solicitações de criação de organização.
        </p>
        <Link
          href="/app/organizacoes/nova"
          className="inline-block text-sm underline underline-offset-4"
        >
          Solicitar nova organização
        </Link>
      </header>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma solicitação enviada ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map(request => {
            const status = statusLabel(request.status)

            return (
              <li
                key={request.id}
                className="rounded-lg border bg-background p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{request.legalName}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.acronym} · CNPJ {request.cnpj}
                </p>
                {request.status === 'rejected' && request.rejectionReason ? (
                  <p className="mt-2 text-sm text-destructive">
                    Motivo: {request.rejectionReason}
                  </p>
                ) : null}
                {request.status === 'approved' && request.organizationId ? (
                  <Link
                    href={`/app/organizacoes/${request.organizationId}`}
                    className="mt-3 inline-block text-sm underline underline-offset-4"
                  >
                    Abrir organização
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando solicitações…
        </p>
      }
    >
      <RequestsContent />
    </Suspense>
  )
}
