import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/session'
import { EndOtherSessionsButton } from './components/end-other-sessions-button'
import { LogoutButton } from './components/logout-button'
import { SessionActivity } from './components/session-activity'

export const metadata: Metadata = {
  title: 'Início',
}

async function AccountHome() {
  await io()
  const session = await requireSession()

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        Olá, {session.name}
      </h1>

      <p className="text-sm text-muted-foreground">Bem-vindo à Associae.</p>

      <div className="flex flex-wrap items-center gap-3">
        <Button nativeButton={false} render={<Link href="/app/organizacoes" />}>
          Minhas organizações
        </Button>
        <LogoutButton />
        <EndOtherSessionsButton />
      </div>

      <SessionActivity />
    </section>
  )
}

export default function AppPage() {
  return (
    <main className="mx-auto w-full max-w-4xl">
      <Suspense
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Carregando sua conta…
          </p>
        }
      >
        <AccountHome />
      </Suspense>
    </main>
  )
}
