import type { OrganizationOverviewDocument } from '@/modules/organizations/organization.server'
import { formatDateTime } from './overview-format'

type OverviewDocumentsProps = {
  organizationId: string
  documents: OrganizationOverviewDocument[]
}

export function OverviewDocuments({
  organizationId,
  documents,
}: OverviewDocumentsProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Documentos institucionais
        </h2>
        <p className="text-sm text-muted-foreground">
          Estatuto e atas enviados, com autor e data do envio.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-5">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum documento enviado ainda. Estatuto e ata de eleição são
            obrigatórios para ativação.
          </p>
        ) : (
          <ul className="space-y-4">
            {documents.map(document => (
              <li
                key={document.id}
                className="flex flex-wrap items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium break-words">
                    {document.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enviado por {document.uploadedByName} em{' '}
                    <time dateTime={document.createdAt.toISOString()}>
                      {formatDateTime(document.createdAt)}
                    </time>
                  </p>
                </div>
                <a
                  href={`/app/organizacoes/${organizationId}/documentos/${document.id}`}
                  className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
