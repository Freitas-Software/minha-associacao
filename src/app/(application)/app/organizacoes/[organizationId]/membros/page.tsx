import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import {
  type AssignableRole,
  getOrganizationSummary,
  listAssignableRoles,
  listOrganizationMemberships,
  listPendingPreRegistrations,
  type PendingPreRegistration,
} from '@/modules/organizations/organization.server'
import { ChangeMemberRoleForm } from './components/change-member-role-form'
import { DeactivateMemberForm } from './components/deactivate-member-form'
import { ResendPreRegistrationForm } from './components/resend-pre-registration-form'

export const metadata: Metadata = {
  title: 'Membros',
  robots: { index: false, follow: false },
}

type MembersPageProps = {
  params: Promise<{ organizationId: string }>
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function maskDocument(documentNumber: string): string {
  return `***.***.***-${documentNumber.slice(-2)}`
}

async function MembersContent({ params }: MembersPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const [summary, membersData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listOrganizationMemberships(session.userId, organizationId),
  ])

  if (summary.status !== 'ok' || membersData.status !== 'ok') notFound()

  const canManage =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.membersManage)

  let assignableRoles: AssignableRole[] = []
  let pendingPreRegistrations: PendingPreRegistration[] = []

  if (canManage) {
    const [rolesData, pendingData] = await Promise.all([
      listAssignableRoles(session.userId, organizationId),
      listPendingPreRegistrations(session.userId, organizationId),
    ])

    if (rolesData.status === 'ok') assignableRoles = rolesData.roles
    if (pendingData.status === 'ok') {
      pendingPreRegistrations = pendingData.requests
    }
  }

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← {summary.organization.acronym}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Membros da organização
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.organization.legalName}
        </p>
        {canManage ? (
          <Link
            href={`/app/organizacoes/${summary.organization.id}/membros/pre-cadastrar`}
            className="inline-block text-sm underline underline-offset-4"
          >
            Pré-cadastrar pessoa
          </Link>
        ) : null}
      </header>

      {pendingPreRegistrations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Pré-cadastros pendentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Pessoas que ainda não concluíram a conta. O pré-cadastro permanece
            aqui até a ativação ou a expiração do link.
          </p>
          <ul className="space-y-3">
            {pendingPreRegistrations.map(request => {
              const expired = request.expiresAt.getTime() <= Date.now()

              return (
                <li
                  key={request.id}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{request.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.email} · {request.roleName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado em {formatDateTime(request.createdAt)} ·{' '}
                        {expired ? 'Expirou em' : 'Expira em'}{' '}
                        {formatDateTime(request.expiresAt)}
                      </p>
                    </div>
                    <Badge variant={expired ? 'destructive' : 'secondary'}>
                      {expired ? 'Expirado' : 'Aguardando ativação'}
                    </Badge>
                  </div>

                  <ResendPreRegistrationForm
                    organizationId={summary.organization.id}
                    registrationRequestId={request.id}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {membersData.memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum vínculo encontrado.
        </p>
      ) : (
        <ul className="space-y-4">
          {membersData.memberships.map(member => (
            <li
              key={member.membershipId}
              className="space-y-4 rounded-lg border bg-background p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{member.name}</h2>
                    <Badge
                      variant={
                        member.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {member.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {member.email} · CPF {maskDocument(member.documentNumber)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Cargo: {member.roleName} · Desde{' '}
                    {formatDate(member.joinedAt)}
                  </p>
                  {member.status === 'inactive' && member.deactivatedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Desativado em {formatDate(member.deactivatedAt)}
                      {member.deactivationReason
                        ? ` · Motivo: ${member.deactivationReason}`
                        : ''}
                    </p>
                  ) : null}
                </div>

                {member.status === 'inactive' ? (
                  <Link
                    href={`/app/organizacoes/${summary.organization.id}/convites`}
                    className="text-sm underline underline-offset-4"
                  >
                    Reativar por convite
                  </Link>
                ) : null}
              </div>

              {member.status === 'active' &&
              canManage &&
              assignableRoles.length > 1 &&
              assignableRoles.some(role => role.id === member.roleId) ? (
                <ChangeMemberRoleForm
                  organizationId={summary.organization.id}
                  membershipId={member.membershipId}
                  memberName={member.name}
                  currentRoleId={member.roleId}
                  roles={assignableRoles}
                />
              ) : null}

              {member.status === 'active' && canManage ? (
                <DeactivateMemberForm
                  organizationId={summary.organization.id}
                  membershipId={member.membershipId}
                  memberName={member.name}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default function MembersPage({ params }: MembersPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando membros…
        </p>
      }
    >
      <MembersContent params={params} />
    </Suspense>
  )
}
