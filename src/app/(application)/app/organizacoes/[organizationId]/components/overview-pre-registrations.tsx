import Link from 'next/link'

type OverviewPreRegistrationsProps = {
  organizationId: string
  count: number
}

export function OverviewPreRegistrations({
  organizationId,
  count,
}: OverviewPreRegistrationsProps) {
  if (count <= 0) return null

  const message =
    count === 1
      ? `Há ${count} pessoa pré-cadastrada que ainda não concluiu a criação da conta. O link pode ter expirado; reenvie pelo cadastro de membros.`
      : `Há ${count} pessoas pré-cadastradas que ainda não concluíram a criação da conta. O link pode ter expirado; reenvie pelo cadastro de membros.`

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Pré-cadastros pendentes
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      <div className="rounded-lg border bg-background p-5">
        <Link
          href={`/app/organizacoes/${organizationId}/membros`}
          className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ver membros
        </Link>
      </div>
    </section>
  )
}
