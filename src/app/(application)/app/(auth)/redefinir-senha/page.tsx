import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { resetPasswordSchema } from '../schema'
import { ResetPasswordForm } from './components/reset-form'

export const metadata: Metadata = {
  title: 'Redefinir senha',
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
}

type ResetPasswordPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

async function ResetPasswordContent({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  const parsedToken = resetPasswordSchema.shape.token.safeParse(params.token)

  if (!parsedToken.success) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          O link de recuperação está incompleto ou é inválido.
        </p>

        <Link
          href="/app/recuperar-senha"
          className="text-sm underline underline-offset-4"
        >
          Solicitar um novo link
        </Link>
      </div>
    )
  }

  return <ResetPasswordForm key={parsedToken.data} token={parsedToken.data} />
}

export default function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Redefina sua senha
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Escolha uma nova senha. Após a alteração, será necessário entrar
          novamente em todos os dispositivos.
        </p>
      </header>

      <Suspense
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Carregando recuperação…
          </p>
        }
      >
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
