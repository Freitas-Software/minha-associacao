import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  searchParams: Promise<{
    q?: string | string[]
    page?: string | string[]
  }>
}

const pageSize = 30

function resolveQuery(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, 100) : ''
}

function resolvePage(value: string | string[] | undefined): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function pageHref(organizationId: string, query: string, page: number): string {
  const params = new URLSearchParams()

  if (query) params.set('q', query)
  if (page > 1) params.set('page', String(page))

  const search = params.toString()

  return `/app/organizacoes/${organizationId}/membros${search ? `?${search}` : ''}`
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

async function MembersContent({ params, searchParams }: MembersPageProps) {
  await io()

  const { organizationId } = await params
  const search = await searchParams
  const query = resolveQuery(search.q)
  const page = resolvePage(search.page)
  const session = await requireSession()
  const [summary, membersData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listOrganizationMemberships(session.userId, organizationId, {
      query: query || undefined,
      limit: pageSize + 1,
      offset: (page - 1) * pageSize,
    }),
  ])

  if (summary.status !== 'ok' || membersData.status !== 'ok') notFound()

  const hasNext = membersData.memberships.length > pageSize
  const members = hasNext
    ? membersData.memberships.slice(0, pageSize)
    : membersData.memberships

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

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="member-search" className="block text-sm font-medium">
            Buscar membro
          </label>
          <Input
            id="member-search"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={100}
            placeholder="Nome, email ou CPF"
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

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

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query
            ? 'Nenhum membro encontrado para esta busca.'
            : 'Nenhum vínculo encontrado.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {members.map(member => (
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

      {page > 1 || hasNext ? (
        <nav
          aria-label="Paginação de membros"
          className="flex flex-wrap items-center gap-3"
        >
          {page > 1 ? (
            <Link
              href={pageHref(summary.organization.id, query, page - 1)}
              className="text-sm underline underline-offset-4"
            >
              ← Anterior
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={pageHref(summary.organization.id, query, page + 1)}
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

export default function MembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando membros…
        </p>
      }
    >
      <MembersContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
