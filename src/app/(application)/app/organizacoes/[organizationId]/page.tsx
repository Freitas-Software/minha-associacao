import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCnpj } from '@/lib/formatters'
import { requireSession } from '@/lib/session'
import {
  PERMISSIONS,
  type PermissionCode,
} from '@/modules/authorization/permissions'
import {
  getOrganizationOverview,
  type OrganizationOverview,
} from '@/modules/organizations/organization.server'
import { OverviewDirectors } from './components/overview-directors'
import { OverviewDocuments } from './components/overview-documents'
import { OverviewKpis } from './components/overview-kpis'
import {
  type OverviewCapabilities,
  OverviewNavigation,
} from './components/overview-navigation'
import { OverviewPreRegistrations } from './components/overview-pre-registrations'
import { OverviewReadiness } from './components/overview-readiness'
import { OverviewRecentEvents } from './components/overview-recent-events'
import { OverviewSituation } from './components/overview-situation'

export const metadata: Metadata = {
  title: 'Organização',
  robots: { index: false, follow: false },
}

type OrganizationPageProps = {
  params: Promise<{ organizationId: string }>
}

const statusLabels = {
  active: 'Ativa',
  provisioning: 'Em configuração',
  closed: 'Encerrada',
} as const

function hasPermission(
  summary: Extract<OrganizationOverview, { status: 'ok' }>['summary'],
  permission: PermissionCode,
): boolean {
  return (
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(permission)
  )
}

async function OrganizationContent({ params }: OrganizationPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const overview = await getOrganizationOverview(session.userId, organizationId)

  if (overview.status !== 'ok') notFound()

  const { summary, counts, directors, recentEvents, documents, readiness } =
    overview
  const { organization } = summary

  const capabilities: OverviewCapabilities = {
    viewMembers: hasPermission(summary, PERMISSIONS.membersRead),
    manageRoles: hasPermission(summary, PERMISSIONS.rolesManage),
    manageInvites: hasPermission(summary, PERMISSIONS.invitesManage),
    viewDocuments: hasPermission(summary, PERMISSIONS.organizationRead),
    updateOrganization: hasPermission(summary, PERMISSIONS.organizationUpdate),
    viewAudit: hasPermission(summary, PERMISSIONS.auditRead),
  }
  const canActivate = hasPermission(summary, PERMISSIONS.organizationActivate)
  const canClose = hasPermission(summary, PERMISSIONS.organizationClose)

  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <Link
          href="/app/organizacoes"
          className="inline-block text-sm text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Minhas organizações
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight break-words">
            {organization.legalName}
          </h1>
          <Badge
            variant={organization.status === 'active' ? 'default' : 'secondary'}
          >
            {statusLabels[organization.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {organization.acronym} · CNPJ{' '}
          <span className="tabular-nums">{formatCnpj(organization.cnpj)}</span>
        </p>
        <OverviewNavigation
          organizationId={organization.id}
          capabilities={capabilities}
        />
      </header>

      {organization.status === 'closed' ? (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Esta organização está encerrada. O acesso é somente para leitura até
          que alguém com a permissão de encerrar e reabrir a organização a
          reative.
        </p>
      ) : null}

      <OverviewKpis counts={counts} />

      {organization.status === 'provisioning' ? (
        <OverviewReadiness
          organizationId={organization.id}
          readiness={canActivate ? readiness : null}
          canActivate={canActivate}
        />
      ) : null}

      {counts.pendingPreRegistrations !== null &&
      counts.pendingPreRegistrations > 0 ? (
        <OverviewPreRegistrations
          organizationId={organization.id}
          count={counts.pendingPreRegistrations}
        />
      ) : null}

      {directors !== null || recentEvents !== null ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {directors !== null ? (
            <div
              className={
                recentEvents !== null ? 'lg:col-span-7' : 'lg:col-span-12'
              }
            >
              <OverviewDirectors directors={directors} />
            </div>
          ) : null}
          {recentEvents !== null ? (
            <div
              className={
                directors !== null ? 'lg:col-span-5' : 'lg:col-span-12'
              }
            >
              <OverviewRecentEvents events={recentEvents} />
            </div>
          ) : null}
        </div>
      ) : null}

      {documents !== null ? (
        <OverviewDocuments
          organizationId={organization.id}
          documents={documents}
        />
      ) : null}

      <OverviewSituation
        organizationId={organization.id}
        status={organization.status}
        closedAt={organization.closedAt}
        canClose={canClose}
      />
    </main>
  )
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando organização…
        </p>
      }
    >
      <OrganizationContent params={params} />
    </Suspense>
  )
}
