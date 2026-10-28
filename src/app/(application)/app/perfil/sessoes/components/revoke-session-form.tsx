'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { FormMessage } from '@/components/ui/form-message'
import { initialProfileActionState } from '@/modules/identity/profile-action-state'
import { revokeSessionAction } from '../../actions'

export function RevokeSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState(
    revokeSessionAction,
    initialProfileActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="sessionId" value={sessionId} />

      <ConfirmSubmitButton
        label="Encerrar sessão"
        confirmLabel="Confirmar encerramento"
        description="Este dispositivo será desconectado da sua conta."
        pending={pending}
        pendingLabel="Encerrando…"
        variant="destructive"
        size="sm"
      />

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}
