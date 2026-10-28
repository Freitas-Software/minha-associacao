'use client'

import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
      <form action={approveAction} aria-busy={approving}>
        <input type="hidden" name="requestId" value={requestId} />
        <Button
          type="submit"
          disabled={approving || approveState.status === 'success'}
        >
          {approving ? (
            <>
              <Spinner data-icon="inline-start" />
              Aprovando…
            </>
          ) : (
            'Aprovar criação'
          )}
        </Button>
        {approveState.status !== 'idle' ? (
          <Alert
            variant={
              approveState.status === 'error' ? 'destructive' : 'default'
            }
            className="mt-3"
          >
            <AlertDescription>{approveState.message}</AlertDescription>
          </Alert>
        ) : null}
      </form>

      <form action={rejectAction} aria-busy={rejecting} className="space-y-3">
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
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <Button
          type="submit"
          variant="destructive"
          disabled={rejecting || rejectState.status === 'success'}
        >
          {rejecting ? (
            <>
              <Spinner data-icon="inline-start" />
              Rejeitando…
            </>
          ) : (
            'Rejeitar solicitação'
          )}
        </Button>
        {rejectState.status !== 'idle' ? (
          <Alert
            variant={rejectState.status === 'error' ? 'destructive' : 'default'}
          >
            <AlertDescription>{rejectState.message}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </div>
  )
}
