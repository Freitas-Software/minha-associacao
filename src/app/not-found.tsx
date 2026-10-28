import type { Metadata } from 'next'
import { LandingShell } from '@/app/(landing)/components/landing-shell'
import { NotFoundContent } from '@/components/landing/not-found-content'

export const metadata: Metadata = {
  title: 'Página não encontrada',
}

export default function NotFound() {
  return (
    <LandingShell>
      <NotFoundContent />
    </LandingShell>
  )
}
