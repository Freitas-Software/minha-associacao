'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
    <form action={formAction} aria-busy={pending}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button type="submit" variant="destructive" size="xs" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Revogando…
          </>
        ) : (
          'Revogar'
        )}
      </Button>
      {state.status === 'error' ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
