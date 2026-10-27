'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { renewSession } from '../session-actions'

const RENEW_INTERVAL_MS = 60 * 1000

export function SessionActivity() {
  const router = useRouter()
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let disposed = false
    let expired = false
    let inFlight = false
    let lastAttemptAt = 0

    async function handleActivity(event: Event) {
      if (
        disposed ||
        expired ||
        inFlight ||
        !event.isTrusted ||
        document.visibilityState !== 'visible' ||
        !document.hasFocus()
      ) {
        return
      }

      const now = Date.now()

      if (now - lastAttemptAt < RENEW_INTERVAL_MS) {
        return
      }

      lastAttemptAt = now
      inFlight = true

      try {
        const result = await renewSession()

        if (disposed) return

        if (result.status === 'expired') {
          expired = true
          router.replace('/app/entrar')
          return
        }

        setUnavailable(result.status === 'unavailable')
      } catch {
        if (!disposed) {
          setUnavailable(true)
        }
      } finally {
        inFlight = false
      }
    }

    function onActivity(event: Event) {
      void handleActivity(event)
    }

    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('wheel', onActivity, {
      passive: true,
    })

    return () => {
      disposed = true

      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('wheel', onActivity)
    }
  }, [router])

  if (!unavailable) return null

  return (
    <Alert role="status">
      <AlertDescription>
        Não foi possível verificar sua sessão. Uma nova tentativa será feita
        quando você continuar usando a página.
      </AlertDescription>
    </Alert>
  )
}
