'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { FormattedInput } from '@/components/ui/formatted-input'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatPhone } from '@/lib/formatters'
import { initialProfileActionState } from '@/modules/identity/profile-action-state'
import { updateProfileAction } from '../actions'

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialProfileActionState,
  )
  const [nameValue, setNameValue] = useState(name)
  const [phoneValue, setPhoneValue] = useState(formatPhone(phone))

  return (
    <form action={formAction} aria-busy={pending} className="space-y-6">
      <FieldSet>
        <FieldLegend>Dados pessoais</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-name">Nome completo</FieldLabel>
            <Input
              id="profile-name"
              name="name"
              type="text"
              minLength={3}
              maxLength={255}
              autoComplete="name"
              required
              value={nameValue}
              onChange={event => setNameValue(event.currentTarget.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-phone">Telefone</FieldLabel>
            <FormattedInput
              id="profile-phone"
              name="phone"
              format={formatPhone}
              maxDigits={11}
              maxLength={15}
              autoComplete="tel"
              placeholder="(00) 00000-0000"
              required
              value={phoneValue}
              onValueChange={setPhoneValue}
            />
            <FieldDescription>
              Usado para contato da organização. CPF, email e data de nascimento
              não podem ser alterados por aqui.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Salvando…
            </>
          ) : (
            'Salvar alterações'
          )}
        </Button>

        <FormMessage
          status={pending ? 'idle' : state.status}
          message={pending ? '' : state.message}
          className="mt-4"
        />
      </FieldSet>
    </form>
  )
}
