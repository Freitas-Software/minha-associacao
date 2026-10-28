import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { completeRegistrationSchema } from '@/modules/identity/registration.schema'
import { getRegistrationContactContext } from '@/modules/identity/registration-contact.server'
import { ConfirmationForm } from './components/confirmation-form'

export const metadata: Metadata = {
  title: 'Confirmar cadastro',
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
}

type ConfirmationPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

async function ConfirmationContent({ searchParams }: ConfirmationPageProps) {
  const params = await searchParams
  const parsedToken = completeRegistrationSchema.shape.token.safeParse(
    params.token,
  )

  if (!parsedToken.success) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          O link de confirmação está incompleto ou é inválido.
        </p>

        <Link
          href="/app/cadastro"
          className="text-sm underline underline-offset-4"
        >
          Solicitar um novo link
        </Link>
      </div>
    )
  }

  const contactContext = await getRegistrationContactContext(parsedToken.data)

  return (
    <ConfirmationForm
      key={parsedToken.data}
      token={parsedToken.data}
      contactContext={contactContext}
    />
  )
}

export default function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  return (
    <main className="mx-auto w-full max-w-lg">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Confirme seu cadastro
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Defina sua senha para confirmar seu email e concluir a criação da
          conta.
        </p>
      </header>

      <Suspense
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Carregando confirmação…
          </p>
        }
      >
        <ConfirmationContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
