'use client'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { usePathname } from 'next/navigation'
import { publicTelemetryEvent } from '@/lib/telemetry-policy'

export function SiteTelemetry() {
  const pathname = usePathname()
  if (pathname === '/app' || pathname.startsWith('/app/')) return null
  return (
    <>
      <SpeedInsights beforeSend={publicTelemetryEvent} />
      <Analytics beforeSend={publicTelemetryEvent} />
    </>
  )
}
