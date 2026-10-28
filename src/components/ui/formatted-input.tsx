'use client'

import { useEffect, useRef } from 'react'
import { caretPositionForDigits } from '@/lib/formatters'
import { Input } from './input'

type FormattedInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> & {
  value: string
  onValueChange: (value: string) => void
  format: (digits: string) => string
  maxDigits: number
}

export function FormattedInput({
  value,
  onValueChange,
  format,
  maxDigits,
  inputMode = 'numeric',
  ...props
}: FormattedInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    const input = inputRef.current
    const nextValue = value

    if (!input || pendingCaret.current === null) return

    const position = caretPositionForDigits(nextValue, pendingCaret.current)

    input.setSelectionRange(position, position)
    pendingCaret.current = null
  }, [value])

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={event => {
        const input = event.currentTarget
        const rawValue = input.value
        const caret = input.selectionStart ?? rawValue.length
        const digitsBeforeCaret = rawValue
          .slice(0, caret)
          .replaceAll(/\D/g, '').length
        const digits = rawValue.replaceAll(/\D/g, '').slice(0, maxDigits)
        const formatted = format(digits)

        pendingCaret.current = digitsBeforeCaret

        if (formatted === value) {
          input.value = formatted

          const position = caretPositionForDigits(formatted, digitsBeforeCaret)

          input.setSelectionRange(position, position)
          pendingCaret.current = null
          return
        }

        onValueChange(formatted)
      }}
    />
  )
}
