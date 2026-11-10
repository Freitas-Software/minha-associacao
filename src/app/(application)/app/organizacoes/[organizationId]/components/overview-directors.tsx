import { Badge } from '@/components/ui/badge'
import type { OrganizationOverviewDirector } from '@/modules/organizations/organization.server'
import { formatDate } from './overview-format'

export function OverviewDirectors({
  directors,
}: {
  directors: OrganizationOverviewDirector[]
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Diretoria</h2>
        <p className="text-sm text-muted-foreground">
          Membros ativos que ocupam cargos de diretoria.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-5">
        {directors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cargo de diretoria está ocupado no momento.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {directors.map(director => (
              <li
                key={`${director.roleName}-${director.name}`}
                className="space-y-2 rounded-lg border bg-background p-4"
              >
                <Badge variant="outline">{director.roleName}</Badge>
                <h3 className="font-semibold break-words">{director.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Posse em{' '}
                  <time dateTime={director.joinedAt.toISOString()}>
                    {formatDate(director.joinedAt)}
                  </time>
                </p>
                {director.hasFullAccess ? <Badge>Acesso completo</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
