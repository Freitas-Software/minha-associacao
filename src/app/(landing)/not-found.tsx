import type { Metadata } from 'next'
import { NotFoundContent } from '@/components/landing/not-found-content'

export const metadata: Metadata = {
  title: 'Página não encontrada',
}

export default function LandingNotFound() {
  return <NotFoundContent />
}
