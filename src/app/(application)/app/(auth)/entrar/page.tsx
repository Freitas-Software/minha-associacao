import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from './components/login-form'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>

        <p className="text-sm text-muted-foreground">
          Acesse sua conta com CPF e senha.
        </p>
      </header>

      <LoginForm />

      <p className="mt-6 text-sm">
        <Link
          href="/app/recuperar-senha"
          className="underline underline-offset-4"
        >
          Esqueci minha senha
        </Link>
      </p>

      <p className="mt-6 text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link
          href="/app/cadastro"
          className="text-foreground underline underline-offset-4"
        >
          Criar conta
        </Link>
      </p>
    </main>
  )
}
