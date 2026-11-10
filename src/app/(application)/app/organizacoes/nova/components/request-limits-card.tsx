import Link from 'next/link'
import {
  ORGANIZATION_REQUEST_MAX_PENDING,
  ORGANIZATION_REQUEST_MAX_PER_WINDOW,
} from '@/modules/organizations/organization-request-limits'

type RequestLimitsCardProps = {
  pendingCount: number
  recentCount: number
  limitReached: boolean
}

export function RequestLimitsCard({
  pendingCount,
  recentCount,
  limitReached,
}: RequestLimitsCardProps) {
  return (
    <section className="rounded-lg border bg-background p-5">
      <h2 className="text-base font-semibold">Limites de solicitação</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Os limites são verificados no servidor a cada envio.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Solicitações em análise</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {pendingCount} de {ORGANIZATION_REQUEST_MAX_PENDING}
          </p>
          <p className="text-sm text-muted-foreground">
            Até {ORGANIZATION_REQUEST_MAX_PENDING} solicitações pendentes ao
            mesmo tempo.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium">Envios nas últimas 24 horas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {recentCount} de {ORGANIZATION_REQUEST_MAX_PER_WINDOW}
          </p>
          <p className="text-sm text-muted-foreground">
            Até {ORGANIZATION_REQUEST_MAX_PER_WINDOW} envios por conta em 24
            horas.
          </p>
        </div>
      </div>

      {limitReached ? (
        <p className="mt-4 text-sm text-destructive">
          Você atingiu um dos limites. Aguarde a análise das solicitações
          existentes ou o fim da janela de 24 horas.
        </p>
      ) : null}

      <Link
        href="/app/organizacoes/solicitacoes"
        className="mt-4 inline-block text-sm underline underline-offset-4"
      >
        Ver minhas solicitações
      </Link>
    </section>
  )
}
