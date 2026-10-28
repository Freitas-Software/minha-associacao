'use client'

import { useForm } from '@tanstack/react-form'
import { useRef, useState } from 'react'
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
import { FormattedInput } from '@/components/ui/formatted-input'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { focusFirstInvalidField } from '@/lib/focus'
import { formatCpf, formatPhone } from '@/lib/formatters'
import {
  type RequestRegistrationInput,
  requestRegistrationSchema,
} from '@/modules/identity/registration.schema'
import { requestRegistration } from '../actions'

type Feedback = {
  status: 'error' | 'success'
  message: string
}

const initialValues: RequestRegistrationInput = {
  name: '',
  documentNumber: '',
  email: '',
  phone: '',
  birthDate: '',
}

type RegistrationField = {
  name: keyof RequestRegistrationInput
  label: string
  type: 'text' | 'email' | 'tel' | 'date'
  autoComplete: string
  placeholder?: string
  maxLength?: number
  description?: string
  format?: (value: string) => string
  maxDigits?: number
  inputMode?: 'numeric' | 'tel'
}

const fields: RegistrationField[] = [
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
    description:
      'Digite os 11 dígitos. A formatação é aplicada automaticamente.',
    format: formatCpf,
    maxDigits: 11,
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'voce@exemplo.com',
    maxLength: 55,
    description: 'Enviaremos o link de confirmação para este endereço.',
  },
  {
    name: 'phone',
    label: 'Telefone',
    type: 'tel',
    autoComplete: 'tel-national',
    placeholder: '(95) 91234-5678',
    maxLength: 15,
    description: 'Informe DDD e número, com 11 dígitos.',
    format: formatPhone,
    maxDigits: 11,
    inputMode: 'tel',
  },
  {
    name: 'birthDate',
    label: 'Data de nascimento',
    type: 'date',
    autoComplete: 'bday',
  },
]

export function RegistrationForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: requestRegistrationSchema,
    },
    onSubmitInvalid: () => focusFirstInvalidField(formRef.current),
    onSubmit: async ({ value }) => {
      setFeedback(null)

      try {
        const result = await requestRegistration(value)

        if (!result.success) {
          setFeedback({ status: 'error', message: result.message })
          return
        }

        setFeedback({
          status: 'success',
          message:
            'Se o cadastro puder prosseguir, você receberá um email com as instruções. Confira também uma solicitação anterior e a pasta de spam. Aguarde pelo menos 60 segundos antes de solicitar outro link.',
        })
      } catch {
        setFeedback({
          status: 'error',
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
              Dados para solicitar seu cadastro
            </FieldLegend>

            <p className="text-sm text-muted-foreground">
              Todos os campos são obrigatórios.
            </p>

            <FieldGroup>
              {fields.map(field => (
                <form.Field
                  key={field.name}
                  name={field.name}
                  validators={{
                    onBlur: ({ value }) => {
                      const result =
                        requestRegistrationSchema.shape[field.name].safeParse(
                          value,
                        )

                      return result.success
                        ? undefined
                        : result.error.issues[0]?.message
                    },
                  }}
                >
                  {fieldApi => {
                    const errors = fieldApi.state.meta.errors
                    const invalid = errors.length > 0
                    const inputId = `registration-${field.name}`
                    const errorId = `${inputId}-error`
                    const descriptionId = field.description
                      ? `${inputId}-description`
                      : undefined
                    const describedBy = [
                      descriptionId,
                      invalid ? errorId : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
                    const formatter = field.format

                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel htmlFor={inputId}>{field.label}</FieldLabel>

                        {formatter ? (
                          <FormattedInput
                            id={inputId}
                            name={fieldApi.name}
                            format={formatter}
                            maxDigits={field.maxDigits ?? 0}
                            inputMode={field.inputMode}
                            autoComplete={field.autoComplete}
                            placeholder={field.placeholder}
                            maxLength={field.maxLength}
                            required
                            value={fieldApi.state.value}
                            onBlur={fieldApi.handleBlur}
                            onValueChange={fieldApi.handleChange}
                            aria-invalid={invalid}
                            aria-describedby={describedBy || undefined}
                          />
                        ) : (
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
                            aria-describedby={describedBy || undefined}
                          />
                        )}

                        {descriptionId ? (
                          <FieldDescription id={descriptionId}>
                            {field.description}
                          </FieldDescription>
                        ) : null}

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

            <FormMessage
              status={feedback?.status ?? 'idle'}
              message={feedback?.message ?? ''}
            />
          </FieldSet>
        </form>
      )}
    </form.Subscribe>
  )
}
