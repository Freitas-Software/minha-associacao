import type { Metadata } from 'next'
import Link from 'next/link'
import { RegistrationForm } from './components/registration-form'

export const metadata: Metadata = {
  title: 'Criar conta',
}

export default function RegistrationPage() {
  return (
    <main className="mx-auto w-full max-w-lg">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Informe seus dados para receber um link de confirmação. Você definirá
          sua senha pelo link enviado por email.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Se uma associação já cadastrou seu CPF, enviaremos o link ao email
          registrado nesse cadastro.
        </p>
      </header>

      <RegistrationForm />

      <p className="mt-6 text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link
          href="/app/entrar"
          className="text-foreground underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </main>
  )
}
