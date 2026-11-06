'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import {
  closeOrganizationAction,
  reopenOrganizationAction,
} from '../../actions'

export function CloseOrganizationForm({
  organizationId,
}: {
  organizationId: string
}) {
  const [state, formAction, pending] = useActionState(
    closeOrganizationAction,
    initialOrganizationActionState,
  )

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="space-y-4"
      onSubmit={event => {
        event.preventDefault()
        formAction(new FormData(event.currentTarget))
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field>
        <FieldLabel htmlFor="organization-close-reason">
          Motivo do encerramento
        </FieldLabel>
        <textarea
          id="organization-close-reason"
          name="reason"
          rows={3}
          minLength={3}
          maxLength={500}
          required
          aria-describedby="organization-close-reason-hint"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <FieldDescription id="organization-close-reason-hint">
          O motivo fica registrado na auditoria da organização.
        </FieldDescription>
      </Field>

      <ConfirmSubmitButton
        label="Encerrar organização"
        confirmLabel="Confirmar encerramento"
        description="A organização passará a ser somente leitura e os convites válidos serão revogados. Ela poderá ser reaberta por quem tem a permissão de encerrar e reabrir."
        pending={pending}
        pendingLabel="Encerrando…"
        variant="destructive"
        disabled={state.status === 'success'}
      />

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}

export function ReopenOrganizationForm({
  organizationId,
}: {
  organizationId: string
}) {
  const [state, formAction, pending] = useActionState(
    reopenOrganizationAction,
    initialOrganizationActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <ConfirmSubmitButton
        label="Reabrir organização"
        confirmLabel="Confirmar reabertura"
        description="A organização volta a operar normalmente. Os convites revogados no encerramento não são restaurados."
        pending={pending}
        pendingLabel="Reabrindo…"
        disabled={state.status === 'success'}
      />

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}
