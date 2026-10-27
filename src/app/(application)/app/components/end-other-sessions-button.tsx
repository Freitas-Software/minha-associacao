'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { endOtherSessions } from '../session-actions'

type FormState = {
  success: boolean
  message: string
} | null

export function EndOtherSessionsButton() {
  const router = useRouter()

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async () => {
      try {
        const result = await endOtherSessions()

        if (result.status === 'expired') {
          router.replace('/app/entrar')

          return {
            success: false,
            message: 'Sua sessão expirou. Entre novamente.',
          }
        }

        if (result.status === 'unavailable') {
          return {
            success: false,
            message:
              'Não foi possível encerrar as outras sessões. Tente novamente.',
          }
        }

        return {
          success: true,
          message:
            'As outras sessões foram encerradas. Você continua conectado neste dispositivo.',
        }
      } catch {
        return {
          success: false,
          message: 'Não foi possível confirmar a operação. Tente novamente.',
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
            Encerrando…
          </>
        ) : (
          'Encerrar outras sessões'
        )}
      </Button>

      {state ? (
        <Alert
          variant={state.success ? 'default' : 'destructive'}
          className="mt-3"
        >
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
