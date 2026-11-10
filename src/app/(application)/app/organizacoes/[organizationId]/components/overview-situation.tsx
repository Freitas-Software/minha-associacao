import {
  CloseOrganizationForm,
  ReopenOrganizationForm,
} from './organization-status-actions'
import { formatDate } from './overview-format'

type OverviewSituationProps = {
  organizationId: string
  status: 'provisioning' | 'active' | 'closed'
  closedAt: Date | null
  canClose: boolean
}

export function OverviewSituation({
  organizationId,
  status,
  closedAt,
  canClose,
}: OverviewSituationProps) {
  if (status === 'provisioning') return null

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Situação</h2>
      </div>

      <div className="space-y-4 rounded-lg border bg-background p-5">
        {status === 'active' ? (
          <>
            <p className="text-sm text-muted-foreground">
              A organização está ativa. Encerrá-la mantém os dados e o histórico
              acessíveis apenas para leitura até uma reabertura.
            </p>
            {canClose ? (
              <CloseOrganizationForm organizationId={organizationId} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Você não tem permissão para encerrar a organização.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {closedAt ? (
                <>
                  Encerrada em{' '}
                  <time dateTime={closedAt.toISOString()}>
                    {formatDate(closedAt)}
                  </time>
                  .{' '}
                </>
              ) : null}
              Enquanto estiver encerrada, a organização não aceita convites,
              novos vínculos ou alterações de configuração.
            </p>
            {canClose ? (
              <ReopenOrganizationForm organizationId={organizationId} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Você não tem permissão para reabrir a organização.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
