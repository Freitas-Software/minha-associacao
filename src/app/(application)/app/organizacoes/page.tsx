import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { isPlatformAdmin } from '@/modules/authorization/authorize.server'
import { listUserOrganizations } from '@/modules/organizations/organization.server'

export const metadata: Metadata = {
  title: 'Organizações',
}

async function OrganizationsContent() {
  await io()

  const session = await requireSession()
  const [organizations, isAdmin] = await Promise.all([
    listUserOrganizations(session.userId),
    isPlatformAdmin(session.userId),
  ])

  return (
    <main className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Minhas organizações
        </h1>
        <p className="text-sm text-muted-foreground">
          Organizações em que você possui vínculo ativo ou concessão temporária
          de configuração.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/app/organizacoes/nova"
            className="underline underline-offset-4"
          >
            Solicitar nova organização
          </Link>
          <Link
            href="/app/organizacoes/solicitacoes"
            className="underline underline-offset-4"
          >
            Minhas solicitações
          </Link>
          {isAdmin ? (
            <Link
              href="/app/admin/solicitacoes"
              className="underline underline-offset-4"
            >
              Solicitações pendentes
            </Link>
          ) : null}
        </div>
      </header>

      {organizations.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-6">
          <p className="text-sm text-muted-foreground">
            Você ainda não participa de nenhuma organização e não possui
            concessão de configuração.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se você recebeu um convite, abra o link enviado pela organização.
          </p>
          <Link
            href="/app/organizacoes/nova"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            Solicitar criação de organização
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {organizations.map(organization => (
            <li
              key={organization.id}
              className="rounded-lg border bg-background p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{organization.legalName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {organization.acronym} · {organization.roleName}
                  </p>
                </div>
                <Badge
                  variant={
                    organization.status === 'active' ? 'default' : 'secondary'
                  }
                >
                  {organization.status === 'active'
                    ? 'Ativa'
                    : organization.status === 'closed'
                      ? 'Encerrada'
                      : 'Em configuração'}
                </Badge>
              </div>

              <Link
                href={`/app/organizacoes/${organization.id}`}
                className="mt-5 inline-block text-sm underline underline-offset-4"
              >
                Abrir organização
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default function OrganizationsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando organizações…
        </p>
      }
    >
      <OrganizationsContent />
    </Suspense>
  )
}
