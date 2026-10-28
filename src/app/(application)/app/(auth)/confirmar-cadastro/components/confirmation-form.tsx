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
import {
  completeRegistrationSchema,
  passwordSchema,
} from '@/modules/identity/registration.schema'
import type { RegistrationContactContext } from '@/modules/identity/registration-contact.server'
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

export function ConfirmationForm({
  token,
  contactContext,
}: {
  token: string
  contactContext: RegistrationContactContext | null
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [completed, setCompleted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [contactChoice, setContactChoice] = useState('existing')

  const form = useForm({
    defaultValues: {
      token,
      password: '',
      passwordConfirmation: '',
    },
    validators: {
      onSubmit: confirmationFormSchema,
    },
    onSubmitInvalid: () => focusFirstInvalidField(formRef.current),
    onSubmit: async ({ value }) => {
      setMessage(null)

      try {
        const result = await completeRegistration({
          token: value.token,
          password: value.password,
          contactChoice:
            contactContext && contactContext.conflicts.length > 0
              ? contactChoice
              : undefined,
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
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Conta criada</h2>

        <p role="status" className="text-sm text-muted-foreground">
          Seu email foi confirmado e sua senha foi definida. Você ainda não está
          conectado.
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
            <FieldLegend className="sr-only">
              Defina a senha da sua conta
            </FieldLegend>

            {contactContext && contactContext.conflicts.length > 0 ? (
              <FieldSet>
                <FieldLegend variant="label">Contato da conta</FieldLegend>
                <FieldDescription>
                  Uma ou mais organizações informaram um contato diferente do
                  seu cadastro. Escolha qual contato deseja manter.
                </FieldDescription>

                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                    <input
                      type="radio"
                      name="contactChoice"
                      value="existing"
                      checked={contactChoice === 'existing'}
                      onChange={() => setContactChoice('existing')}
                      className="mt-0.5 size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    <span>
                      Manter meu contato atual
                      <span className="block text-xs text-muted-foreground">
                        {contactContext.currentEmail} ·{' '}
                        {contactContext.currentPhone}
                      </span>
                    </span>
                  </label>

                  {contactContext.conflicts.map(conflict => (
                    <label
                      key={conflict.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="contactChoice"
                        value={conflict.id}
                        checked={contactChoice === conflict.id}
                        onChange={() => setContactChoice(conflict.id)}
                        className="mt-0.5 size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      />
                      <span>
                        Usar o contato informado por {conflict.organizationName}
                        <span className="block text-xs text-muted-foreground">
                          {conflict.email} · {conflict.phone}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </FieldSet>
            ) : null}

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
                  Concluindo cadastro…
                </>
              ) : (
                'Concluir cadastro'
              )}
            </Button>

            <FormMessage
              status={message ? 'error' : 'idle'}
              message={message ?? ''}
            />

            <Link
              href="/app/cadastro"
              className="inline-block text-sm underline underline-offset-4"
            >
              Solicitar um novo link de cadastro
            </Link>
          </FieldSet>
        </form>
      )}
    </form.Subscribe>
  )
}
