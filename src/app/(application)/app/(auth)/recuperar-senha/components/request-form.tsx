'use client'

import { useForm } from '@tanstack/react-form'
import Link from 'next/link'
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
import { Spinner } from '@/components/ui/spinner'
import { focusFirstInvalidField } from '@/lib/focus'
import { formatCpf } from '@/lib/formatters'
import { requestPasswordResetSchema } from '../../schema'
import { requestPasswordReset } from '../actions'

type Feedback = {
  status: 'error' | 'success'
  message: string
}

export function RequestPasswordResetForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const form = useForm({
    defaultValues: {
      documentNumber: '',
    },
    validators: {
      onSubmit: requestPasswordResetSchema,
    },
    onSubmitInvalid: () => focusFirstInvalidField(formRef.current),
    onSubmit: async ({ value }) => {
      setFeedback(null)

      try {
        const result = await requestPasswordReset(value)

        if (!result.success) {
          setFeedback({ status: 'error', message: result.message })
          return
        }

        setFeedback({
          status: 'success',
          message:
            'Se houver uma conta com esse CPF, enviaremos as instruções para o email cadastrado. Confira também o spam. Aguarde pelo menos 60 segundos antes de pedir outro link.',
        })
      } catch {
        setFeedback({
          status: 'error',
          message:
            'Não foi possível confirmar a solicitação. Tente novamente em instantes.',
        })
      }
    },
  })

  return (
    <div className="space-y-6">
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
                Solicitar recuperação de senha
              </FieldLegend>

              <FieldGroup>
                <form.Field
                  name="documentNumber"
                  validators={{
                    onBlur: requestPasswordResetSchema.shape.documentNumber,
                  }}
                >
                  {field => {
                    const errors = field.state.meta.errors
                    const invalid = errors.length > 0

                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel htmlFor="reset-cpf">CPF</FieldLabel>

                        <FormattedInput
                          id="reset-cpf"
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
                            invalid ? 'reset-cpf-error' : undefined
                          }
                        />

                        <FieldError id="reset-cpf-error" errors={errors} />
                      </Field>
                    )
                  }}
                </form.Field>
              </FieldGroup>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Solicitando…
                  </>
                ) : (
                  'Receber link de recuperação'
                )}
              </Button>

              <FormMessage
                status={feedback?.status ?? 'idle'}
                message={feedback?.message ?? ''}
              />
            </FieldSet>
          </form>
        )}
      </form.Subscribe>

      <Link
        href="/app/entrar"
        className="inline-block text-sm underline underline-offset-4"
      >
        Voltar para entrar
      </Link>
    </div>
  )
}
