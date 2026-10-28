import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { listUserOrganizations } from '@/modules/organizations/organization.server'

export const metadata: Metadata = {
  title: 'Organizações',
}

async function OrganizationsContent() {
  await io()

  const session = await requireSession()
  const organizations = await listUserOrganizations(session.userId)

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Minhas organizações
        </h1>
        <p className="text-sm text-muted-foreground">
          Organizações em que você possui um vínculo ativo.
        </p>
      </header>

      {organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não participa de nenhuma organização.
        </p>
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
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  {organization.status === 'active'
                    ? 'Ativa'
                    : 'Em configuração'}
                </span>
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
