'use client'

import { useForm } from '@tanstack/react-form'
import Link from 'next/link'
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
import { requestPasswordResetSchema } from '../../schema'
import { requestPasswordReset } from '../actions'

type Feedback =
  | { variant: 'default'; message: string }
  | { variant: 'destructive'; message: string }

export function RequestPasswordResetForm() {
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const form = useForm({
    defaultValues: {
      documentNumber: '',
    },
    validators: {
      onSubmit: requestPasswordResetSchema,
    },
    onSubmit: async ({ value }) => {
      setFeedback(null)

      try {
        const result = await requestPasswordReset(value)

        if (!result.success) {
          setFeedback({ variant: 'destructive', message: result.message })
          return
        }

        setFeedback({
          variant: 'default',
          message:
            'Se houver uma conta com esse CPF, enviaremos as instruções para o email cadastrado. Confira também o spam. Aguarde pelo menos 60 segundos antes de pedir outro link.',
        })
      } catch {
        setFeedback({
          variant: 'destructive',
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

                        <Input
                          id="reset-cpf"
                          name={field.name}
                          type="text"
                          autoComplete="username"
                          inputMode="numeric"
                          maxLength={14}
                          required
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={event => {
                            field.handleChange(event.currentTarget.value)
                          }}
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

              {feedback ? (
                <Alert variant={feedback.variant}>
                  <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
              ) : null}
            </FieldSet>
          </form>
        )}
      </form.Subscribe>

      <Link href="/app/entrar" className="text-sm underline underline-offset-4">
        Voltar para entrar
      </Link>
    </div>
  )
}
