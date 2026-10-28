'use client'

import { useActionState } from 'react'
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
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Spinner } from '@/components/ui/spinner'
import { initialProfileActionState } from '@/modules/identity/profile-action-state'
import { requestEmailChangeAction } from '../actions'

export function EmailChangeForm() {
  const [state, formAction, pending] = useActionState(
    requestEmailChangeAction,
    initialProfileActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-6">
      <FieldSet>
        <FieldLegend>Alterar email</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email-change-new-email">Novo email</FieldLabel>
            <Input
              id="email-change-new-email"
              name="newEmail"
              type="email"
              maxLength={55}
              autoComplete="email"
              required
            />
            <FieldDescription>
              Enviaremos um link de confirmação para o novo endereço. O email só
              muda depois da confirmação.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="email-change-password">Senha atual</FieldLabel>
            <PasswordInput
              id="email-change-password"
              name="password"
              autoComplete="current-password"
              minLength={15}
              maxLength={128}
              required
            />
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Enviando…
            </>
          ) : (
            'Enviar link de confirmação'
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
