'use client'

import { cn } from 'cn'
import { CircleCheckIcon, OctagonXIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Alert, AlertDescription } from './alert'

export type FormMessageStatus = 'idle' | 'success' | 'error'

type FormMessageProps = {
  status: FormMessageStatus
  message: string
  className?: string
}

export function FormMessage({ status, message, className }: FormMessageProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'idle' || !message) return

    ref.current?.focus()
  }, [message, status])

  if (status === 'idle' || !message) return null

  const isError = status === 'error'

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      role={isError ? 'alert' : 'status'}
      variant={isError ? 'destructive' : 'default'}
      className={cn(
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      {isError ? (
        <OctagonXIcon aria-hidden="true" />
      ) : (
        <CircleCheckIcon aria-hidden="true" />
      )}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
