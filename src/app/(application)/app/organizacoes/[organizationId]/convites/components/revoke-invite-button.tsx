'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { FormMessage } from '@/components/ui/form-message'
import { initialInviteActionState } from '@/modules/invites/invite-action-state'
import { revokeInviteAction } from '../../../actions'

export function RevokeInviteButton({
  organizationId,
  inviteId,
}: {
  organizationId: string
  inviteId: string
}) {
  const [state, formAction, pending] = useActionState(
    revokeInviteAction,
    initialInviteActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="inviteId" value={inviteId} />

      <ConfirmSubmitButton
        label="Revogar"
        confirmLabel="Confirmar revogação"
        description="O link deixará de funcionar imediatamente. Esta ação não pode ser desfeita."
        pending={pending}
        pendingLabel="Revogando…"
        variant="destructive"
        size="sm"
      />

      <FormMessage
        status={pending ? 'idle' : state.status === 'error' ? 'error' : 'idle'}
        message={pending ? '' : state.message}
      />
    </form>
  )
}
