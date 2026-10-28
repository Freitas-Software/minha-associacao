'use client'

import { TriangleAlertIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function ConnectivityNotice() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)

    sync()

    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)

    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertDescription>
          Você está sem conexão. Algumas ações podem falhar até que a internet
          volte.
        </AlertDescription>
      </Alert>
    </div>
  )
}
