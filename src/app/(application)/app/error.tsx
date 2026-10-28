'use client'

import { ErrorPanel } from '@/components/application/error-panel'

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <ErrorPanel reset={reset} homeHref="/app" homeLabel="Voltar à aplicação" />
  )
}
