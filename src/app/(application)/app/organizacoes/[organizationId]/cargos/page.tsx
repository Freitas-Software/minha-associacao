import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
} from '@/modules/authorization/permissions'
import {
  getOrganizationSummary,
  listRoles,
} from '@/modules/organizations/organization.server'
import { RoleForm } from './components/role-form'

export const metadata: Metadata = {
  title: 'Cargos',
  robots: { index: false, follow: false },
}

type RolesPageProps = {
  params: Promise<{ organizationId: string }>
}

function describePermissions(codes: readonly string[]): string {
  if (codes.length === 0) return 'Nenhuma permissão explícita.'

  return codes
    .map(
      code =>
        PERMISSION_CATALOG.find(permission => permission.code === code)
          ?.description ?? code,
    )
    .join(' · ')
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

  const access = summary.access

  const canManage =
    access.hasFullAccess || access.permissions.includes(PERMISSIONS.rolesManage)

  const grantablePermissions = access.canGrantFullAccess
    ? PERMISSION_CATALOG
    : PERMISSION_CATALOG.filter(permission =>
        access.permissions.includes(permission.code),
      )

  function canManageRole(role: {
    hasFullAccess: boolean
    permissionCodes: string[]
  }): boolean {
    if (!canManage) return false
    if (access.canGrantFullAccess) return true

    return (
      !role.hasFullAccess &&
      role.permissionCodes.every(code => access.permissions.includes(code))
    )
  }

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
          <RoleForm
            organizationId={summary.organization.id}
            mode="create"
            permissions={grantablePermissions}
            canGrantFullAccess={summary.access.canGrantFullAccess}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Cargos</h2>

        {rolesData.roles.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background p-6">
            <p className="text-sm text-muted-foreground">
              Nenhum cargo criado ainda.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? 'Use o formulário acima para criar o primeiro cargo.'
                : 'Peça a alguém com acesso completo para configurar os cargos.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rolesData.roles.map(role => (
              <li key={role.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
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

                  {canManageRole(role) ? (
                    <Link
                      href={`/app/organizacoes/${summary.organization.id}/cargos/${role.id}`}
                      className="text-sm underline underline-offset-4"
                    >
                      Editar
                    </Link>
                  ) : null}
                </div>

                <p className="mt-2 text-xs break-words text-muted-foreground">
                  {role.hasFullAccess
                    ? 'Todas as permissões configuráveis atuais e futuras.'
                    : describePermissions(role.permissionCodes)}
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
