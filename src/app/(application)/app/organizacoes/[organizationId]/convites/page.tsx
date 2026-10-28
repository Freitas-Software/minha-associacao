import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { getInviteManagementData } from '@/modules/invites/invite.server'
import { CreateInviteForm } from './components/create-invite-form'
import { ResendInviteButton } from './components/resend-invite-button'
import { RevokeInviteButton } from './components/revoke-invite-button'

export const metadata: Metadata = {
  title: 'Convites',
  robots: { index: false, follow: false },
}

type InvitePageProps = {
  params: Promise<{ organizationId: string }>
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function inviteStatus(
  invite: {
    revokedAt: Date | null
    expiresAt: Date
    maxUses: number | null
    usesCount: number
  },
  now: Date,
): {
  label: string
  variant: 'default' | 'secondary' | 'destructive'
} {
  if (invite.revokedAt) return { label: 'Revogado', variant: 'destructive' }
  if (invite.expiresAt.getTime() <= now.getTime()) {
    return { label: 'Expirado', variant: 'secondary' }
  }
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    return { label: 'Esgotado', variant: 'secondary' }
  }
  return { label: 'Ativo', variant: 'default' }
}

function maskDocument(documentNumber: string | null): string {
  if (!documentNumber) return '—'
  return `***.***.***-${documentNumber.slice(-2)}`
}

async function InviteManagementContent({ params }: InvitePageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const data = await getInviteManagementData(session.userId, organizationId)

  if (data.status !== 'ok') notFound()

  const now = new Date()

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <Link
          href="/app/organizacoes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Minhas organizações
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Convites · {data.organization.acronym}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.organization.legalName}
        </p>
      </header>

      <section className="rounded-lg border bg-background p-6">
        <CreateInviteForm
          organizationId={data.organization.id}
          roles={data.roles}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Convites emitidos
        </h2>

        {data.invites.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background p-6">
            <p className="text-sm text-muted-foreground">
              Nenhum convite emitido ainda.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o formulário acima para criar um convite individual ou
              compartilhado.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.invites.map(invite => {
              const status = inviteStatus(invite, now)

              return (
                <li
                  key={invite.id}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {invite.type === 'individual'
                            ? 'Individual'
                            : 'Compartilhado'}
                        </span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invite.roleName ?? 'Cargo padrão de ingresso'} ·{' '}
                        {invite.maxUses === null
                          ? `${invite.usesCount} usos`
                          : `${invite.usesCount} de ${invite.maxUses} usos`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invite.type === 'individual'
                          ? `CPF ${maskDocument(invite.documentNumber)}`
                          : 'Sem CPF vinculado'}{' '}
                        · Expira em{' '}
                        <time dateTime={invite.expiresAt.toISOString()}>
                          {formatDate(invite.expiresAt)}
                        </time>{' '}
                        · Criado em{' '}
                        <time dateTime={invite.createdAt.toISOString()}>
                          {formatDate(invite.createdAt)}
                        </time>
                      </p>
                    </div>

                    {invite.revokedAt === null ? (
                      <div className="flex flex-col gap-3">
                        <ResendInviteButton
                          organizationId={data.organization.id}
                          inviteId={invite.id}
                        />
                        <RevokeInviteButton
                          organizationId={data.organization.id}
                          inviteId={invite.id}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

export default function InviteManagementPage({ params }: InvitePageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando convites…
        </p>
      }
    >
      <InviteManagementContent params={params} />
    </Suspense>
  )
}
