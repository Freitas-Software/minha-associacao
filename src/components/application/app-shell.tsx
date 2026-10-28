import Link from 'next/link'
import { type ReactNode, Suspense } from 'react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { AppNav, AppNavFallback } from './app-nav'
import { ConnectivityNotice } from './connectivity-notice'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <a
        href="#app-conteudo"
        className="sr-only rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6">
          <Link
            href="/app"
            className="rounded-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Associae · App
          </Link>
          <nav
            aria-label="Navegação da aplicação"
            className="order-3 w-full sm:order-none sm:w-auto"
          >
            <Suspense fallback={<AppNavFallback />}>
              <AppNav />
            </Suspense>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-block rounded-sm px-1 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              Voltar ao site
            </Link>
          </div>
        </div>
      </header>
      <ConnectivityNotice />
      <div
        id="app-conteudo"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 outline-none sm:px-6 sm:py-10"
      >
        {children}
      </div>
    </div>
  )
}
