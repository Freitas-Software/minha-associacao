import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/application/app-shell'

export const metadata: Metadata = {
  title: {
    default: 'Aplicação | Minha Associação',
    template: '%s | Minha Associação',
  },
  robots: { index: false, follow: false },
}

export default function AppLayout({ children }: { children: ReactNode }) {
  // Integrar a sessão real antes de disponibilizar esta área como autenticada.
  // As verificações de autorização também devem existir nas ações e no acesso aos dados.
  return <AppShell>{children}</AppShell>
}
