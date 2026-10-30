import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCnpj } from '@/lib/formatters'
import { requireSession } from '@/lib/session'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import { getOrganizationSummary } from '@/modules/organizations/organization.server'
import { OrganizationSettingsForm } from './components/organization-settings-form'

export const metadata: Metadata = {
  title: 'Configurações da organização',
  robots: { index: false, follow: false },
}

type SettingsPageProps = {
  params: Promise<{ organizationId: string }>
}

async function SettingsContent({ params }: SettingsPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const summary = await getOrganizationSummary(session.userId, organizationId)

  if (summary.status !== 'ok') notFound()

  const canUpdate =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.organizationUpdate)

  if (!canUpdate) notFound()

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← {summary.organization.acronym}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Configurações da organização
          </h1>
          <Badge
            variant={
              summary.organization.status === 'active' ? 'default' : 'secondary'
            }
          >
            {summary.organization.status === 'active'
              ? 'Ativa'
              : summary.organization.status === 'closed'
                ? 'Encerrada'
                : 'Em configuração'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.organization.legalName}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <h2 className="text-sm font-medium text-muted-foreground">CNPJ</h2>
          <p className="mt-1 font-medium">
            {formatCnpj(summary.organization.cnpj)}
          </p>
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Razão social
          </h2>
          <p className="mt-1 font-medium">{summary.organization.legalName}</p>
        </div>
      </section>

      <section className="rounded-lg border bg-background p-6">
        <OrganizationSettingsForm
          organizationId={summary.organization.id}
          acronym={summary.organization.acronym}
        />
      </section>
    </main>
  )
}

export default function SettingsPage({ params }: SettingsPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando configurações…
        </p>
      }
    >
      <SettingsContent params={params} />
    </Suspense>
  )
}
