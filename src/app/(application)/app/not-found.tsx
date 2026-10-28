import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Página não encontrada',
}

export default function AppNotFound() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-5">
      <p className="font-semibold text-primary">404</p>
      <h1 className="text-3xl font-bold">Página não encontrada no app</h1>
      <p className="text-muted-foreground">
        O endereço solicitado não existe nesta aplicação.
      </p>
      <Button nativeButton={false} render={<Link href="/app" />}>
        Voltar à aplicação
      </Button>
    </main>
  )
}
