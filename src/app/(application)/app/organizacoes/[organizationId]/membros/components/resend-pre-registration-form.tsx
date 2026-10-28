'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/spinner'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { resendPreRegistrationAction } from '../../../actions'

export function ResendPreRegistrationForm({
  organizationId,
  registrationRequestId,
}: {
  organizationId: string
  registrationRequestId: string
}) {
  const [state, formAction, pending] = useActionState(
    resendPreRegistrationAction,
    initialOrganizationActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="mt-3 space-y-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input
        type="hidden"
        name="registrationRequestId"
        value={registrationRequestId}
      />

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Reenviando…
          </>
        ) : (
          'Reenviar link'
        )}
      </Button>

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}
