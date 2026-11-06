import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/session'
import { listAuditEvents } from '@/modules/audit/audit.server'
import { getOrganizationSummary } from '@/modules/organizations/organization.server'

export const metadata: Metadata = {
  title: 'Auditoria',
  robots: { index: false, follow: false },
}

type AuditPageProps = {
  params: Promise<{ organizationId: string }>
  searchParams: Promise<{
    action?: string | string[]
    page?: string | string[]
  }>
}

const pageSize = 30

function resolveAction(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function resolvePage(value: string | string[] | undefined): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function pageHref(
  organizationId: string,
  action: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams()

  if (action) params.set('action', action)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()

  return `/app/organizacoes/${organizationId}/auditoria${query ? `?${query}` : ''}`
}

const actionLabels: Record<string, string> = {
  'organization.created': 'Organização criada',
  'organization.updated': 'Sigla atualizada',
  'organization.activated': 'Organização ativada',
  'organization.closed': 'Organização encerrada',
  'organization.reopened': 'Organização reaberta',
  'organization.requested': 'Solicitação de organização',
  'organization.request_approved': 'Solicitação aprovada',
  'organization.request_rejected': 'Solicitação rejeitada',
  'role.created': 'Cargo criado',
  'role.updated': 'Cargo atualizado',
  'invite.created': 'Convite criado',
  'invite.revoked': 'Convite revogado',
  'membership.deactivated': 'Vínculo desativado',
  'membership.role_changed': 'Cargo do vínculo alterado',
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

async function AuditContent({ params, searchParams }: AuditPageProps) {
  await io()

  const { organizationId } = await params
  const query = await searchParams
  const action = resolveAction(query.action)
  const page = resolvePage(query.page)
  const session = await requireSession()
  const [summary, auditData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listAuditEvents(session.userId, organizationId, {
      action,
      limit: pageSize + 1,
      offset: (page - 1) * pageSize,
    }),
  ])

  if (summary.status !== 'ok' || auditData.status !== 'ok') notFound()

  const hasNext = auditData.events.length > pageSize
  const events = hasNext
    ? auditData.events.slice(0, pageSize)
    : auditData.events

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← {summary.organization.acronym}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Eventos registrados na organização.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="audit-action" className="block text-sm font-medium">
            Filtrar por evento
          </label>
          <select
            id="audit-action"
            name="action"
            defaultValue={action ?? ''}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">Todos os eventos</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum evento encontrado.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map(event => {
            const hasMetadata = Object.keys(event.metadata).length > 0

            return (
              <li
                key={event.id}
                className="rounded-lg border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {actionLabels[event.action] ?? event.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorName ?? 'Sistema'} ·{' '}
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.entityType}
                    {event.entityId ? ` · ${event.entityId.slice(0, 8)}` : ''}
                  </p>
                </div>

                {hasMetadata ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Detalhes
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <nav
          aria-label="Paginação da auditoria"
          className="flex flex-wrap items-center gap-3"
        >
          {page > 1 ? (
            <Link
              href={pageHref(summary.organization.id, action, page - 1)}
              className="text-sm underline underline-offset-4"
            >
              ← Anterior
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={pageHref(summary.organization.id, action, page + 1)}
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

export default function AuditPage({ params, searchParams }: AuditPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando auditoria…
        </p>
      }
    >
      <AuditContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
