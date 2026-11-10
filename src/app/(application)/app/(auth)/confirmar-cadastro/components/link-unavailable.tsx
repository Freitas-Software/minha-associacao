import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LinkUnavailable() {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Link indisponível
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Este link de cadastro expirou, já foi usado ou não é válido.
        </p>
      </header>

      <div className="flex flex-col items-start gap-3">
        <Button nativeButton={false} render={<Link href="/app/cadastro" />}>
          Solicitar um novo link
        </Button>

        <Link
          href="/app/entrar"
          className="w-fit rounded-sm py-1 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Já tem conta? Entrar
        </Link>
      </div>
    </div>
  )
}
