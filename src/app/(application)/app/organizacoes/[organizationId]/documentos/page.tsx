import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import { getOrganizationSummary } from '@/modules/organizations/organization.server'
import { listOrganizationDocuments } from '@/modules/organizations/organization-document.server'
import {
  ORGANIZATION_DOCUMENT_LABELS,
  ORGANIZATION_DOCUMENT_TYPES,
  type OrganizationDocumentType,
} from '@/modules/organizations/organization-document-policy'
import { isDocumentStorageConfigured } from '@/modules/organizations/organization-document-storage.server'
import { DocumentUploadForm } from './components/document-upload-form'

export const metadata: Metadata = {
  title: 'Documentos institucionais',
  robots: { index: false, follow: false },
}

type OrganizationDocumentsPageProps = {
  params: Promise<{ organizationId: string }>
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

async function OrganizationDocumentsContent({
  params,
}: OrganizationDocumentsPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const [summary, documentsData] = await Promise.all([
    getOrganizationSummary(session.userId, organizationId),
    listOrganizationDocuments(session.userId, organizationId),
  ])

  if (summary.status !== 'ok' || documentsData.status !== 'ok') notFound()

  const canUpload = summary.access.permissions.includes(
    PERMISSIONS.organizationUpdate,
  )
  const storageConfigured = isDocumentStorageConfigured()

  const latestByType = new Map<
    OrganizationDocumentType,
    (typeof documentsData.documents)[number]
  >()

  for (const document of documentsData.documents) {
    if (!latestByType.has(document.type)) {
      latestByType.set(document.type, document)
    }
  }

  const missingTypes = ORGANIZATION_DOCUMENT_TYPES.filter(
    type => !latestByType.has(type),
  )

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <Link
          href={`/app/organizacoes/${summary.organization.id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← {summary.organization.acronym}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Documentos institucionais
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.organization.legalName}
        </p>
      </header>

      {summary.organization.status === 'provisioning' ? (
        <section
          className="space-y-2 rounded-lg border bg-background p-5"
          aria-labelledby="documents-requirement-title"
        >
          <h2 id="documents-requirement-title" className="font-semibold">
            Requisito para ativação
          </h2>
          <p className="text-sm text-muted-foreground">
            Estatuto e ata de eleição são obrigatórios para ativar a
            organização.
          </p>
          <p className="text-sm text-muted-foreground">
            {missingTypes.length === 0
              ? 'Os dois documentos obrigatórios já foram enviados.'
              : `Pendentes: ${missingTypes
                  .map(type => ORGANIZATION_DOCUMENT_LABELS[type])
                  .join(' e ')}.`}
          </p>
        </section>
      ) : null}

      {!storageConfigured ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          O armazenamento de documentos não está configurado neste ambiente.
          Defina `BLOB_READ_WRITE_TOKEN` para habilitar os envios.
        </p>
      ) : null}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight">
          Enviar arquivos
        </h2>

        {canUpload && storageConfigured ? (
          <div className="grid gap-6 md:grid-cols-2">
            {ORGANIZATION_DOCUMENT_TYPES.map(type => (
              <div key={type} className="rounded-lg border bg-background p-5">
                <DocumentUploadForm
                  organizationId={summary.organization.id}
                  type={type}
                  label={ORGANIZATION_DOCUMENT_LABELS[type]}
                  hasDocument={latestByType.has(type)}
                />
              </div>
            ))}
          </div>
        ) : canUpload ? (
          <p className="text-sm text-muted-foreground">
            Os envios ficam disponíveis após configurar o armazenamento.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para enviar documentos.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Histórico de envios
        </h2>

        {documentsData.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum documento enviado ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {documentsData.documents.map(document => (
              <li
                key={document.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-background p-4"
              >
                <div>
                  <p className="font-medium">{document.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Enviado por {document.uploadedByName} em{' '}
                    <time dateTime={document.createdAt.toISOString()}>
                      {formatDateTime(document.createdAt)}
                    </time>
                  </p>
                </div>
                <a
                  href={`/app/organizacoes/${summary.organization.id}/documentos/${document.id}`}
                  className="text-sm underline underline-offset-4"
                >
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default function OrganizationDocumentsPage({
  params,
}: OrganizationDocumentsPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando documentos…
        </p>
      }
    >
      <OrganizationDocumentsContent params={params} />
    </Suspense>
  )
}
