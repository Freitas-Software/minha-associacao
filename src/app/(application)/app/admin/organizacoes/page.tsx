import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCnpj } from '@/lib/formatters'
import { requireSession } from '@/lib/session'
import { isPlatformAdmin } from '@/modules/authorization/authorize.server'
import { listAdminOrganizations } from '@/modules/organizations/organization.server'
import { CreateOrganizationForm } from './components/create-organization-form'

export const metadata: Metadata = {
  title: 'Organizações da plataforma',
  robots: { index: false, follow: false },
}

type AdminOrganizationsPageProps = {
  searchParams: Promise<{
    status?: string | string[]
    page?: string | string[]
  }>
}

type OrganizationStatusFilter = 'provisioning' | 'active' | undefined

const pageSize = 20

const statusTabs: Array<{
  value: OrganizationStatusFilter
  label: string
}> = [
  { value: undefined, label: 'Todas' },
  { value: 'provisioning', label: 'Em configuração' },
  { value: 'active', label: 'Ativas' },
]

function resolveStatus(
  value: string | string[] | undefined,
): OrganizationStatusFilter {
  if (value === 'provisioning' || value === 'active') return value
  return undefined
}

function resolvePage(value: string | string[] | undefined): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function pageHref(status: OrganizationStatusFilter, page: number): string {
  const params = new URLSearchParams()

  if (status) params.set('status', status)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()

  return `/app/admin/organizacoes${query ? `?${query}` : ''}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

async function AdminOrganizationsContent({
  searchParams,
}: AdminOrganizationsPageProps) {
  await io()

  const params = await searchParams
  const status = resolveStatus(params.status)
  const page = resolvePage(params.page)
  const session = await requireSession()

  if (!(await isPlatformAdmin(session.userId))) notFound()

  const data = await listAdminOrganizations(session.userId, {
    status,
    limit: pageSize + 1,
    offset: (page - 1) * pageSize,
  })

  if (data.status !== 'ok') notFound()

  const hasNext = data.organizations.length > pageSize
  const organizations = hasNext
    ? data.organizations.slice(0, pageSize)
    : data.organizations

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/app/admin/solicitacoes"
            className="text-muted-foreground underline underline-offset-4"
          >
            ← Solicitações
          </Link>
          <Link
            href="/app/organizacoes"
            className="text-muted-foreground underline underline-offset-4"
          >
            Aplicação
          </Link>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Organizações da plataforma
        </h1>
        <p className="text-sm text-muted-foreground">
          Crie organizações com dados básicos e acompanhe as organizações
          criadas na plataforma.
        </p>
      </header>

      <section className="rounded-lg border bg-background p-6">
        <CreateOrganizationForm />
      </section>

      <nav aria-label="Filtrar organizações" className="flex flex-wrap gap-2">
        {statusTabs.map(tab => {
          const active = tab.value === status

          return (
            <Link
              key={tab.label}
              href={pageHref(tab.value, 1)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                  : 'rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {organizations.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-6">
          <p className="text-sm text-muted-foreground">
            Nenhuma organização encontrada.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {organizations.map(organization => (
            <li
              key={organization.id}
              className="space-y-3 rounded-lg border bg-background p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{organization.legalName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {organization.acronym} · CNPJ{' '}
                    {formatCnpj(organization.cnpj)}
                  </p>
                </div>
                <Badge
                  variant={
                    organization.status === 'active' ? 'default' : 'secondary'
                  }
                >
                  {organization.status === 'active'
                    ? 'Ativa'
                    : 'Em configuração'}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                Criada em{' '}
                <time dateTime={organization.createdAt.toISOString()}>
                  {formatDate(organization.createdAt)}
                </time>
                {organization.activatedAt ? (
                  <>
                    {' '}
                    · Ativada em{' '}
                    <time dateTime={organization.activatedAt.toISOString()}>
                      {formatDate(organization.activatedAt)}
                    </time>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <nav
          aria-label="Paginação das organizações"
          className="flex flex-wrap items-center gap-3"
        >
          {page > 1 ? (
            <Link
              href={pageHref(status, page - 1)}
              className="text-sm underline underline-offset-4"
            >
              ← Anterior
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={pageHref(status, page + 1)}
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

export default function AdminOrganizationsPage({
  searchParams,
}: AdminOrganizationsPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando organizações…
        </p>
      }
    >
      <AdminOrganizationsContent searchParams={searchParams} />
    </Suspense>
  )
}
