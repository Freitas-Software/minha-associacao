'use client'

import { useForm } from '@tanstack/react-form'
import Link from 'next/link'
import { useRef, useState } from 'react'
import z from 'zod'
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
import { FormMessage } from '@/components/ui/form-message'
import { PasswordInput } from '@/components/ui/password-input'
import { Spinner } from '@/components/ui/spinner'
import { focusFirstInvalidField } from '@/lib/focus'
import { passwordSchema } from '@/modules/identity/registration.schema'
import { resetPassword } from '../actions'

const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .refine(value => value.password === value.passwordConfirmation, {
    error: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  })

type ResetPasswordFormProps = {
  token: string
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [completed, setCompleted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      password: '',
      passwordConfirmation: '',
    },
    validators: {
      onSubmit: resetPasswordFormSchema,
    },
    onSubmitInvalid: () => focusFirstInvalidField(formRef.current),
    onSubmit: async ({ value }) => {
      setMessage(null)

      try {
        const result = await resetPassword({
          token,
          password: value.password,
        })

        if (!result.success) {
          setMessage(result.message)
          return
        }

        setCompleted(true)
      } catch {
        setMessage(
          'Não foi possível confirmar o resultado da solicitação. Tente novamente.',
        )
      }
    },
  })

  if (completed) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Senha atualizada</h2>

        <p role="status" className="text-sm text-muted-foreground">
          Sua nova senha foi definida e as sessões anteriores foram encerradas.
          Entre novamente para acessar sua conta.
        </p>

        <Link
          href="/app/entrar"
          className="inline-block text-sm underline underline-offset-4"
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
            <FieldLegend className="sr-only">Defina sua nova senha</FieldLegend>

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

                      <PasswordInput
                        id="password"
                        name={field.name}
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

                      <PasswordInput
                        id="password-confirmation"
                        name={field.name}
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
                  Atualizando senha…
                </>
              ) : (
                'Atualizar senha'
              )}
            </Button>

            <FormMessage
              status={message ? 'error' : 'idle'}
              message={message ?? ''}
            />

            <Link
              href="/app/recuperar-senha"
              className="inline-block text-sm underline underline-offset-4"
            >
              Solicitar um novo link
            </Link>
          </FieldSet>
        </form>
      )}
    </form.Subscribe>
  )
}
