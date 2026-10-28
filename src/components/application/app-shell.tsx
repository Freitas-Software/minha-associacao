import Link from 'next/link'
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <a
        href="#app-conteudo"
        className="sr-only bg-background p-3 focus:not-sr-only"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b bg-background">
        <nav
          aria-label="Navegação da aplicação"
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-5"
        >
          <Link href="/app" className="font-semibold text-primary">
            Associae · App
          </Link>
          <Link href="/app/users" className="text-sm hover:underline">
            Usuários
          </Link>
          <Link
            href="/"
            className="ml-auto text-sm text-muted-foreground hover:underline"
          >
            Voltar ao site
          </Link>
        </nav>
      </header>
      <div
        id="app-conteudo"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-10 outline-none"
      >
        {children}
      </div>
    </div>
  )
}
