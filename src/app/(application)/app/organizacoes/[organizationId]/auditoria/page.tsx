import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { listAuditEvents } from '@/modules/audit/audit.server'
import { getOrganizationSummary } from '@/modules/organizations/organization.server'

export const metadata: Metadata = {
  title: 'Auditoria',
  robots: { index: false, follow: false },
}

type AuditPageProps = {
  params: Promise<{ organizationId: string }>
}

const actionLabels: Record<string, string> = {
  'organization.created': 'Organização criada',
  'organization.updated': 'Sigla atualizada',
  'organization.activated': 'Organização ativada',
  'organization.requested': 'Solicitação de organização',
  'organization.request_approved': 'Solicitação aprovada',
  'organization.request_rejected': 'Solicitação rejeitada',
  'role.created': 'Cargo criado',
  'role.updated': 'Cargo atualizado',
  'invite.created': 'Convite criado',
  'invite.revoked': 'Convite revogado',
  'membership.deactivated': 'Vínculo desativado',
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

async function AuditContent({ params }: AuditPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const [summary, auditData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listAuditEvents(session.userId, organizationId),
  ])

  if (summary.status !== 'ok' || auditData.status !== 'ok') notFound()

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
          Últimos eventos registrados na organização.
        </p>
      </header>

      {auditData.events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {auditData.events.map(event => {
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
    </main>
  )
}

export default function AuditPage({ params }: AuditPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando auditoria…
        </p>
      }
    >
      <AuditContent params={params} />
    </Suspense>
  )
}
