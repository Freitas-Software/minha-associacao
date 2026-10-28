import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { isPlatformAdmin } from '@/modules/authorization/authorize.server'
import { listPendingOrganizationRequests } from '@/modules/organizations/organization-request.server'
import { ReviewRequestActions } from './components/review-request-actions'

export const metadata: Metadata = {
  title: 'Solicitações de organizações',
  robots: { index: false, follow: false },
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function AdminRequestsContent() {
  await io()

  const session = await requireSession()

  if (!(await isPlatformAdmin(session.userId))) notFound()

  const data = await listPendingOrganizationRequests(session.userId)

  if (data.status !== 'ok') notFound()

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/app/organizacoes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Aplicação
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Solicitações de organizações
        </h1>
        <p className="text-sm text-muted-foreground">
          Analise a ata de eleição e aprove ou rejeite a criação da organização.
        </p>
      </header>

      {data.requests.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-6">
          <p className="text-sm text-muted-foreground">
            Nenhuma solicitação pendente.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Novas solicitações de criação de organização aparecerão aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.requests.map(request => (
            <li
              key={request.id}
              className="space-y-4 rounded-lg border bg-background p-5"
            >
              <div className="space-y-1">
                <h2 className="font-semibold">{request.legalName}</h2>
                <p className="text-sm text-muted-foreground">
                  {request.acronym} · CNPJ {request.cnpj}
                </p>
                <p className="text-sm break-words text-muted-foreground">
                  Solicitante: {request.requesterName} ({request.requesterEmail}
                  )
                </p>
                <p className="text-xs text-muted-foreground">
                  Enviada em{' '}
                  <time dateTime={request.createdAt.toISOString()}>
                    {formatDate(request.createdAt)}
                  </time>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a
                  href={`/app/admin/solicitacoes/${request.id}/documento`}
                  className="break-all underline underline-offset-4"
                >
                  Baixar ata ({request.documentName},{' '}
                  {formatSize(request.documentSize)})
                </a>
              </div>

              <ReviewRequestActions requestId={request.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default function AdminRequestsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando solicitações…
        </p>
      }
    >
      <AdminRequestsContent />
    </Suspense>
  )
}
