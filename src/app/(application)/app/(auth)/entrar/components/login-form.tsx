'use client'

import { useForm } from '@tanstack/react-form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { loginSchema } from '../../schema'
import { login } from '../actions'

export function LoginForm() {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      login: '',
      password: '',
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)

      try {
        const result = await login(value)

        if (result.success) {
          router.replace('/app')
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
          noValidate
          aria-busy={isSubmitting}
          onSubmit={event => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
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

                      <Input
                        id="login-cpf"
                        name={field.name}
                        type="text"
                        autoComplete="username"
                        placeholder="000.000.000-00"
                        maxLength={14}
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          field.handleChange(event.currentTarget.value)
                        }}
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

                      <Input
                        id="login-password"
                        name={field.name}
                        type="password"
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

            {message ? (
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
          </FieldSet>
        </form>
      )}
    </form.Subscribe>
  )
}
