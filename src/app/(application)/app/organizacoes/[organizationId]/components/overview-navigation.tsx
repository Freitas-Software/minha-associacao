import Link from 'next/link'

export type OverviewCapabilities = {
  viewMembers: boolean
  manageRoles: boolean
  manageInvites: boolean
  viewDocuments: boolean
  updateOrganization: boolean
  viewAudit: boolean
}

type OverviewNavigationProps = {
  organizationId: string
  capabilities: OverviewCapabilities
}

type SecondaryLink = {
  href: string
  label: string
}

const focusClassName =
  'py-1.5 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function OverviewNavigation({
  organizationId,
  capabilities,
}: OverviewNavigationProps) {
  const basePath = `/app/organizacoes/${organizationId}`

  const links: SecondaryLink[] = []

  if (capabilities.viewMembers) {
    links.push({
      href: `${basePath}/membros`,
      label: 'Gerenciar membros',
    })
  }

  if (capabilities.manageRoles) {
    links.push({
      href: `${basePath}/cargos`,
      label: 'Gerenciar cargos',
    })
  }

  if (capabilities.manageInvites) {
    links.push({
      href: `${basePath}/convites`,
      label: 'Gerenciar convites',
    })
  }

  if (capabilities.viewDocuments) {
    links.push({
      href: `${basePath}/documentos`,
      label: 'Documentos institucionais',
    })
  }

  if (capabilities.updateOrganization) {
    links.push({
      href: `${basePath}/configuracoes`,
      label: 'Abrir configurações',
    })
  }

  if (capabilities.viewAudit) {
    links.push({
      href: `${basePath}/auditoria`,
      label: 'Ver auditoria',
    })
  }

  const isReadOnly =
    !capabilities.viewMembers &&
    !capabilities.manageRoles &&
    !capabilities.manageInvites &&
    !capabilities.updateOrganization &&
    !capabilities.viewAudit

  return (
    <div className="space-y-3">
      <nav aria-label="Navegação da organização">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <li>
            <Link
              href={basePath}
              aria-current="page"
              className={`${focusClassName} font-medium`}
            >
              Visão geral
            </Link>
          </li>
          {links.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${focusClassName} text-muted-foreground`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {isReadOnly ? (
        <p className="text-sm text-muted-foreground">
          Seu cargo atual não permite gerenciar esta organização. Os dados
          aparecem quando o seu cargo concede a permissão correspondente.
        </p>
      ) : null}
    </div>
  )
}
