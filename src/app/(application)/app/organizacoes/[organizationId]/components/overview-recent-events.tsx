import type { OrganizationOverviewEvent } from '@/modules/organizations/organization.server'
import { formatDateTime } from './overview-format'

const actionLabels: Record<string, string> = {
  'organization.created': 'Organização criada',
  'organization.updated': 'Sigla atualizada',
  'organization.activated': 'Organização ativada',
  'organization.closed': 'Organização encerrada',
  'organization.reopened': 'Organização reaberta',
  'organization.requested': 'Solicitação de organização',
  'organization.request_approved': 'Solicitação aprovada',
  'organization.request_rejected': 'Solicitação rejeitada',
  'role.created': 'Cargo criado',
  'role.updated': 'Cargo atualizado',
  'invite.created': 'Convite criado',
  'invite.revoked': 'Convite revogado',
  'membership.deactivated': 'Vínculo desativado',
  'membership.role_changed': 'Cargo do vínculo alterado',
}

export function OverviewRecentEvents({
  events,
}: {
  events: OrganizationOverviewEvent[]
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Últimos eventos
        </h2>
        <p className="text-sm text-muted-foreground">
          Registros de auditoria mais recentes desta organização.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-5">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <ol className="space-y-3">
            {events.map(event => (
              <li key={event.id} className="space-y-1">
                <p className="text-sm">
                  {actionLabels[event.action] ?? event.action}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.actorName ?? 'Sistema'} ·{' '}
                  <time dateTime={event.createdAt.toISOString()}>
                    {formatDateTime(event.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
