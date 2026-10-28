import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import {
  getOrganizationSummary,
  listRoles,
} from '@/modules/organizations/organization.server'
import { CreateRoleForm } from './components/create-role-form'

export const metadata: Metadata = {
  title: 'Cargos',
  robots: { index: false, follow: false },
}

type RolesPageProps = {
  params: Promise<{ organizationId: string }>
}

async function RolesContent({ params }: RolesPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const [summary, rolesData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listRoles(session.userId, organizationId),
  ])

  if (summary.status !== 'ok' || rolesData.status !== 'ok') notFound()

  const canManage =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.rolesManage)

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← {summary.organization.acronym}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Cargos e permissões
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.organization.legalName}
        </p>
      </header>

      {canManage ? (
        <section className="rounded-lg border bg-background p-6">
          <CreateRoleForm organizationId={summary.organization.id} />
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Cargos</h2>

        {rolesData.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cargo criado ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {rolesData.roles.map(role => (
              <li key={role.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{role.name}</span>
                  {role.isDefault ? (
                    <Badge variant="secondary">Padrão</Badge>
                  ) : null}
                  {role.isDirector ? (
                    <Badge variant="outline">Diretoria</Badge>
                  ) : null}
                  {role.hasFullAccess ? <Badge>Acesso completo</Badge> : null}
                  {!role.isActive ? (
                    <Badge variant="destructive">Inativo</Badge>
                  ) : null}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {role.hasFullAccess
                    ? 'Todas as permissões configuráveis.'
                    : role.permissionCodes.length > 0
                      ? role.permissionCodes.join(', ')
                      : 'Nenhuma permissão explícita.'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default function RolesPage({ params }: RolesPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando cargos…
        </p>
      }
    >
      <RolesContent params={params} />
    </Suspense>
  )
}
