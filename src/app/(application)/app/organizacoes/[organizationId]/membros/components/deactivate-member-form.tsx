'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Field, FieldLabel } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { deactivateMembershipAction } from '../../../actions'

export function DeactivateMemberForm({
  organizationId,
  membershipId,
  memberName,
}: {
  organizationId: string
  membershipId: string
  memberName: string
}) {
  const [state, formAction, pending] = useActionState(
    deactivateMembershipAction,
    initialOrganizationActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="membershipId" value={membershipId} />

      <Field>
        <FieldLabel htmlFor={`reason-${membershipId}`}>
          Motivo da desativação
        </FieldLabel>
        <textarea
          id={`reason-${membershipId}`}
          name="reason"
          rows={3}
          minLength={3}
          maxLength={500}
          required
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </Field>

      <ConfirmSubmitButton
        label="Desativar vínculo"
        confirmLabel="Confirmar desativação"
        description={`${memberName} perderá o acesso à organização até ser reativado por um novo convite.`}
        pending={pending}
        pendingLabel="Desativando…"
        variant="destructive"
        size="sm"
      />

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}
