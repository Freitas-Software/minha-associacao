import type { Metadata } from 'next'
import { RequestPasswordResetForm } from './components/request-form'

export const metadata: Metadata = {
  title: 'Recuperar senha',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function RecoverPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Recuperar senha
        </h1>
        <p className="text-sm text-muted-foreground">
          Informe seu CPF. As instruções serão enviadas somente para o email já
          vinculado à sua conta.
        </p>
      </header>
      <RequestPasswordResetForm />
    </main>
  )
}
