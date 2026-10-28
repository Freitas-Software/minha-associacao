'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/spinner'
import { initialProfileActionState } from '@/modules/identity/profile-action-state'
import { confirmEmailChangeAction } from '../../actions'

export function ConfirmEmailChangeForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    confirmEmailChangeAction,
    initialProfileActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <Button type="submit" disabled={pending || state.status === 'success'}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Confirmando…
          </>
        ) : (
          'Confirmar novo email'
        )}
      </Button>

      <FormMessage status={state.status} message={state.message} />

      {state.status === 'success' ? (
        <Link
          href="/app/perfil"
          className="inline-block text-sm underline underline-offset-4"
        >
          Voltar ao perfil
        </Link>
      ) : null}
    </form>
  )
}
