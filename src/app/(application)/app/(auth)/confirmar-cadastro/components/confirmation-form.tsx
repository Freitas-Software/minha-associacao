'use client'

import { useForm } from '@tanstack/react-form'
import Link from 'next/link'
import { useRef, useState } from 'react'
import z from 'zod'
import { Badge } from '@/components/ui/badge'
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
import { formatPhone } from '@/lib/formatters'
import {
  completeRegistrationSchema,
  passwordSchema,
} from '@/modules/identity/registration.schema'
import type { RegistrationContactContext } from '@/modules/identity/registration-contact.server'
import { completeRegistration } from '../actions'
import { RegistrationSummary } from './registration-summary'

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

const linkClassName =
  'w-fit rounded-sm py-1 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function ConfirmationForm({
  token,
  contactContext,
}: {
  token: string
  contactContext: RegistrationContactContext
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [completed, setCompleted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [contactChoice, setContactChoice] = useState('existing')

  const hasConflicts = contactContext.conflicts.length > 0
  const organization = contactContext.organization

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
          contactChoice: hasConflicts ? contactChoice : undefined,
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
    const successMessage = organization
      ? `Sua conta foi criada e seu vínculo com ${organization.legalName} está ativo. Você ainda não está conectado.`
      : 'Sua conta foi criada e seu email foi confirmado. Você ainda não está conectado.'

    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Cadastro concluído
        </h1>

        <FormMessage status="success" message={successMessage} />

        <Link href="/app/entrar" className={linkClassName}>
          Entrar na conta
        </Link>
      </div>
    )
  }

  return (
    <>
      <header className="mb-8 min-w-0 space-y-3">
        {organization ? (
          <Badge variant="outline">{organization.acronym}</Badge>
        ) : null}

        <h1 className="text-3xl font-semibold tracking-tight break-words">
          {organization ? 'Conclua seu vínculo' : 'Conclua seu cadastro'}
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground break-words">
          {organization
            ? `Defina uma senha para criar sua conta e ativar seu vínculo com ${organization.legalName}.`
            : 'Defina uma senha para criar sua conta e confirmar seu email.'}
        </p>
      </header>

      <RegistrationSummary contactContext={contactContext} />

      <form.Subscribe selector={state => state.isSubmitting}>
        {isSubmitting => (
          <form
            ref={formRef}
            noValidate
            aria-busy={isSubmitting}
            className="mt-6 space-y-6"
            onSubmit={event => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <FieldSet>
              <FieldLegend className="sr-only">Concluir cadastro</FieldLegend>

              {hasConflicts ? (
                <FieldSet aria-describedby="contact-choice-description">
                  <FieldLegend variant="label">Contato da conta</FieldLegend>
                  <FieldDescription id="contact-choice-description">
                    Uma ou mais organizações informaram um contato diferente do
                    seu cadastro. Escolha qual contato deseja manter.
                  </FieldDescription>

                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 text-sm">
                      <input
                        type="radio"
                        name="contactChoice"
                        value="existing"
                        checked={contactChoice === 'existing'}
                        onChange={() => setContactChoice('existing')}
                        className="mt-0.5 size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      />
                      <span className="min-w-0 break-words">
                        Manter meu contato atual
                        <span className="block text-xs break-all text-muted-foreground">
                          {contactContext.currentEmail} ·{' '}
                          {formatPhone(contactContext.currentPhone)}
                        </span>
                      </span>
                    </label>

                    {contactContext.conflicts.map(conflict => (
                      <label
                        key={conflict.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="contactChoice"
                          value={conflict.id}
                          checked={contactChoice === conflict.id}
                          onChange={() => setContactChoice(conflict.id)}
                          className="mt-0.5 size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        />
                        <span className="min-w-0 break-words">
                          Usar o contato informado por{' '}
                          {conflict.organizationName}
                          <span className="block text-xs break-all text-muted-foreground">
                            {conflict.email} · {formatPhone(conflict.phone)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </FieldSet>
              ) : null}

              <FieldSet>
                <FieldLegend className="sr-only">Senha da conta</FieldLegend>

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
                          <FieldLabel htmlFor="password">Nova senha</FieldLabel>

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
                            aria-describedby={
                              invalid
                                ? 'password-description password-error'
                                : 'password-description'
                            }
                          />

                          <FieldDescription id="password-description">
                            Use de 15 a 128 caracteres. Espaços são permitidos;
                            uma frase longa é uma boa senha.
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
                            Confirme a nova senha
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
                              invalid
                                ? 'password-confirmation-error'
                                : undefined
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
              </FieldSet>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Concluindo cadastro…
                  </>
                ) : organization ? (
                  'Criar conta e ingressar na associação'
                ) : (
                  'Criar conta'
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

      <footer className="mt-6 space-y-2 border-t pt-4 text-sm text-muted-foreground">
        <p>Este link é de uso único e vale por 30 minutos.</p>

        <div className="flex flex-col gap-2">
          <Link href="/app/cadastro" className={linkClassName}>
            Solicitar um novo link
          </Link>

          <Link href="/app/entrar" className={linkClassName}>
            Já tem conta? Entrar
          </Link>
        </div>
      </footer>
    </>
  )
}
