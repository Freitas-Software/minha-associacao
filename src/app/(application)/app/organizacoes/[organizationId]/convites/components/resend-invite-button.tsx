'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { FormMessage } from '@/components/ui/form-message'
import { initialInviteActionState } from '@/modules/invites/invite-action-state'
import { resendInviteAction } from '../../../actions'

export function ResendInviteButton({
  organizationId,
  inviteId,
}: {
  organizationId: string
  inviteId: string
}) {
  const [state, formAction, pending] = useActionState(
    resendInviteAction,
    initialInviteActionState,
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 4000)

    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copyInviteUrl() {
    if (!state.inviteUrl) return

    try {
      await navigator.clipboard.writeText(state.inviteUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="inviteId" value={inviteId} />

      <ConfirmSubmitButton
        label="Reenviar"
        confirmLabel="Confirmar reenvio"
        description="O link atual será invalidado e um novo link será gerado."
        pending={pending}
        pendingLabel="Reenviando…"
        variant="outline"
        size="sm"
      />

      <FormMessage
        status={
          pending
            ? 'idle'
            : state.status === 'success'
              ? 'success'
              : state.status === 'error'
                ? 'error'
                : 'idle'
        }
        message={pending ? '' : state.message}
      />

      {state.inviteUrl ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-sm break-all text-muted-foreground select-all">
            {state.inviteUrl}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyInviteUrl}
          >
            {copied ? 'Link copiado' : 'Copiar novo link'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
