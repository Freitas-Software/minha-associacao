'use client'

import type { ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './button'
import { Spinner } from './spinner'

type ConfirmSubmitButtonProps = {
  label: ReactNode
  confirmLabel: ReactNode
  description: string
  pending: boolean
  pendingLabel?: string
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'default' | 'sm'
  disabled?: boolean
}

export function ConfirmSubmitButton({
  label,
  confirmLabel,
  description,
  pending,
  pendingLabel,
  variant = 'default',
  size = 'default',
  disabled = false,
}: ConfirmSubmitButtonProps) {
  const id = useId()
  const [confirming, setConfirming] = useState(false)
  const hasOpened = useRef(false)

  const triggerId = `${id}-trigger`
  const confirmId = `${id}-confirm`
  const descriptionId = `${id}-description`

  useEffect(() => {
    if (confirming) {
      hasOpened.current = true
      document.getElementById(confirmId)?.focus()
      return
    }

    if (hasOpened.current) {
      document.getElementById(triggerId)?.focus()
    }
  }, [confirmId, confirming, triggerId])

  if (!confirming) {
    return (
      <Button
        id={triggerId}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    )
  }

  return (
    <fieldset
      aria-label="Confirmação da ação"
      aria-describedby={descriptionId}
      className="min-w-0 space-y-3"
    >
      <p id={descriptionId} className="text-sm text-muted-foreground">
        {description}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          id={confirmId}
          type="submit"
          variant={variant}
          size={size}
          disabled={disabled || pending}
        >
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              {pendingLabel ?? confirmLabel}
            </>
          ) : (
            confirmLabel
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size={size}
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
    </fieldset>
  )
}
