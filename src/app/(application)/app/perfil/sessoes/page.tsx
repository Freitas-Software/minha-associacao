import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { listActiveSessions } from '@/modules/identity/sessions.server'
import { RevokeSessionForm } from './components/revoke-session-form'

export const metadata: Metadata = {
  title: 'Sessões ativas',
  robots: { index: false, follow: false },
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

async function SessionsContent() {
  await io()

  const session = await requireSession()
  const result = await listActiveSessions(session.userId, session.sessionId)

  if (result.status !== 'ok') notFound()

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/app/perfil"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Perfil
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Sessões ativas
        </h1>
        <p className="text-sm text-muted-foreground">
          Dispositivos conectados à sua conta. Encerre sessões que você não
          reconhece.
        </p>
      </header>

      <ul className="space-y-3">
        {result.sessions.map(activeSession => (
          <li
            key={activeSession.id}
            className="space-y-3 rounded-lg border bg-background p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {activeSession.isCurrent
                      ? 'Este dispositivo'
                      : 'Outro dispositivo'}
                  </p>
                  {activeSession.isCurrent ? <Badge>Atual</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Iniciada em {formatDateTime(activeSession.createdAt)} · Última
                  atividade em {formatDateTime(activeSession.lastSeenAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expira em {formatDateTime(activeSession.expiresAt)}
                </p>
              </div>

              {!activeSession.isCurrent ? (
                <RevokeSessionForm sessionId={activeSession.id} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default function SessionsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando sessões…
        </p>
      }
    >
      <SessionsContent />
    </Suspense>
  )
}
