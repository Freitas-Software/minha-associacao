import type { RegistrationContactContext } from '@/modules/identity/registration-contact.server'

type RegistrationSummaryProps = {
  contactContext: RegistrationContactContext
}

const registeredEmailNote =
  'Este é o email registrado no seu cadastro. Ele será confirmado ao concluir e não pode ser alterado por este link.'

const informedEmailNote =
  'Este é o email informado no seu cadastro. Ele será confirmado ao concluir e não pode ser alterado por este link.'

export function RegistrationSummary({
  contactContext,
}: RegistrationSummaryProps) {
  const { organization, roleName } = contactContext

  return (
    <div className="min-w-0 rounded-lg border bg-background p-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        {organization && roleName ? (
          <>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Associação</dt>
              <dd className="text-sm font-medium break-words">
                {organization.legalName}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Cargo inicial</dt>
              <dd className="text-sm font-medium break-words">{roleName}</dd>
            </div>
          </>
        ) : null}

        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">CPF</dt>
          <dd className="font-mono text-sm font-medium tracking-wide break-all tabular-nums">
            {contactContext.documentNumberMasked}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="text-sm font-medium break-all">
            {contactContext.currentEmail}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {organization ? registeredEmailNote : informedEmailNote}
      </p>
    </div>
  )
}
