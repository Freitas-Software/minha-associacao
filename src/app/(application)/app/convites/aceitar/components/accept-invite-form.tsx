'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { initialInviteActionState } from '@/modules/invites/invite-action-state'
import { acceptInviteAction } from '../../../organizacoes/actions'

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInviteAction,
    initialInviteActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <Button type="submit" disabled={pending || state.status === 'success'}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Aceitando…
          </>
        ) : (
          'Aceitar convite'
        )}
      </Button>

      {state.status !== 'idle' ? (
        <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === 'success' ? (
        <p className="text-sm">
          <Link
            href="/app/organizacoes"
            className="underline underline-offset-4"
          >
            Ver minhas organizações
          </Link>
        </p>
      ) : null}
    </form>
  )
}
