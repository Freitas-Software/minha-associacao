'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ActionResult } from '@/lib/actions'
import type { RequestRegistrationFields } from '../../schema'
import { requestRegistration } from '../actions'

type RegistrationState = ActionResult<RequestRegistrationFields> | null

const initialValues = {
  name: '',
  documentNumber: '',
  email: '',
  phone: '',
  birthDate: '',
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

export function RegistrationForm() {
  const [values, setValues] = useState(initialValues)

  const [state, formAction, isPending] = useActionState<
    RegistrationState,
    FormData
  >(async (_previousState, formData) => {
    try {
      return await requestRegistration({
        name: formData.get('name'),
        documentNumber: formData.get('documentNumber'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        birthDate: formData.get('birthDate'),
      })
    } catch {
      return {
        success: false,
        message:
          'Não foi possível confirmar a solicitação. Aguarde 60 segundos antes de tentar novamente.',
      }
    }
  }, null)

  const fieldErrors = state?.success === false ? state.fieldErrors : undefined

  return (
    <form action={formAction} aria-busy={isPending}>
      <fieldset disabled={isPending} className="space-y-6">
        <legend className="sr-only">Dados para solicitar seu cadastro</legend>

        <FieldGroup>
          {fields.map(field => {
            const errors = fieldErrors?.[field.name]
            const inputId = `registration-${field.name}`
            const errorId = `${inputId}-error`

            return (
              <Field key={field.name} data-invalid={Boolean(errors?.length)}>
                <FieldLabel htmlFor={inputId}>{field.label}</FieldLabel>
                <Input
                  id={inputId}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  required
                  value={values[field.name]}
                  aria-invalid={Boolean(errors?.length)}
                  aria-describedby={errors?.length ? errorId : undefined}
                  onChange={event => {
                    const value = event.currentTarget.value

                    setValues(previous => ({
                      ...previous,
                      [field.name]: value,
                    }))
                  }}
                />

                {errors?.length ? (
                  <FieldError
                    id={errorId}
                    errors={errors.map(message => ({ message }))}
                  />
                ) : null}
              </Field>
            )
          })}
        </FieldGroup>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Solicitando cadastro' : 'Receber link de cadastro'}
        </Button>
      </fieldset>

      <div aria-live="polite" aria-atomic="true" className="mt-4">
        {state?.success === true ? (
          <p className="text-sm text-muted-foreground">
            Se o cadastro puder prosseguir, você receberá um email com as
            instruções. Confira também uma solicitação anterior e a pasta de
            spam. Aguarde pelo menos 60 segundos antes de solicitar outro link.
          </p>
        ) : null}

        {state?.success === false ? (
          <p className="text-sm text-destructive">{state.message} </p>
        ) : null}
      </div>
    </form>
  )
}
