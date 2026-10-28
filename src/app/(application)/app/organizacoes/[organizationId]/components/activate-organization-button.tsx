'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { FormMessage } from '@/components/ui/form-message'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { activateOrganizationAction } from '../../actions'

export function ActivateOrganizationButton({
  organizationId,
}: {
  organizationId: string
}) {
  const [state, formAction, pending] = useActionState(
    activateOrganizationAction,
    initialOrganizationActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />

      <ConfirmSubmitButton
        label="Ativar organização"
        confirmLabel="Confirmar ativação"
        description="Ao ativar, o acesso temporário de configuração será encerrado e a organização passará a operar normalmente."
        pending={pending}
        pendingLabel="Ativando…"
        disabled={state.status === 'success'}
      />

      <FormMessage
        status={pending ? 'idle' : state.status}
        message={pending ? '' : state.message}
        className="mt-3"
      />
    </form>
  )
}
