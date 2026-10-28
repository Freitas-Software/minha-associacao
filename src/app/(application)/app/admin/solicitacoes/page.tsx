import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { isPlatformAdmin } from '@/modules/authorization/authorize.server'
import {
  listOrganizationRequests,
  type OrganizationRequestStatus,
} from '@/modules/organizations/organization-request.server'
import { ReviewRequestActions } from './components/review-request-actions'

export const metadata: Metadata = {
  title: 'Solicitações de organizações',
  robots: { index: false, follow: false },
}

type AdminRequestsPageProps = {
  searchParams: Promise<{
    status?: string | string[]
    page?: string | string[]
  }>
}

const statusLabels: Record<OrganizationRequestStatus, string> = {
  pending: 'Pendentes',
  approved: 'Aprovadas',
  rejected: 'Rejeitadas',
}

const statusTabs: OrganizationRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
]
const pageSize = 20

function resolveStatus(
  value: string | string[] | undefined,
): OrganizationRequestStatus {
  if (value === 'approved' || value === 'rejected') return value
  return 'pending'
}

function resolvePage(value: string | string[] | undefined): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function pageHref(status: OrganizationRequestStatus, page: number): string {
  const params = new URLSearchParams()

  if (status !== 'pending') params.set('status', status)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()

  return `/app/admin/solicitacoes${query ? `?${query}` : ''}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function statusBadgeVariant(
  status: OrganizationRequestStatus,
): 'default' | 'secondary' | 'destructive' {
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

async function AdminRequestsContent({ searchParams }: AdminRequestsPageProps) {
  await io()

  const params = await searchParams
  const status = resolveStatus(params.status)
  const page = resolvePage(params.page)
  const session = await requireSession()

  if (!(await isPlatformAdmin(session.userId))) notFound()

  const data = await listOrganizationRequests(session.userId, status, {
    limit: pageSize + 1,
    offset: (page - 1) * pageSize,
  })

  if (data.status !== 'ok') notFound()

  const hasNext = data.requests.length > pageSize
  const requests = hasNext ? data.requests.slice(0, pageSize) : data.requests

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
          {status === 'pending'
            ? 'Analise a ata de eleição e aprove ou rejeite a criação da organização.'
            : 'Consulte o histórico de solicitações já analisadas.'}
        </p>
      </header>

      <nav aria-label="Filtrar solicitações" className="flex flex-wrap gap-2">
        {statusTabs.map(tab => {
          const active = tab === status

          return (
            <Link
              key={tab}
              href={pageHref(tab, 1)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                  : 'rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
              }
            >
              {statusLabels[tab]}
            </Link>
          )
        })}
      </nav>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-6">
          <p className="text-sm text-muted-foreground">
            Nenhuma solicitação {statusLabels[status].toLowerCase()}.
          </p>
          {status === 'pending' ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Novas solicitações de criação de organização aparecerão aqui.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map(request => (
            <li
              key={request.id}
              className="space-y-4 rounded-lg border bg-background p-5"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{request.legalName}</h2>
                  <Badge variant={statusBadgeVariant(request.status)}>
                    {statusLabels[request.status]}
                  </Badge>
                </div>
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
                  {request.reviewedAt ? (
                    <>
                      {' '}
                      · Analisada em{' '}
                      <time dateTime={request.reviewedAt.toISOString()}>
                        {formatDate(request.reviewedAt)}
                      </time>
                    </>
                  ) : null}
                </p>
                {request.status === 'rejected' && request.rejectionReason ? (
                  <p className="text-sm text-muted-foreground">
                    Motivo da rejeição: {request.rejectionReason}
                  </p>
                ) : null}
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

              {request.status === 'pending' ? (
                <ReviewRequestActions requestId={request.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <nav
          aria-label="Paginação das solicitações"
          className="flex flex-wrap items-center gap-3"
        >
          {page > 1 ? (
            <Link
              href={pageHref(status, page - 1)}
              className="text-sm underline underline-offset-4"
            >
              ← Anterior
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={pageHref(status, page + 1)}
              className="text-sm underline underline-offset-4"
            >
              Próxima →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  )
}

export default function AdminRequestsPage({
  searchParams,
}: AdminRequestsPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando solicitações…
        </p>
      }
    >
      <AdminRequestsContent searchParams={searchParams} />
    </Suspense>
  )
}
