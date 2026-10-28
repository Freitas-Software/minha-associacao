'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { FormMessage } from '@/components/ui/form-message'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import {
  approveOrganizationRequestAction,
  rejectOrganizationRequestAction,
} from '../../../organizacoes/actions'

export function ReviewRequestActions({ requestId }: { requestId: string }) {
  const [approveState, approveAction, approving] = useActionState(
    approveOrganizationRequestAction,
    initialOrganizationActionState,
  )
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectOrganizationRequestAction,
    initialOrganizationActionState,
  )

  return (
    <div className="space-y-5">
      <form action={approveAction} aria-busy={approving} className="space-y-3">
        <input type="hidden" name="requestId" value={requestId} />

        <ConfirmSubmitButton
          label="Aprovar criação"
          confirmLabel="Confirmar aprovação"
          description="A solicitação será aprovada e a organização será criada com o solicitante como presidente ativo."
          pending={approving}
          pendingLabel="Aprovando…"
          disabled={approveState.status === 'success'}
        />

        <FormMessage
          status={approving ? 'idle' : approveState.status}
          message={approving ? '' : approveState.message}
          className="mt-3"
        />
      </form>

      <form
        action={rejectAction}
        aria-busy={rejecting}
        className="space-y-3"
        onSubmit={event => {
          event.preventDefault()
          rejectAction(new FormData(event.currentTarget))
        }}
      >
        <input type="hidden" name="requestId" value={requestId} />

        <label
          htmlFor={`reject-${requestId}`}
          className="block text-sm font-medium"
        >
          Motivo da rejeição
        </label>
        <textarea
          id={`reject-${requestId}`}
          name="reason"
          rows={3}
          maxLength={500}
          required
          aria-describedby={`reject-${requestId}-description`}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive dark:bg-input/30"
        />
        <p
          id={`reject-${requestId}-description`}
          className="text-sm text-muted-foreground"
        >
          Explique o motivo para que o solicitante entenda a decisão. Máximo de
          500 caracteres.
        </p>

        <ConfirmSubmitButton
          label="Rejeitar solicitação"
          confirmLabel="Confirmar rejeição"
          description="A solicitação será marcada como rejeitada e o solicitante verá o motivo informado."
          pending={rejecting}
          pendingLabel="Rejeitando…"
          variant="destructive"
          disabled={rejectState.status === 'success'}
        />

        <FormMessage
          status={rejecting ? 'idle' : rejectState.status}
          message={rejecting ? '' : rejectState.message}
        />
      </form>
    </div>
  )
}
