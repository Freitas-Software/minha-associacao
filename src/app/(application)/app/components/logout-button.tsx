'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ActionResult } from '@/lib/actions'
import { logout } from '../actions'

type LogoutState = ActionResult<never> | null

export function LogoutButton() {
  const router = useRouter()

  const [state, formAction, isPending] = useActionState<LogoutState, FormData>(
    async () => {
      try {
        const result = await logout()

        if (result.success) {
          router.replace('/app/entrar')
        }

        return result
      } catch {
        return {
          success: false,
          message: 'Não foi possível confirmar o logout. Tente novamente.',
        }
      }
    },
    null,
  )

  return (
    <form action={formAction} aria-busy={isPending}>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? (
          <>
            <Spinner data-icon="inline-start" />
            Saindo…
          </>
        ) : (
          'Sair'
        )}
      </Button>

      {state?.success === false ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
