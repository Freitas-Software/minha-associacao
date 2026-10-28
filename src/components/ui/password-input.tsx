'use client'

import { cn } from 'cn'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from './button'
import { Input } from './input'

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  id: string
}

export function PasswordInput({ id, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-0.5 -translate-y-1/2"
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        onClick={() => setVisible(current => !current)}
      >
        {visible ? (
          <EyeOffIcon aria-hidden="true" />
        ) : (
          <EyeIcon aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}
