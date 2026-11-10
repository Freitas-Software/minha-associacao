import type { Metadata } from 'next'
import { io } from 'next/cache'
import { Suspense } from 'react'
import { completeRegistrationSchema } from '@/modules/identity/registration.schema'
import { getRegistrationContactContext } from '@/modules/identity/registration-contact.server'
import { ConfirmationForm } from './components/confirmation-form'
import { LinkUnavailable } from './components/link-unavailable'

export const metadata: Metadata = {
  title: 'Confirmar cadastro',
  robots: {
    index: false,
    follow: false,
  },
  referrer: 'no-referrer',
}

type ConfirmationPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

async function ConfirmationContent({ searchParams }: ConfirmationPageProps) {
  await io()

  const params = await searchParams
  const parsedToken = completeRegistrationSchema.shape.token.safeParse(
    params.token,
  )

  if (!parsedToken.success) {
    return <LinkUnavailable />
  }

  const contactContext = await getRegistrationContactContext(parsedToken.data)

  if (contactContext === null) {
    return <LinkUnavailable />
  }

  return (
    <ConfirmationForm
      key={parsedToken.data}
      token={parsedToken.data}
      contactContext={contactContext}
    />
  )
}

export default function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  return (
    <main className="mx-auto w-full max-w-lg">
      <Suspense
        fallback={
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Conclua seu cadastro
            </h1>

            <p role="status" className="text-sm text-muted-foreground">
              Carregando confirmação…
            </p>
          </div>
        }
      >
        <ConfirmationContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
