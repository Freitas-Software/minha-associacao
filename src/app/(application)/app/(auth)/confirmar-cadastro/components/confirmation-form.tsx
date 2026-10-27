'use client'

import { useForm } from '@tanstack/react-form'
import Link from 'next/link'
import { useState } from 'react'
import z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  completeRegistrationSchema,
  passwordSchema,
} from '@/modules/identity/registration.schema'
import { completeRegistration } from '../actions'

const confirmationFormSchema = z
  .object({
    token: completeRegistrationSchema.shape.token,
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .refine(value => value.password === value.passwordConfirmation, {
    error: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  })

export function ConfirmationForm({ token }: { token: string }) {
  const [completed, setCompleted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      token,
      password: '',
      passwordConfirmation: '',
    },
    validators: {
      onSubmit: confirmationFormSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)

      try {
        const result = await completeRegistration({
          token: value.token,
          password: value.password,
        })

        if (!result.success) {
          setMessage(result.message)
          return
        }

        setCompleted(true)
      } catch {
        setMessage(
          'Não foi possível confirmar o resultado do cadastro. Tente novamente.',
        )
      }
    },
  })

  if (completed) {
    return (
      <div role="status" className="space-y-3">
        <h2 className="text-xl font-semibold">Conta criada</h2>

        <p className="text-sm text-muted-foreground">
          Seu email foi confirmado e sua senha foi definida.
        </p>

        <p className="text-sm text-muted-foreground">
          Você ainda não está conectado.
        </p>

        <Link
          href="/app/entrar"
          className="text-sm underline underline-offset-4"
        >
          Entrar na conta
        </Link>
      </div>
    )
  }

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
            <FieldLegend className="sr-only">
              Defina a senha da sua conta
            </FieldLegend>

            <FieldGroup>
              <form.Field
                name="password"
                validators={{ onBlur: passwordSchema }}
              >
                {field => {
                  const errors = field.state.meta.errors
                  const invalid = errors.length > 0

                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="password">Senha</FieldLabel>

                      <Input
                        id="password"
                        name={field.name}
                        type="password"
                        autoComplete="new-password"
                        minLength={15}
                        maxLength={128}
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          field.handleChange(event.currentTarget.value)
                        }}
                        aria-invalid={invalid}
                        aria-describedby="password-description password-error"
                      />

                      <FieldDescription id="password-description">
                        Use de 15 a 128 caracteres. Espaços são permitidos. Você
                        pode usar uma frase longa e fácil de lembrar.
                      </FieldDescription>

                      <FieldError id="password-error" errors={errors} />
                    </Field>
                  )
                }}
              </form.Field>

              <form.Field name="passwordConfirmation">
                {field => {
                  const errors = field.state.meta.errors
                  const invalid = errors.length > 0

                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="password-confirmation">
                        Confirme a senha
                      </FieldLabel>

                      <Input
                        id="password-confirmation"
                        name={field.name}
                        type="password"
                        autoComplete="new-password"
                        minLength={15}
                        maxLength={128}
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={event => {
                          field.handleChange(event.currentTarget.value)
                        }}
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? 'password-confirmation-error' : undefined
                        }
                      />

                      <FieldError
                        id="password-confirmation-error"
                        errors={errors}
                      />
                    </Field>
                  )
                }}
              </form.Field>
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Concluindo cadastro…
                </>
              ) : (
                'Concluir cadastro'
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
