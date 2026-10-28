'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
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

      <FormMessage
        status={
          isPending ? 'idle' : state?.success === false ? 'error' : 'idle'
        }
        message={isPending || state?.success !== false ? '' : state.message}
        className="mt-3"
      />
    </form>
  )
}
