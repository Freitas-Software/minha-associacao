'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { FormattedInput } from '@/components/ui/formatted-input'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatCnpj } from '@/lib/formatters'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import {
  ORGANIZATION_REQUEST_DOCUMENT_TYPES,
  ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES,
} from '@/modules/organizations/organization-request-limits'
import { requestOrganizationAction } from '../../actions'

function validateDocument(file: File): string | null {
  if (file.size > ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES) {
    return 'A ata deve ter no máximo 3 MB.'
  }

  if (
    !ORGANIZATION_REQUEST_DOCUMENT_TYPES.includes(
      file.type as (typeof ORGANIZATION_REQUEST_DOCUMENT_TYPES)[number],
    )
  ) {
    return 'A ata deve ser um arquivo PDF, JPEG ou PNG.'
  }

  return null
}

export function RequestOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    requestOrganizationAction,
    initialOrganizationActionState,
  )
  const [cnpj, setCnpj] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)

  const documentDescription = fileError
    ? 'organization-document-description organization-document-error'
    : 'organization-document-description'

  return (
    <form
      action={formAction}
      aria-busy={pending}
      encType="multipart/form-data"
      className="space-y-6"
      onSubmit={event => {
        event.preventDefault()

        if (fileError) return

        formAction(new FormData(event.currentTarget))
      }}
    >
      <FieldSet>
        <FieldLegend>Dados da associação</FieldLegend>

        <p className="text-sm text-muted-foreground">
          Todos os campos são obrigatórios.
        </p>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="organization-cnpj">CNPJ</FieldLabel>
            <FormattedInput
              id="organization-cnpj"
              name="cnpj"
              format={formatCnpj}
              maxDigits={14}
              maxLength={18}
              autoComplete="off"
              placeholder="00.000.000/0000-00"
              spellCheck={false}
              required
              value={cnpj}
              onValueChange={setCnpj}
              aria-describedby="organization-cnpj-description"
            />
            <FieldDescription id="organization-cnpj-description">
              A razão social será obtida na consulta à BrasilAPI.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="organization-acronym">Sigla</FieldLabel>
            <Input
              id="organization-acronym"
              name="acronym"
              type="text"
              maxLength={32}
              required
              placeholder="Ex.: AMA"
              autoComplete="off"
            />
          </Field>

          <Field data-invalid={Boolean(fileError)}>
            <FieldLabel htmlFor="organization-document">
              Ata de eleição
            </FieldLabel>
            <Input
              id="organization-document"
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
              aria-invalid={Boolean(fileError)}
              aria-describedby={documentDescription}
              onChange={event => {
                const file = event.currentTarget.files?.[0]
                setFileError(file ? validateDocument(file) : null)
              }}
            />
            <FieldDescription id="organization-document-description">
              PDF, JPEG ou PNG com até 3 MB. O administrador da plataforma
              analisará a ata antes de criar a organização.
            </FieldDescription>
            {fileError ? (
              <p
                id="organization-document-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {fileError}
              </p>
            ) : null}
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          disabled={pending || state.status === 'success' || Boolean(fileError)}
        >
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Enviando…
            </>
          ) : (
            'Enviar solicitação'
          )}
        </Button>

        <FormMessage
          status={pending ? 'idle' : state.status}
          message={pending ? '' : state.message}
          className="mt-4"
        />

        {state.status === 'success' ? (
          <p className="text-sm">
            <Link
              href="/app/organizacoes/solicitacoes"
              className="underline underline-offset-4"
            >
              Acompanhar minhas solicitações
            </Link>
          </p>
        ) : null}
      </FieldSet>
    </form>
  )
}
