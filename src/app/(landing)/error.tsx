'use client'

import { ErrorPanel } from '@/components/application/error-panel'

export default function LandingError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
      <ErrorPanel reset={reset} homeHref="/" homeLabel="Voltar ao início" />
    </div>
  )
}
