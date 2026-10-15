import type { ReactNode } from 'react'
import { LandingShell } from '@/components/landing/landing-shell'

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <LandingShell>{children}</LandingShell>
}
