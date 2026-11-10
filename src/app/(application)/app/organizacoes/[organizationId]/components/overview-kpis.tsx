import type { OrganizationOverview } from '@/modules/organizations/organization.server'

type OverviewCounts = Extract<OrganizationOverview, { status: 'ok' }>['counts']

type KpiCardProps = {
  label: string
  value: number | null
  footer: string
}

function KpiCard({ label, value, footer }: KpiCardProps) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {value === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Sem permissão para ver este número.</span>
          </>
        ) : (
          value
        )}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{footer}</p>
    </div>
  )
}

export function OverviewKpis({ counts }: { counts: OverviewCounts }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Membros ativos"
        value={counts.activeMembers}
        footer={
          counts.inactiveMembers === null
            ? 'Sem permissão para ver membros.'
            : `Inativos: ${counts.inactiveMembers}`
        }
      />
      <KpiCard
        label="Cargos ativos"
        value={counts.activeRoles}
        footer={
          counts.fullAccessRoles === null
            ? 'Sem permissão para ver cargos.'
            : `Com acesso completo: ${counts.fullAccessRoles}`
        }
      />
      <KpiCard
        label="Convites válidos"
        value={counts.activeInvites}
        footer={
          counts.activeInvites === null
            ? 'Sem permissão para ver convites.'
            : 'Não revogados, não expirados e com usos disponíveis.'
        }
      />
      <KpiCard
        label="Documentos institucionais"
        value={counts.documents}
        footer={
          counts.documents === null
            ? 'Sem permissão para ver documentos.'
            : 'Estatuto e ata de eleição.'
        }
      />
    </div>
  )
}
