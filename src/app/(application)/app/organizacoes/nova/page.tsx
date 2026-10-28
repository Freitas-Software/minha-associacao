import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { RequestOrganizationForm } from './components/request-organization-form'

export const metadata: Metadata = {
  title: 'Solicitar organização',
  robots: { index: false, follow: false },
}

async function NewOrganizationContent() {
  await io()
  await requireSession()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8">
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
          Informe o CNPJ e anexe a ata de eleição. O administrador da plataforma
          valida a ata antes de criar a organização e o seu vínculo como
          presidente.
        </p>
      </header>

      <section className="rounded-lg border bg-background p-6">
        <RequestOrganizationForm />
      </section>
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
