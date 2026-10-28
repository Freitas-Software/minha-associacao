'use client'

import { useForm } from '@tanstack/react-form'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { FormattedInput } from '@/components/ui/formatted-input'
import { PasswordInput } from '@/components/ui/password-input'
import { Spinner } from '@/components/ui/spinner'
import { focusFirstInvalidField } from '@/lib/focus'
import { formatCpf } from '@/lib/formatters'
import { loginSchema } from '../../schema'
import { login } from '../actions'

export function LoginForm({ next = '/app' }: { next?: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      login: '',
      password: '',
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmitInvalid: () => focusFirstInvalidField(formRef.current),
    onSubmit: async ({ value }) => {
      setMessage(null)

      try {
        const result = await login(value)

        if (result.success) {
          router.replace(next)
          return
        }

        setMessage(result.message)
      } catch {
        setMessage('Não foi possível confirmar o login. Tente novamente.')
      }
    },
  })

  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <form
          ref={formRef}
          noValidate
          aria-busy={isSubmitting}
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldSet>
            <FieldLegend className="sr-only">Entre na sua conta</FieldLegend>

            <FieldGroup>
              <form.Field
                name="login"
                validators={{ onBlur: loginSchema.shape.login }}
              >
                {field => {
                  const errors = field.state.meta.errors
                  const invalid = errors.length > 0

                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="login-cpf">CPF</FieldLabel>

                      <FormattedInput
                        id="login-cpf"
                        name={field.name}
                        format={formatCpf}
                        maxDigits={11}
                        maxLength={14}
                        autoComplete="username"
                        placeholder="000.000.000-00"
                        spellCheck={false}
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onValueChange={field.handleChange}
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? 'login-cpf-error' : undefined
                        }
                      />

                      <FieldError id="login-cpf-error" errors={errors} />
                    </Field>
                  )
                }}
              </form.Field>

              <form.Field
                name="password"
                validators={{ onBlur: loginSchema.shape.password }}
              >
                {field => {
                  const errors = field.state.meta.errors
                  const invalid = errors.length > 0

                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="login-password">Senha</FieldLabel>

                      <PasswordInput
                        id="login-password"
                        name={field.name}
                        autoComplete="current-password"
                        maxLength={128}
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          field.handleChange(event.currentTarget.value)
                        }}
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? 'login-password-error' : undefined
                        }
                      />

                      <FieldError id="login-password-error" errors={errors} />
                    </Field>
                  )
                }}
              </form.Field>
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>

            <FormMessage
              status={message ? 'error' : 'idle'}
              message={message ?? ''}
            />
          </FieldSet>
        </form>
      )}
    </form.Subscribe>
  )
}
