import type { Metadata } from 'next'
import { io } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { requireSession } from '@/lib/session'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import { getOrganizationSummary } from '@/modules/organizations/organization.server'
import { ActivateOrganizationButton } from './components/activate-organization-button'

export const metadata: Metadata = {
  title: 'Organização',
  robots: { index: false, follow: false },
}

type OrganizationPageProps = {
  params: Promise<{ organizationId: string }>
}

async function OrganizationContent({ params }: OrganizationPageProps) {
  await io()

  const { organizationId } = await params
  const session = await requireSession()
  const summary = await getOrganizationSummary(session.userId, organizationId)

  if (summary.status !== 'ok') notFound()

  const canViewMembers =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.membersRead)
  const canUpdateOrganization =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.organizationUpdate)
  const canViewAudit =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.auditRead)
  const canManageRoles =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.rolesManage)
  const canManageInvites =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.invitesManage)
  const canActivate =
    summary.access.hasFullAccess ||
    summary.access.permissions.includes(PERMISSIONS.organizationActivate)

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <Link
          href="/app/organizacoes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Minhas organizações
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {summary.organization.legalName}
          </h1>
          <Badge
            variant={
              summary.organization.status === 'active' ? 'default' : 'secondary'
            }
          >
            {summary.organization.status === 'active'
              ? 'Ativa'
              : 'Em configuração'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.organization.acronym}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Membros</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte vínculos ativos e inativos, desative com motivo e acompanhe
            reativações.
          </p>
          {canViewMembers ? (
            <Link
              href={`/app/organizacoes/${summary.organization.id}/membros`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Gerenciar membros
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Você não tem permissão para ver membros.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Cargos e permissões</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina os cargos, o cargo padrão de ingresso e os cargos de acesso
            completo.
          </p>
          {canManageRoles ? (
            <Link
              href={`/app/organizacoes/${summary.organization.id}/cargos`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Gerenciar cargos
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Você não tem permissão para gerenciar cargos.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Configurações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste a sigla da organização e consulte os dados vinculados ao
            CNPJ.
          </p>
          {canUpdateOrganization ? (
            <Link
              href={`/app/organizacoes/${summary.organization.id}/configuracoes`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Abrir configurações
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Você não tem permissão para editar a organização.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Documentos institucionais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie o estatuto e a ata de eleição exigidos para a ativação.
          </p>
          {canUpdateOrganization ? (
            <Link
              href={`/app/organizacoes/${summary.organization.id}/documentos`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Gerenciar documentos
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Você não tem permissão para enviar documentos.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Convites</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Convide pessoas, acompanhe usos e revogue links.
          </p>
          {canManageInvites ? (
            <Link
              href={`/app/organizacoes/${summary.organization.id}/convites`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Gerenciar convites
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Você não tem permissão para gerenciar convites.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Auditoria</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte os eventos registrados na organização.
          </p>
          {canViewAudit ? (
            <Link
              href={`/app/organizacoes/${summary.organization.id}/auditoria`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Ver auditoria
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Você não tem permissão para ver auditoria.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-background p-5">
        <h2 className="font-semibold">Ativação</h2>
        {summary.organization.status === 'active' ? (
          <p className="text-sm text-muted-foreground">
            A organização está ativa.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Antes de ativar, a organização precisa de um cargo padrão ativo,
              um cargo ativo com acesso completo, diretoria ocupada, pelo menos
              um membro ativo com acesso completo e os documentos institucionais
              obrigatórios.
            </p>
            {canActivate ? (
              <ActivateOrganizationButton
                organizationId={summary.organization.id}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Você não tem permissão para ativar a organização.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Carregando organização…
        </p>
      }
    >
      <OrganizationContent params={params} />
    </Suspense>
  )
}
