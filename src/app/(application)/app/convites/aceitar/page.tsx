import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { getCurrentSession } from '@/lib/session'
import { validateInviteToken } from '@/modules/invites/invite.server'
import { AcceptInviteForm } from './components/accept-invite-form'

export const metadata: Metadata = {
  title: 'Aceitar convite',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type AcceptPageProps = {
  searchParams: Promise<{ token?: string | string[] }>
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

async function AcceptContent({ searchParams }: AcceptPageProps) {
  await io()

  const params = await searchParams
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  const session = await getCurrentSession()

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return (
      <main className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">
          Convite inválido
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Este link está incompleto ou não é um convite válido.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          Ir para a aplicação
        </Link>
      </main>
    )
  }

  const invite = await validateInviteToken(token)

  if (!invite) {
    return (
      <main className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">
          Convite indisponível
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Este convite expirou, foi revogado ou já esgotou os usos.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          Ir para a aplicação
        </Link>
      </main>
    )
  }

  const next = `/app/convites/aceitar?token=${token}`
  const loginHref = `/app/entrar?next=${encodeURIComponent(next)}`

  return (
    <main className="mx-auto w-full max-w-lg">
      <header className="mb-8 space-y-3">
        <p className="text-sm text-muted-foreground">Convite para</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {invite.organization.legalName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {invite.organization.acronym} ·{' '}
          {invite.role?.name ?? 'Cargo padrão de ingresso'}
        </p>
      </header>

      <div className="space-y-3 rounded-lg border bg-background p-5 text-sm">
        <p>
          <span className="text-muted-foreground">Tipo:</span>{' '}
          {invite.type === 'individual'
            ? 'Individual, vinculado ao CPF'
            : 'Compartilhado'}
        </p>
        <p>
          <span className="text-muted-foreground">Válido até:</span>{' '}
          {formatDate(invite.expiresAt)}
        </p>
        {invite.type === 'shared' ? (
          <p>
            <span className="text-muted-foreground">Usos:</span>{' '}
            {invite.maxUses === null
              ? `${invite.usesCount} usos`
              : `${invite.usesCount} de ${invite.maxUses}`}
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        {session ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está conectado como {session.name}.
            </p>
            <AcceptInviteForm token={token} />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para aceitar o convite. Se você ainda não tem
              conta, crie uma e depois abra este link novamente.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={loginHref}
                className="inline-block text-sm underline underline-offset-4"
              >
                Entrar para aceitar
              </Link>
              <Link
                href="/app/cadastro"
                className="inline-block text-sm underline underline-offset-4"
              >
                Criar conta
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function AcceptInvitePage({ searchParams }: AcceptPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando convite…
        </p>
      }
    >
      <AcceptContent searchParams={searchParams} />
    </Suspense>
  )
}
