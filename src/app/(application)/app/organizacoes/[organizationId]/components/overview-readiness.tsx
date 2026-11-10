import { Badge } from '@/components/ui/badge'
import type { OrganizationReadiness } from '@/modules/organizations/organization-readiness.server'
import { ActivateOrganizationButton } from './activate-organization-button'

const requirements: Array<{
  key: keyof OrganizationReadiness
  label: string
}> = [
  {
    key: 'defaultRole',
    label:
      'Exatamente um cargo padrão de ingresso ativo, sem acesso completo e fora da diretoria.',
  },
  {
    key: 'fullAccessRole',
    label: 'Pelo menos um cargo ativo com acesso completo.',
  },
  {
    key: 'directorOccupied',
    label:
      'Todos os cargos ativos de diretoria com ocupante ou convite individual válido.',
  },
  {
    key: 'fullAccessMember',
    label: 'Pelo menos um membro ativo com cargo de acesso completo.',
  },
  {
    key: 'requiredDocuments',
    label: 'Estatuto e ata de eleição enviados.',
  },
]

type OverviewReadinessProps = {
  organizationId: string
  readiness: OrganizationReadiness | null
  canActivate: boolean
}

export function OverviewReadiness({
  organizationId,
  readiness,
  canActivate,
}: OverviewReadinessProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Configuração para ativação
        </h2>
        <p className="text-sm text-muted-foreground">
          {readiness
            ? 'Antes de ativar, a organização precisa cumprir os requisitos abaixo.'
            : 'Requisitos obrigatórios para ativar a organização.'}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-background p-5">
        {readiness ? (
          <ul className="space-y-3">
            {requirements.map(requirement => (
              <li
                key={requirement.key}
                className="flex flex-wrap items-start justify-between gap-2"
              >
                <span className="text-sm">{requirement.label}</span>
                <Badge
                  variant={readiness[requirement.key] ? 'default' : 'secondary'}
                >
                  {readiness[requirement.key] ? 'Concluído' : 'Pendente'}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Antes de ativar, a organização precisa de um cargo padrão ativo, um
            cargo ativo com acesso completo, diretoria ocupada, pelo menos um
            membro ativo com acesso completo e os documentos institucionais
            obrigatórios.
          </p>
        )}

        {canActivate ? (
          <ActivateOrganizationButton organizationId={organizationId} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Você não tem permissão para ativar a organização.
          </p>
        )}
      </div>
    </section>
  )
}
