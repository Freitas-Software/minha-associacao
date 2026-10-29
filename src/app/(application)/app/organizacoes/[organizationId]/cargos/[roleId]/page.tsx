import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
} from '@/modules/authorization/permissions'
import {
  getOrganizationSummary,
  listRoles,
} from '@/modules/organizations/organization.server'
import { RoleForm } from '../components/role-form'

export const metadata: Metadata = {
  title: 'Editar cargo',
  robots: { index: false, follow: false },
}

type EditRolePageProps = {
  params: Promise<{ organizationId: string; roleId: string }>
}

async function EditRoleContent({ params }: EditRolePageProps) {
  await io()

  const { organizationId, roleId } = await params
  const session = await requireSession()
  const [summary, rolesData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listRoles(session.userId, organizationId),
  ])

  if (summary.status !== 'ok' || rolesData.status !== 'ok') notFound()

  const canManage =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.rolesManage)

  const role = rolesData.roles.find(item => item.id === roleId)

  if (!canManage || !role) notFound()

  const canManageRole =
    summary.access.canGrantFullAccess ||
    (!role.hasFullAccess &&
      role.permissionCodes.every(code =>
        summary.access.permissions.includes(code),
      ))

  if (!canManageRole) notFound()

  const grantablePermissions = summary.access.canGrantFullAccess
    ? PERMISSION_CATALOG
    : PERMISSION_CATALOG.filter(permission =>
        summary.access.permissions.includes(permission.code),
      )

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}/cargos`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Cargos
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Editar cargo</h1>
        <p className="text-sm text-muted-foreground">
          {role.name} · {summary.organization.legalName}
        </p>
      </header>

      <section className="rounded-lg border bg-background p-6">
        <RoleForm
          organizationId={summary.organization.id}
          mode="edit"
          role={role}
          permissions={grantablePermissions}
          canGrantFullAccess={summary.access.canGrantFullAccess}
        />
      </section>
    </main>
  )
}

export default function EditRolePage({ params }: EditRolePageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando cargo…
        </p>
      }
    >
      <EditRoleContent params={params} />
    </Suspense>
  )
}
