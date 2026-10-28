import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getCurrentSession } from '@/lib/session'
import { confirmEmailChangeSchema } from '@/modules/identity/email-change.schema'
import { ConfirmEmailChangeForm } from './components/confirm-email-change-form'

export const metadata: Metadata = {
  title: 'Confirmar novo email',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type ConfirmEmailPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

async function ConfirmEmailContent({ searchParams }: ConfirmEmailPageProps) {
  const params = await searchParams
  const parsedToken = confirmEmailChangeSchema.shape.token.safeParse(
    params.token,
  )

  if (!parsedToken.success) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          O link de confirmação está incompleto ou é inválido.
        </p>
        <Link
          href="/app/perfil"
          className="text-sm underline underline-offset-4"
        >
          Voltar ao perfil
        </Link>
      </div>
    )
  }

  const session = await getCurrentSession()
  const nextPath = `/app/perfil/confirmar-email?token=${parsedToken.data}`

  if (!session) {
    redirect(`/app/entrar?next=${encodeURIComponent(nextPath)}`)
  }

  return <ConfirmEmailChangeForm token={parsedToken.data} />
}

export default function ConfirmEmailPage({
  searchParams,
}: ConfirmEmailPageProps) {
  return (
    <main className="mx-auto w-full max-w-lg">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Confirmar novo email
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Confirme a alteração do email da sua conta. O endereço atual continua
          ativo até esta confirmação.
        </p>
      </header>

      <Suspense
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Carregando confirmação…
          </p>
        }
      >
        <ConfirmEmailContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
