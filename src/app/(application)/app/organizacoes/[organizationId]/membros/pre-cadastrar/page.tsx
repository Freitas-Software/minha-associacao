import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import {
  getOrganizationSummary,
  listRoles,
} from '@/modules/organizations/organization.server'
import { PreRegistrationForm } from './components/pre-registration-form'

export const metadata: Metadata = {
  title: 'Pré-cadastrar pessoa',
  robots: { index: false, follow: false },
}

type PreRegistrationPageProps = {
  params: Promise<{ organizationId: string }>
}

async function PreRegistrationContent({ params }: PreRegistrationPageProps) {
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
    summary.access.permissions.includes(PERMISSIONS.membersManage)

  if (!canManage) notFound()

  const roles = rolesData.roles.filter(
    role =>
      role.isActive &&
      (summary.access.hasFullAccess ||
        (!role.hasFullAccess &&
          role.permissionCodes.every(code =>
            summary.access.permissions.includes(code),
          ))),
  )

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}/membros`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Membros
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Pré-cadastrar pessoa
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.organization.legalName}
        </p>
      </header>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Não há cargo ativo disponível para atribuir. Configure um cargo antes
          de pré-cadastrar.
        </p>
      ) : (
        <section className="rounded-lg border bg-background p-6">
          <PreRegistrationForm
            organizationId={summary.organization.id}
            roles={roles}
          />
        </section>
      )}
    </main>
  )
}

export default function PreRegistrationPage({
  params,
}: PreRegistrationPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando pré-cadastro…
        </p>
      }
    >
      <PreRegistrationContent params={params} />
    </Suspense>
  )
}
