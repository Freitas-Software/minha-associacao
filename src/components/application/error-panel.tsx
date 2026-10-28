'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

type ErrorPanelProps = {
  reset: () => void
  homeHref?: string
  homeLabel?: string
}

export function ErrorPanel({
  reset,
  homeHref = '/',
  homeLabel = 'Ir para o início',
}: ErrorPanelProps) {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-5 py-8">
      <p className="font-semibold text-primary">Erro</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Não foi possível carregar esta página
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Ocorreu um erro inesperado. Tente novamente. Se o problema continuar,
        atualize a página ou volte para o início.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>
          Tentar novamente
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={homeHref} />}
        >
          {homeLabel}
        </Button>
      </div>
    </main>
  )
}
