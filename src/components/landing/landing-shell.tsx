import type { ReactNode } from 'react'
import { LandingHeader } from './header'
import { SiteFooter } from './site-footer'

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>
      <LandingHeader />
      <div
        id="conteudo"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        {children}
      </div>
      <SiteFooter />
    </div>
  )
}
