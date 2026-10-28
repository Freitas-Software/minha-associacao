import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatCpf } from '@/lib/formatters'
import { requireSession } from '@/lib/session'
import { getProfile } from '@/modules/identity/profile.server'
import { ChangePasswordForm } from './components/change-password-form'
import { EmailChangeForm } from './components/email-change-form'
import { ProfileForm } from './components/profile-form'

export const metadata: Metadata = {
  title: 'Meu perfil',
  robots: { index: false, follow: false },
}

function formatBirthDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

async function ProfileContent() {
  await io()

  const session = await requireSession()
  const profile = await getProfile(session.userId)

  if (!profile) notFound()

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Seus dados de identificação e contato.
        </p>
        <Link
          href="/app/perfil/sessoes"
          className="inline-block text-sm underline underline-offset-4"
        >
          Gerenciar sessões ativas
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <h2 className="text-sm font-medium text-muted-foreground">CPF</h2>
          <p className="mt-1 font-medium">
            {formatCpf(profile.documentNumber)}
          </p>
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Data de nascimento
          </h2>
          <p className="mt-1 font-medium">
            {formatBirthDate(profile.birthDate)}
          </p>
        </div>

        <div className="rounded-lg border bg-background p-5 sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Email</h2>
            <Badge variant={profile.emailVerifiedAt ? 'default' : 'secondary'}>
              {profile.emailVerifiedAt ? 'Verificado' : 'Pendente'}
            </Badge>
          </div>
          <p className="mt-1 font-medium">{profile.email}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            A alteração de email exige a senha atual e confirmação no novo
            endereço.
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-background p-6">
        <ProfileForm name={profile.name} phone={profile.phone} />
      </section>

      <section className="rounded-lg border bg-background p-6">
        <EmailChangeForm />
      </section>

      <section className="rounded-lg border bg-background p-6">
        <ChangePasswordForm />
      </section>
    </main>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando perfil…
        </p>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}
