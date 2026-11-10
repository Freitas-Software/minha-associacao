import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { listUserOrganizationRequests } from '@/modules/organizations/organization-request.server'
import {
  ORGANIZATION_REQUEST_MAX_PENDING,
  ORGANIZATION_REQUEST_MAX_PER_WINDOW,
  ORGANIZATION_REQUEST_WINDOW_MS,
} from '@/modules/organizations/organization-request-limits'
import { RequestGuidelinesCard } from './components/request-guidelines-card'
import { RequestLimitsCard } from './components/request-limits-card'
import { RequestOrganizationForm } from './components/request-organization-form'

export const metadata: Metadata = {
  title: 'Solicitar organização',
  robots: { index: false, follow: false },
}

async function NewOrganizationContent() {
  await io()

  const session = await requireSession()
  const requests = await listUserOrganizationRequests(session.userId)
  const windowStart = Date.now() - ORGANIZATION_REQUEST_WINDOW_MS
  const pendingCount = requests.filter(
    request => request.status === 'pending',
  ).length
  const recentCount = requests.filter(
    request => request.createdAt.getTime() > windowStart,
  ).length
  const limitReached =
    pendingCount >= ORGANIZATION_REQUEST_MAX_PENDING ||
    recentCount >= ORGANIZATION_REQUEST_MAX_PER_WINDOW

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10">
      <header className="space-y-2">
        <Link
          href="/app/organizacoes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Minhas organizações
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Solicitar criação de organização
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie o CNPJ e a ata de eleição. A administração da plataforma analisa
          a ata antes de criar a organização e o seu vínculo como presidente.
        </p>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Solicitante autenticado
          </p>
          <p className="font-medium break-words text-foreground">
            {session.name}
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <RequestOrganizationForm />
        </div>

        <aside className="min-w-0 space-y-6">
          <RequestLimitsCard
            pendingCount={pendingCount}
            recentCount={recentCount}
            limitReached={limitReached}
          />
          <RequestGuidelinesCard />
        </aside>
      </div>
    </main>
  )
}

export default function NewOrganizationPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando formulário…
        </p>
      }
    >
      <NewOrganizationContent />
    </Suspense>
  )
}
