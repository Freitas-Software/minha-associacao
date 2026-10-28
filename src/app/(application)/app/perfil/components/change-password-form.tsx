'use client'

import { useActionState, useEffect, useRef } from 'react'
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
import { PasswordInput } from '@/components/ui/password-input'
import { Spinner } from '@/components/ui/spinner'
import { initialProfileActionState } from '@/modules/identity/profile-action-state'
import { changePasswordAction } from '../actions'

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialProfileActionState,
  )

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state.status])

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending}
      className="space-y-6"
    >
      <FieldSet>
        <FieldLegend>Alterar senha</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-password">Senha atual</FieldLabel>
            <PasswordInput
              id="current-password"
              name="currentPassword"
              autoComplete="current-password"
              minLength={15}
              maxLength={128}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
            <PasswordInput
              id="new-password"
              name="newPassword"
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              required
            />
            <FieldDescription>
              Use de 15 a 128 caracteres. As outras sessões serão encerradas
              após a alteração.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="password-confirmation">
              Confirme a nova senha
            </FieldLabel>
            <PasswordInput
              id="password-confirmation"
              name="passwordConfirmation"
              autoComplete="new-password"
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
              Alterando…
            </>
          ) : (
            'Alterar senha'
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
