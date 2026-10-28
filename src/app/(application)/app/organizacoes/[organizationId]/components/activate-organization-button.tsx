'use client'

import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
      <Button type="submit" disabled={pending || state.status === 'success'}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Ativando…
          </>
        ) : (
          'Ativar organização'
        )}
      </Button>

      {state.status !== 'idle' ? (
        <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
