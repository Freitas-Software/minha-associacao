'use client'

import { useForm } from '@tanstack/react-form'
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
import {
  type RequestRegistrationInput,
  requestRegistrationSchema,
} from '@/modules/identity/registration.schema'
import { requestRegistration } from '../actions'

type Feedback =
  | { variant: 'default'; message: string }
  | { variant: 'destructive'; message: string }

const initialValues: RequestRegistrationInput = {
  name: '',
  documentNumber: '',
  email: '',
  phone: '',
  birthDate: '',
}

export function RegistrationForm() {
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: requestRegistrationSchema,
    },
    onSubmit: async ({ value }) => {
      setFeedback(null)

      try {
        const result = await requestRegistration(value)

        if (!result.success) {
          setFeedback({ variant: 'destructive', message: result.message })
          return
        }

        setFeedback({
          variant: 'default',
          message:
            'Se o cadastro puder prosseguir, você receberá um email com as instruções. Confira também uma solicitação anterior e a pasta de spam. Aguarde pelo menos 60 segundos antes de solicitar outro link.',
        })
      } catch {
        setFeedback({
          variant: 'destructive',
          message:
            'Não foi possível confirmar a solicitação. Aguarde 60 segundos antes de tentar novamente.',
        })
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
            <FieldLegend className="sr-only">
              Dados para solicitar seu cadastro
            </FieldLegend>

            <FieldGroup>
              {fields.map(field => (
                <form.Field key={field.name} name={field.name}>
                  {fieldApi => {
                    const errors = fieldApi.state.meta.errors
                    const invalid = errors.length > 0
                    const inputId = `registration-${field.name}`
                    const errorId = `${inputId}-error`

                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel htmlFor={inputId}>{field.label}</FieldLabel>

                        <Input
                          id={inputId}
                          name={fieldApi.name}
                          type={field.type}
                          autoComplete={field.autoComplete}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          required
                          value={fieldApi.state.value}
                          onBlur={fieldApi.handleBlur}
                          onChange={event => {
                            fieldApi.handleChange(event.currentTarget.value)
                          }}
                          aria-invalid={invalid}
                          aria-describedby={invalid ? errorId : undefined}
                        />

                        <FieldError id={errorId} errors={errors} />
                      </Field>
                    )
                  }}
                </form.Field>
              ))}
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Solicitando cadastro…
                </>
              ) : (
                'Receber link de cadastro'
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
  )
}

const fields = [
  {
    name: 'name',
    label: 'Nome completo',
    type: 'text',
    autoComplete: 'name',
    placeholder: 'Seu nome completo',
    maxLength: 255,
  },
  {
    name: 'documentNumber',
    label: 'CPF',
    type: 'text',
    autoComplete: 'off',
    placeholder: '000.000.000-00',
    maxLength: 14,
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'voce@exemplo.com',
    maxLength: 55,
  },
  {
    name: 'phone',
    label: 'Telefone',
    type: 'tel',
    autoComplete: 'tel-national',
    placeholder: '(95) 91234-5678',
    maxLength: 15,
  },
  {
    name: 'birthDate',
    label: 'Data de nascimento',
    type: 'date',
    autoComplete: 'bday',
    placeholder: undefined,
    maxLength: undefined,
  },
] as const
